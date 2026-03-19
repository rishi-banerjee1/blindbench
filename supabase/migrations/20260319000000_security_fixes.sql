-- ============================================================
-- BlindBench — Security Fixes Migration
-- Fixes 2 ERRORS + 4 WARNINGS from Supabase security linter.
--
-- ERRORS fixed:
--   1. evaluation_records view: SECURITY DEFINER → SECURITY INVOKER
--   2. model_performance_summary view: SECURITY DEFINER → SECURITY INVOKER
--
-- WARNINGS fixed:
--   3-6. All SECURITY DEFINER functions: add SET search_path = ''
--        to prevent search_path injection attacks.
--
-- WARNINGS acknowledged (intentional, no action):
--   7-8. leaderboard/failure_summary materialized views exposed via API
--        → Public data by design (research platform, no user accounts).
--   9-10. anon_insert_prompts/anon_insert_votes always true
--        → Anonymous submission is core UX; rate limiting is in edge functions.
-- ============================================================

-- ============================================================
-- FIX 1 & 2: Views — switch from SECURITY DEFINER to INVOKER
-- PostgreSQL 15+ supports security_invoker on views.
-- Default is false (definer), which bypasses caller's RLS.
-- Setting true ensures RLS applies per the querying user.
-- ============================================================

ALTER VIEW public.evaluation_records SET (security_invoker = true);
ALTER VIEW public.model_performance_summary SET (security_invoker = true);

-- ============================================================
-- FIX 3: refresh_leaderboard — pin search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_leaderboard()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================
-- FIX 4: refresh_failure_summary — pin search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_failure_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.failure_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================
-- FIX 5: increment_rate_limit — pin search_path
-- ============================================================
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

-- Re-apply permission restrictions (CREATE OR REPLACE preserves grants,
-- but explicit is safer)
REVOKE EXECUTE ON FUNCTION public.increment_rate_limit FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_rate_limit FROM authenticated;

-- ============================================================
-- FIX 6: cleanup_rate_limits — pin search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM public.rate_limits
    WHERE window_start < now() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Re-apply permission restrictions
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limits FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limits FROM authenticated;
