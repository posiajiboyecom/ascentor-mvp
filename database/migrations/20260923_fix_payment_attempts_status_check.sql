-- ============================================================================
-- 20260923_fix_payment_attempts_status_check.sql   *** RUN THIS IMMEDIATELY ***
--
-- CRITICAL FIX. The live payment_attempts.status CHECK constraint only allows
-- 'pending' | 'completed' | 'failed' — a stale constraint from before this
-- table's real design. Every payment-confirmation function in this codebase
-- (lib/paymentSettlement.ts, lib/paymentReconciliation.ts) writes
-- 'pending' | 'success' | 'failed' | 'abandoned' | 'duplicate', which is what
-- every SQL migration comment in this repo has always documented as the
-- intended set. 'success', 'abandoned' and 'duplicate' were never actually
-- permitted by the database, so Postgres has been silently (or, once the code
-- started checking for the error, loudly) rejecting the exact writes that
-- confirm a payment, mark one abandoned, or flag a duplicate.
--
-- Concretely, this means: for ANY Summit registration or subscription checkout
-- that started after 20260919 (the payment_attempts hardening), the very last
-- step of confirming a real, successful payment — claiming the attempt with
-- status = 'success' — has been rejected by the database every single time,
-- so the ticket/email/access-grant that depends on that claim succeeding could
-- never run. This is why Folorunso Segun Kazeem's confirmed ₦5,000 payment
-- (and any other payment made after 19 Sep) could not be confirmed by
-- "Check Paystack", no matter which reference was checked or how it was
-- checked. The two registrations that DID get confirmed (Daniella, Posi) both
-- paid on 15 Sep, before payment_attempts existed, through the old direct-write
-- flow — they never depended on this constraint at all.
--
-- Idempotent, safe to re-run.
-- ============================================================================

ALTER TABLE public.payment_attempts DROP CONSTRAINT IF EXISTS payment_attempts_status_check;

ALTER TABLE public.payment_attempts
  ADD CONSTRAINT payment_attempts_status_check
  CHECK (status = ANY (ARRAY['pending', 'success', 'failed', 'abandoned', 'duplicate']));

-- Verify: should now show the 5-value list above.
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'payment_attempts'::regclass and contype = 'c' and conname = 'payment_attempts_status_check';
