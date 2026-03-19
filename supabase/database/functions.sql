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
