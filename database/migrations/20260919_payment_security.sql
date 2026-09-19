-- ============================================================================
-- 2026-09-19_payment_security.sql
--
-- Security + payments hardening. Safe to re-run (idempotent).
--
--   1. profiles: clients can no longer write billing / role columns.
--   2. summit_registrations: clients can no longer insert or delete rows.
--   3. payment_attempts: one row per checkout attempt (subscription + summit),
--      the single source of truth used by verify, webhook and reconciliation.
--   4. password_reset_otps: attempt counter + hashed codes.
--
-- Run in the Supabase SQL editor (or `supabase db push`).
-- ============================================================================


-- ── 1. profiles: protect billing + privilege columns ────────────────────────
-- Previous trigger only guarded role + permissions, so any signed-in user could
-- PATCH their own row with subscription_plan / subscription_status / etc.
--
-- Rule: when the statement is executed directly by a client role
-- (authenticated / anon) and the caller is not an admin, none of the protected
-- columns may change. Service-role calls (API routes) and SECURITY DEFINER
-- functions run as a different current_user and are unaffected.
--
-- Implemented with to_jsonb() so it keeps working if a listed column does not
-- exist in a given environment.

CREATE OR REPLACE FUNCTION public.check_profile_role_permissions()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  protected_cols text[] := ARRAY[
    'role', 'permissions',
    'subscription_plan', 'subscription_status', 'subscription_start',
    'subscription_end', 'billing_cycle', 'payment_method', 'card_details',
    'paystack_sub_code', 'paystack_customer_code',
    'referral_count'
    -- referral_code / referred_by are intentionally NOT listed: onboarding and
    -- /api/referral write them with the user's own session.
  ];
  old_j jsonb := to_jsonb(OLD);
  new_j jsonb := to_jsonb(NEW);
  col   text;
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    FOREACH col IN ARRAY protected_cols LOOP
      IF (new_j -> col) IS DISTINCT FROM (old_j -> col) THEN
        RAISE EXCEPTION 'Column "%" cannot be modified by clients', col
          USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_profile_role_permissions ON public.profiles;
CREATE TRIGGER check_profile_role_permissions
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_role_permissions();


-- ── 2. summit_registrations: inserts/deletes go through the API only ────────
-- own_insert allowed a signed-in user to insert a row with
-- payment_status = 'paid'. Registration is created by /api/summit/register
-- (service role), so no client write policy is needed.
DROP POLICY IF EXISTS own_insert ON public.summit_registrations;
DROP POLICY IF EXISTS own_delete ON public.summit_registrations;


-- ── 3. payment_attempts ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference  text NOT NULL,
  status     text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_attempts
  ADD COLUMN IF NOT EXISTS kind             text NOT NULL DEFAULT 'subscription', -- subscription | summit
  ADD COLUMN IF NOT EXISTS user_id          uuid,
  ADD COLUMN IF NOT EXISTS plan_id          text,
  ADD COLUMN IF NOT EXISTS billing          text,
  ADD COLUMN IF NOT EXISTS registration_id  uuid,
  ADD COLUMN IF NOT EXISTS email            text,
  ADD COLUMN IF NOT EXISTS amount_kobo      bigint,
  ADD COLUMN IF NOT EXISTS currency         text NOT NULL DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS provider_tx_id   text,
  ADD COLUMN IF NOT EXISTS provider_status  text,
  ADD COLUMN IF NOT EXISTS failure_reason   text,
  ADD COLUMN IF NOT EXISTS paid_at          timestamptz,
  ADD COLUMN IF NOT EXISTS abandoned_at     timestamptz,
  ADD COLUMN IF NOT EXISTS admin_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS recovery_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz NOT NULL DEFAULT now();

-- Summit attempts have no user_id / plan / billing.
ALTER TABLE public.payment_attempts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.payment_attempts ALTER COLUMN plan_id DROP NOT NULL;
ALTER TABLE public.payment_attempts ALTER COLUMN billing DROP NOT NULL;

-- status: pending | success | failed | abandoned | duplicate
CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_reference_key
  ON public.payment_attempts (reference);
CREATE INDEX IF NOT EXISTS payment_attempts_status_created_idx
  ON public.payment_attempts (status, created_at);
CREATE INDEX IF NOT EXISTS payment_attempts_registration_idx
  ON public.payment_attempts (registration_id) WHERE registration_id IS NOT NULL;

-- Clients never touch this table. Admins can read it (dashboard); API routes
-- use the service role, which bypasses RLS.
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_all ON public.payment_attempts;
CREATE POLICY admin_all ON public.payment_attempts
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ── 4. password_reset_otps ──────────────────────────────────────────────────
-- The table may not exist yet (20260909_password_reset_otp.sql was never run in
-- some environments), so create it here. otp_code stores an HMAC hash, not the
-- plaintext code.
CREATE TABLE IF NOT EXISTS public.password_reset_otps (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  otp_code   text NOT NULL,
  expires_at timestamptz NOT NULL,
  used       boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.password_reset_otps
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

-- Clients never read or write this table; API routes use the service role,
-- which bypasses RLS. Enabling RLS with no policies denies all client access.
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own OTPs" ON public.password_reset_otps;

-- Invalidate every code issued before this migration (they are plaintext).
UPDATE public.password_reset_otps SET used = true WHERE used IS DISTINCT FROM true;

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email_created
  ON public.password_reset_otps (email, created_at DESC);
