-- ============================================================
-- BlindBench — Database Schema
-- Supabase Postgres
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- Table: prompts
-- Stores user-submitted prompts for the arena.
-- ip_hash is SHA-256 of the client IP — raw IP is never stored.
-- ------------------------------------------------------------
CREATE TABLE prompts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
CREATE OR REPLACE FUNCTION refresh_failure_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY failure_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
