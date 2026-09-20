-- ============================================================================
-- 20260920c_summit_reminders.sql   (idempotent, additive, safe to re-run)
--
-- Tracks payment reminders an admin sends to registrants who have not paid, so
-- the admin can see when someone was last reminded and bulk reminders skip
-- anyone reminded in the last 24 hours. The app works without these columns
-- (writes are best-effort) but cannot show or throttle on reminder history.
-- ============================================================================

ALTER TABLE public.summit_registrations
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count   integer NOT NULL DEFAULT 0;
