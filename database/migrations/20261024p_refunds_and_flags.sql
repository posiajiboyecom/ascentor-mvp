-- 20261024p_refunds_and_flags.sql
-- Additive only. Lets the admin console record a Paystack refund and flag a referral.
--   payment_attempts.refunded_at / refund_status  set when a refund is requested through the Paystack refund API
--   referrals.flagged_at                          set by "Flag as abuse" (referrals.status has a check constraint, so a
--                                                 timestamp is used instead of a new status value)
-- Safe to re-run. Nothing is dropped or deleted.
ALTER TABLE public.payment_attempts
  ADD COLUMN IF NOT EXISTS refunded_at   timestamptz,
  ADD COLUMN IF NOT EXISTS refund_status text;

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS flagged_at timestamptz;
