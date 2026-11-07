-- Device limit: an account stays signed in on at most 2 devices.
-- Additive and idempotent. Run in the Supabase SQL editor, or:
--   npx tsx scripts/apply-migration.ts database/migrations/20261108_session_limit.sql --yes
--
-- Every sign-in (password, Google, email link, partner sites) creates a row in auth.sessions. After each new session,
-- this trigger keeps that session plus the most recently active other one, and deletes the rest. Deleting a session
-- also deletes its refresh tokens (ON DELETE CASCADE), so the oldest device is signed out: its next page load or
-- request fails the session check and it lands on the sign-in page.
--
-- To change the limit, edit max_sessions below and run this file again.

CREATE OR REPLACE FUNCTION public.rx_enforce_session_limit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  max_sessions constant integer := 2;
BEGIN
  DELETE FROM auth.sessions s
  WHERE s.user_id = NEW.user_id
    AND s.id <> NEW.id
    AND s.id NOT IN (
      SELECT o.id FROM auth.sessions o
      WHERE o.user_id = NEW.user_id AND o.id <> NEW.id
      ORDER BY GREATEST(o.created_at, COALESCE(o.updated_at, o.created_at), COALESCE(o.refreshed_at::timestamptz, o.created_at)) DESC
      LIMIT max_sessions - 1
    );
  RETURN NULL;
END
$$;

REVOKE ALL ON FUNCTION public.rx_enforce_session_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS rx_session_limit ON auth.sessions;
CREATE TRIGGER rx_session_limit AFTER INSERT ON auth.sessions
  FOR EACH ROW EXECUTE FUNCTION public.rx_enforce_session_limit();

-- Apply the limit to accounts that are already over it (keeps each account's 2 most recently active sessions).
DELETE FROM auth.sessions s
USING (
  SELECT id, row_number() OVER (
    PARTITION BY user_id
    ORDER BY GREATEST(created_at, COALESCE(updated_at, created_at), COALESCE(refreshed_at::timestamptz, created_at)) DESC
  ) AS rn
  FROM auth.sessions
) ranked
WHERE s.id = ranked.id AND ranked.rn > 2;
