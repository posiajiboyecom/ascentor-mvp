-- ============================================================================
-- 2026-10-04_auth_hardening.sql
-- Shared (cross-instance) rate limiting for auth endpoints.
-- Apply in the Supabase SQL editor. The app works without it (falls back to
-- per-instance memory) but limits are only reliable once this exists.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  key          text PRIMARY KEY,
  hits         integer     NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);

-- Only the service role (server) touches this table.
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_rate_limits FROM anon, authenticated;

-- Fixed-window counter. Atomic: one upsert decides allow/deny.
CREATE OR REPLACE FUNCTION public.auth_rate_limit_hit(p_key text, p_limit integer, p_window_s integer)
RETURNS TABLE (allowed boolean, retry_after integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_hits   integer;
  v_start  timestamptz;
BEGIN
  INSERT INTO public.auth_rate_limits AS r (key, hits, window_start)
  VALUES (p_key, 1, now())
  ON CONFLICT (key) DO UPDATE
    SET hits = CASE WHEN r.window_start < now() - make_interval(secs => p_window_s) THEN 1 ELSE r.hits + 1 END,
        window_start = CASE WHEN r.window_start < now() - make_interval(secs => p_window_s) THEN now() ELSE r.window_start END
  RETURNING r.hits, r.window_start INTO v_hits, v_start;

  allowed := v_hits <= p_limit;
  retry_after := CASE WHEN allowed THEN 0
                 ELSE GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_start + make_interval(secs => p_window_s) - now())))::integer) END;
  RETURN NEXT;
END;
$fn$;

REVOKE ALL ON FUNCTION public.auth_rate_limit_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_rate_limit_hit(text, integer, integer) TO service_role;

-- Housekeeping: call occasionally (or via pg_cron) to drop stale rows.
CREATE OR REPLACE FUNCTION public.auth_rate_limits_cleanup()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $fn$
  DELETE FROM public.auth_rate_limits WHERE window_start < now() - interval '1 day';
$fn$;
REVOKE ALL ON FUNCTION public.auth_rate_limits_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_rate_limits_cleanup() TO service_role;
