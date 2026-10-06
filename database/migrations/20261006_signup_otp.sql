-- ============================================================================
-- 2026-10-06_signup_otp.sql
-- One-time codes for email sign-up. Reuses password_reset_otps (same shape: email, hashed code,
-- expiry, attempts, used) with a purpose column so the two flows can never accept each other's codes.
-- Additive and idempotent.
-- ============================================================================

ALTER TABLE public.password_reset_otps
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'password_reset';

CREATE INDEX IF NOT EXISTS password_reset_otps_email_purpose_created_idx
  ON public.password_reset_otps (email, purpose, created_at DESC);
