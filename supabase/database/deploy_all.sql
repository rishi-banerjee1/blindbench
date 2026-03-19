-- ============================================================
-- BlindBench — Database Schema
-- Supabase Postgres
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- Table: prompts
-- Stores user-submitted prompts for the arena.
-- ip_hash is SHA-256 of the client IP — raw IP is never stored.
-- ------------------------------------------------------------
CREATE TABLE prompts (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    text        TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 1000),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_hash     TEXT NOT NULL
);

-- Index for rate-limit lookups (recent prompts by ip_hash)
CREATE INDEX idx_prompts_ip_hash_created ON prompts (ip_hash, created_at DESC);

-- ------------------------------------------------------------
-- Table: responses
-- Stores LLM outputs linked to a prompt.
-- model: identifier like 'openai/gpt-4o' or 'anthropic/claude-sonnet-4-20250514'
-- truth_score: 0.0–1.0 computed by the truth-analyzer function
-- failure_type: nullable classification from reasoning-analyzer
-- ------------------------------------------------------------
CREATE TABLE responses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_id       UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
    model           TEXT NOT NULL,
    response_text   TEXT NOT NULL,
    truth_score     NUMERIC(4,3) CHECK (truth_score >= 0 AND truth_score <= 1),
    failure_type    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_responses_prompt_id ON responses (prompt_id);
CREATE INDEX idx_responses_model ON responses (model);
CREATE INDEX idx_responses_failure_type ON responses (failure_type) WHERE failure_type IS NOT NULL;

-- ------------------------------------------------------------
-- Table: votes
-- Anonymous votes indicating which model "won" for a prompt.
-- ------------------------------------------------------------
CREATE TABLE votes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_id       UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
    winner_model    TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_hash         TEXT NOT NULL
);

CREATE INDEX idx_votes_prompt_id ON votes (prompt_id);
CREATE INDEX idx_votes_winner_model ON votes (winner_model);
CREATE INDEX idx_votes_ip_hash_created ON votes (ip_hash, created_at DESC);

-- ------------------------------------------------------------
-- Table: rate_limits
-- Tracks request counts per hashed IP per time window.
-- Used by edge functions to enforce rate limits.
-- ------------------------------------------------------------
CREATE TABLE rate_limits (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ip_hash     TEXT NOT NULL,
    endpoint    TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', now()),
    request_count INTEGER NOT NULL DEFAULT 1,
    UNIQUE (ip_hash, endpoint, window_start)
);

CREATE INDEX idx_rate_limits_lookup ON rate_limits (ip_hash, endpoint, window_start);

-- ------------------------------------------------------------
-- Materialized view: leaderboard
-- Pre-computed win rates per model for fast reads.
-- Refresh periodically via a cron job or on-demand.
-- ------------------------------------------------------------
CREATE MATERIALIZED VIEW leaderboard AS
SELECT
    winner_model AS model,
    COUNT(*)     AS total_wins,
    ROUND(
        COUNT(*)::NUMERIC / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100,
        2
    ) AS win_rate_pct
FROM votes
GROUP BY winner_model
ORDER BY total_wins DESC;

CREATE UNIQUE INDEX idx_leaderboard_model ON leaderboard (model);

-- Function to refresh the leaderboard materialized view
CREATE OR REPLACE FUNCTION public.refresh_leaderboard()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ------------------------------------------------------------
-- Materialized view: failure_summary
-- Aggregated counts of reasoning failure types per model.
-- ------------------------------------------------------------
CREATE MATERIALIZED VIEW failure_summary AS
SELECT
    model,
    failure_type,
    COUNT(*) AS occurrence_count,
    ROUND(AVG(truth_score), 3) AS avg_truth_score
FROM responses
WHERE failure_type IS NOT NULL
GROUP BY model, failure_type
ORDER BY model, occurrence_count DESC;

CREATE UNIQUE INDEX idx_failure_summary_model_type ON failure_summary (model, failure_type);

-- Function to refresh failure summary
CREATE OR REPLACE FUNCTION public.refresh_failure_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.failure_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
-- ============================================================
-- BlindBench — Postgres Functions
-- ============================================================

