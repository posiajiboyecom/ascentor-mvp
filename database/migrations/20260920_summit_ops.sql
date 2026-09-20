-- ============================================================================
-- 2026-09-20_summit_ops.sql   (idempotent, safe to re-run)
--
-- Email-delivery tracking + Paystack fee capture for Summit registrations.
-- The application works WITHOUT this migration (all writes to these columns are
-- best-effort), but the admin needs it to show ticket-email status and real fees,
-- and the retry job needs it to re-send failed confirmation emails.
-- Run in the Supabase SQL editor.
-- ============================================================================

ALTER TABLE public.summit_registrations
  ADD COLUMN IF NOT EXISTS paystack_fee                numeric,      -- NGN, from Paystack's verify response
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at  timestamptz,  -- customer confirmation + ticket delivered
  ADD COLUMN IF NOT EXISTS confirmation_email_error    text,         -- last failure; retried by reconciliation
  ADD COLUMN IF NOT EXISTS admin_notified_paid_at      timestamptz;  -- admin "paid registration" email delivered

CREATE INDEX IF NOT EXISTS idx_summit_registrations_email_retry
  ON public.summit_registrations (payment_status)
  WHERE confirmation_email_error IS NOT NULL AND confirmation_email_sent_at IS NULL;
