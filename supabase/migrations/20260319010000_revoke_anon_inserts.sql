-- ============================================================
-- BlindBench — Revoke Anonymous INSERT on prompts and votes
--
-- All writes now go through edge functions (service role),
-- so anon INSERT is no longer needed and was a security gap:
--   - prompts: already written by run-models edge function
--   - votes: now written by submit-vote edge function
--
-- This closes the bypass where someone could extract the anon
-- key from frontend JS and POST directly to the REST API,
-- circumventing edge function rate limiting and validation.
-- ============================================================

-- Drop the permissive INSERT policies
DROP POLICY IF EXISTS "anon_insert_prompts" ON public.prompts;
DROP POLICY IF EXISTS "anon_insert_votes" ON public.votes;

-- Replace with deny policies (consistent with responses table pattern)
CREATE POLICY "deny_anon_insert_prompts"
    ON public.prompts
    FOR INSERT
    TO anon
    WITH CHECK (false);

CREATE POLICY "deny_anon_insert_votes"
    ON public.votes
    FOR INSERT
    TO anon
    WITH CHECK (false);
