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