-- Atomic rate limit increment.
-- Returns the new request count for the current window.
-- If the count exceeds max, returns the count but does not block
-- (the edge function handles the block decision).
CREATE OR REPLACE FUNCTION public.increment_rate_limit(
    p_ip_hash TEXT,
    p_endpoint TEXT,
    p_window_start TIMESTAMPTZ,
    p_max_requests INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    current_count INTEGER;
BEGIN
    INSERT INTO public.rate_limits (ip_hash, endpoint, window_start, request_count)
    VALUES (p_ip_hash, p_endpoint, p_window_start, 1)
    ON CONFLICT (ip_hash, endpoint, window_start)
    DO UPDATE SET request_count = public.rate_limits.request_count + 1
    RETURNING request_count INTO current_count;

    RETURN current_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Grant execute to service role only
REVOKE EXECUTE ON FUNCTION increment_rate_limit FROM anon;
REVOKE EXECUTE ON FUNCTION increment_rate_limit FROM authenticated;

-- Cleanup: remove rate limit entries older than 1 hour.
-- Schedule this via pg_cron or call periodically.
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM public.rate_limits
    WHERE window_start < now() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE EXECUTE ON FUNCTION cleanup_rate_limits FROM anon;
REVOKE EXECUTE ON FUNCTION cleanup_rate_limits FROM authenticated;
-- ============================================================
-- BlindBench — Row Level Security Policies
-- ============================================================
-- Principle: anonymous users can INSERT and SELECT limited data.
-- No anonymous UPDATE or DELETE on any table.
-- Service-role (edge functions) bypasses RLS for writes/updates.
-- ============================================================

-- ========== PROMPTS ==========
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

-- Anon users can submit prompts (insert only)
CREATE POLICY "anon_insert_prompts"
    ON prompts
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Anon users can read prompts (for displaying in arena)
CREATE POLICY "anon_select_prompts"
    ON prompts
    FOR SELECT
    TO anon
    USING (true);

-- No anon update
CREATE POLICY "deny_anon_update_prompts"
    ON prompts
    FOR UPDATE
    TO anon
    USING (false);

-- No anon delete
CREATE POLICY "deny_anon_delete_prompts"
    ON prompts
    FOR DELETE
    TO anon
    USING (false);

-- Service role has full access (bypasses RLS by default)

-- ========== RESPONSES ==========
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

-- Anon cannot insert responses (only edge functions via service_role)
CREATE POLICY "deny_anon_insert_responses"
    ON responses
    FOR INSERT
    TO anon
    WITH CHECK (false);

-- Anon can read responses (for displaying comparisons)
CREATE POLICY "anon_select_responses"
    ON responses
    FOR SELECT
    TO anon
    USING (true);

-- No anon update
CREATE POLICY "deny_anon_update_responses"
    ON responses
    FOR UPDATE
    TO anon
    USING (false);

-- No anon delete
CREATE POLICY "deny_anon_delete_responses"
    ON responses
    FOR DELETE
    TO anon
    USING (false);

-- ========== VOTES ==========
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Anon can submit votes
CREATE POLICY "anon_insert_votes"
    ON votes
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Anon can read votes (for leaderboard/stats)
CREATE POLICY "anon_select_votes"
    ON votes
    FOR SELECT
    TO anon
    USING (true);

-- No anon update
CREATE POLICY "deny_anon_update_votes"
    ON votes
    FOR UPDATE
    TO anon
    USING (false);

-- No anon delete
CREATE POLICY "deny_anon_delete_votes"
    ON votes
    FOR DELETE
    TO anon
    USING (false);

-- ========== RATE LIMITS ==========
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Anon cannot touch rate_limits — managed exclusively by edge functions
CREATE POLICY "deny_anon_all_rate_limits"
    ON rate_limits
    FOR ALL
    TO anon
    USING (false)
    WITH CHECK (false);

-- ========== MATERIALIZED VIEWS ==========
-- Note: Materialized views do not support RLS directly.
-- Access is controlled by granting SELECT only.
GRANT SELECT ON leaderboard TO anon;
GRANT SELECT ON failure_summary TO anon;

-- Restrict refresh to service role
REVOKE EXECUTE ON FUNCTION refresh_leaderboard() FROM anon;
REVOKE EXECUTE ON FUNCTION refresh_failure_summary() FROM anon;

-- ============================================================
-- Research Upgrade Migration
-- Adds stability scores, prompt variants, and evaluation views
-- ============================================================

ALTER TABLE responses
ADD COLUMN IF NOT EXISTS stability_score NUMERIC(4,3)
CHECK (stability_score >= 0 AND stability_score <= 1);

ALTER TABLE responses
ADD COLUMN IF NOT EXISTS run_number SMALLINT DEFAULT NULL;

ALTER TABLE responses
ADD COLUMN IF NOT EXISTS stability_group_id UUID REFERENCES prompts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_responses_stability_group
ON responses (stability_group_id) WHERE stability_group_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS prompt_variants (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_prompt_id  UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
    variant_text      TEXT NOT NULL CHECK (char_length(variant_text) BETWEEN 1 AND 1200),
    variant_type      TEXT NOT NULL DEFAULT 'paraphrase',
    sensitivity_score NUMERIC(4,3) CHECK (sensitivity_score >= 0 AND sensitivity_score <= 1),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_variants_parent ON prompt_variants (parent_prompt_id);

ALTER TABLE prompt_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_anon_insert_prompt_variants"
    ON prompt_variants FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "anon_select_prompt_variants"
    ON prompt_variants FOR SELECT TO anon USING (true);
CREATE POLICY "deny_anon_update_prompt_variants"
    ON prompt_variants FOR UPDATE TO anon USING (false);
CREATE POLICY "deny_anon_delete_prompt_variants"
    ON prompt_variants FOR DELETE TO anon USING (false);

CREATE OR REPLACE VIEW evaluation_records AS
SELECT
    p.id AS prompt_id, p.text AS prompt_text, p.created_at AS prompt_created_at,
    r.id AS response_id, r.model, r.response_text, r.truth_score, r.failure_type,
    r.stability_score, r.run_number,
    v.winner_model AS vote_winner, v.created_at AS vote_created_at,
    CASE WHEN v.winner_model = r.model THEN true ELSE false END AS won_vote
FROM prompts p
JOIN responses r ON r.prompt_id = p.id
LEFT JOIN votes v ON v.prompt_id = p.id
WHERE r.run_number IS NULL
ORDER BY p.created_at DESC, r.model;

GRANT SELECT ON evaluation_records TO anon;

CREATE OR REPLACE VIEW model_performance_summary AS
SELECT
    r.model, COUNT(*) AS total_responses,
    ROUND(AVG(r.truth_score), 3) AS avg_truth_score,
    ROUND(AVG(r.stability_score), 3) AS avg_stability_score,
    COUNT(r.failure_type) AS total_failures,
    ROUND(COUNT(r.failure_type)::NUMERIC / NULLIF(COUNT(*), 0), 3) AS failure_rate
FROM responses r
WHERE r.run_number IS NULL
GROUP BY r.model
ORDER BY avg_truth_score DESC NULLS LAST;

GRANT SELECT ON model_performance_summary TO anon;
