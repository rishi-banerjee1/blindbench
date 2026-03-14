-- ============================================================
-- BlindBench — Research Upgrade Migration
-- Adds stability scores, prompt variants, and evaluation views
-- Run AFTER the initial schema has been deployed.
-- ============================================================

-- 1. Add stability_score to responses table
ALTER TABLE responses
ADD COLUMN IF NOT EXISTS stability_score NUMERIC(4,3)
CHECK (stability_score >= 0 AND stability_score <= 1);

-- 2. Add run_number to distinguish stability test runs
-- NULL for original runs, 1-3 for stability test repetitions
ALTER TABLE responses
ADD COLUMN IF NOT EXISTS run_number SMALLINT DEFAULT NULL;

-- 3. Add stability_group_id to link stability test runs to original prompt
ALTER TABLE responses
ADD COLUMN IF NOT EXISTS stability_group_id UUID REFERENCES prompts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_responses_stability_group
ON responses (stability_group_id) WHERE stability_group_id IS NOT NULL;

-- ============================================================
-- Table: prompt_variants
-- Stores perturbation variants of a prompt for sensitivity testing.
-- ============================================================
CREATE TABLE IF NOT EXISTS prompt_variants (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_prompt_id  UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
    variant_text      TEXT NOT NULL CHECK (char_length(variant_text) BETWEEN 1 AND 1200),
    variant_type      TEXT NOT NULL DEFAULT 'paraphrase',
    sensitivity_score NUMERIC(4,3) CHECK (sensitivity_score >= 0 AND sensitivity_score <= 1),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_variants_parent ON prompt_variants (parent_prompt_id);

-- RLS for prompt_variants
ALTER TABLE prompt_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_anon_insert_prompt_variants"
    ON prompt_variants FOR INSERT TO anon WITH CHECK (false);

CREATE POLICY "anon_select_prompt_variants"
    ON prompt_variants FOR SELECT TO anon USING (true);

CREATE POLICY "deny_anon_update_prompt_variants"
    ON prompt_variants FOR UPDATE TO anon USING (false);

CREATE POLICY "deny_anon_delete_prompt_variants"
    ON prompt_variants FOR DELETE TO anon USING (false);

-- ============================================================
-- View: evaluation_records
-- Composable view joining prompts + responses + votes.
-- This is the structured evaluation record used for dataset export.
-- ============================================================
CREATE OR REPLACE VIEW evaluation_records AS
SELECT
    p.id AS prompt_id,
    p.text AS prompt_text,
    p.created_at AS prompt_created_at,
    r.id AS response_id,
    r.model,
    r.response_text,
    r.truth_score,
    r.failure_type,
    r.stability_score,
    r.run_number,
    COUNT(v.id) AS total_votes,
    COUNT(v.id) FILTER (WHERE v.winner_model = r.model) AS votes_won,
    CASE WHEN COUNT(v.id) = 0 THEN false
         ELSE COUNT(v.id) FILTER (WHERE v.winner_model = r.model) > 0
    END AS won_vote
FROM prompts p
JOIN responses r ON r.prompt_id = p.id
LEFT JOIN votes v ON v.prompt_id = p.id
WHERE r.run_number IS NULL  -- Only original runs, not stability repeats
GROUP BY p.id, p.text, p.created_at, r.id, r.model, r.response_text,
         r.truth_score, r.failure_type, r.stability_score, r.run_number
ORDER BY p.created_at DESC, r.model;

GRANT SELECT ON evaluation_records TO anon;

-- ============================================================
-- View: model_performance_summary
-- Aggregated per-model stats for the analytics dashboard.
-- ============================================================
CREATE OR REPLACE VIEW model_performance_summary AS
SELECT
    r.model,
    COUNT(*) AS total_responses,
    ROUND(AVG(r.truth_score), 3) AS avg_truth_score,
    ROUND(AVG(r.stability_score), 3) AS avg_stability_score,
    COUNT(r.failure_type) AS total_failures,
    ROUND(COUNT(r.failure_type)::NUMERIC / NULLIF(COUNT(*), 0), 3) AS failure_rate
FROM responses r
WHERE r.run_number IS NULL
GROUP BY r.model
ORDER BY avg_truth_score DESC NULLS LAST;

GRANT SELECT ON model_performance_summary TO anon;
