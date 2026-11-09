-- Track when the 2-hour referral invite email was sent.
-- Additive and idempotent. Run in Supabase SQL editor or:
--   npx tsx scripts/apply-migration.ts database/migrations/20261109_referral_invite_email.sql --yes

ALTER TABLE public.summit_registrations
  ADD COLUMN IF NOT EXISTS referral_invite_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS summit_registrations_referral_invite_idx
  ON public.summit_registrations (confirmed_at)
  WHERE referral_invite_sent_at IS NULL AND payment_status = 'paid';
