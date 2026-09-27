-- ============================================================================
-- 20260927_summit_donations.sql   (idempotent, safe to re-run)
--
-- New public /donate page. Donations are captured through the SAME Paystack
-- flow and the SAME payment_attempts table already used for Summit tickets
-- and subscriptions (kind = 'donation'), settled by the same
-- lib/paymentSettlement.ts::settleReference().
--
-- summit_donations holds the donor's own details (name, email, phone,
-- message) plus the outcome of the payment. payment_attempts still records
-- amount/currency/provider fields; donation_id links the two the same way
-- registration_id links a summit attempt to summit_registrations.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.summit_donations (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name                text NOT NULL,
  email                    text NOT NULL,
  phone                    text NOT NULL,
  amount                   numeric,
  currency                 text DEFAULT 'NGN',
  payment_reference        text UNIQUE,
  payment_provider_tx_id   text,
  paystack_fee             numeric,
  status                   text NOT NULL DEFAULT 'pending', -- pending | paid | failed | abandoned
  message                  text,
  paid_at                  timestamptz,
  receipt_email_sent_at    timestamptz,
  receipt_email_error      text,
  admin_notified_at        timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_summit_donations_email      ON public.summit_donations (email);
CREATE INDEX IF NOT EXISTS idx_summit_donations_status     ON public.summit_donations (status, created_at);
CREATE INDEX IF NOT EXISTS idx_summit_donations_reference  ON public.summit_donations (payment_reference);

-- Clients never touch this table directly. Admins can read it (dashboard);
-- API routes use the service role, which bypasses RLS.
ALTER TABLE public.summit_donations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_all ON public.summit_donations;
CREATE POLICY admin_all ON public.summit_donations
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Link payment_attempts (kind = 'donation') back to summit_donations, the
-- same pattern registration_id already uses for kind = 'summit'.
ALTER TABLE public.payment_attempts
  ADD COLUMN IF NOT EXISTS donation_id uuid;

CREATE INDEX IF NOT EXISTS payment_attempts_donation_idx
  ON public.payment_attempts (donation_id) WHERE donation_id IS NOT NULL;

-- Complimentary tickets: summit_registrations.payment_status gains a third
-- real value, 'comp' (admin manually issued a ticket without payment),
-- alongside the existing 'pending' | 'paid' | 'failed' | 'refunded'. No CHECK
-- constraint exists on this column, so no schema change is required for the
-- value itself -- this comment documents the addition for anyone reading the
-- migrations in order. See lib/paymentSettlement.ts and
-- app/api/summit/stream/verify/route.ts, which now treat 'paid' and 'comp'
-- as equally entitled to the livestream, while revenue stats still count
-- 'paid' only.
