-- ============================================================================
-- 20260923c_summit_event_day.sql   (idempotent, safe to re-run)
--
-- Tracks the morning-of-event reminder email so the cron job (and its manual
-- "send now" override on the admin page) never sends it to the same person
-- twice, even if triggered more than once on the day.
-- ============================================================================

ALTER TABLE public.summit_registrations
  ADD COLUMN IF NOT EXISTS event_day_email_sent_at timestamptz;
