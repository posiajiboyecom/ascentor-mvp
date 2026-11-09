-- Elevation Summit referrals. Additive and idempotent. Run in the Supabase SQL editor, or:
--   npx tsx scripts/apply-migration.ts database/migrations/20261111_summit_referrals.sql --yes
--
-- Each registrant gets a random referral_code. A signup through someone's link is stored in summit_referrals and counts for
-- the referrer only after the new person clicks the link in their confirmation email (email_verified_at). Raw IP addresses are
-- never stored: only a salted hash. Only the service role reads or writes these (RLS on, no policies).

ALTER TABLE public.summit_registrations
  ADD COLUMN IF NOT EXISTS referral_code        text,
  ADD COLUMN IF NOT EXISTS email_normalised     text,
  ADD COLUMN IF NOT EXISTS whatsapp_normalised  text,
  ADD COLUMN IF NOT EXISTS signup_ip_hash       text,
  ADD COLUMN IF NOT EXISTS signup_device_hash   text,
  ADD COLUMN IF NOT EXISTS email_verified_at    timestamptz,
  ADD COLUMN IF NOT EXISTS attended_at          timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS summit_registrations_referral_code_key ON public.summit_registrations (referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS summit_registrations_email_norm_idx ON public.summit_registrations (email_normalised);
CREATE INDEX IF NOT EXISTS summit_registrations_ip_hash_idx   ON public.summit_registrations (signup_ip_hash, created_at);

-- Existing registrants: a code each (8 characters, no look-alikes: no 0/O/1/I/L).
DO $$
DECLARE r record; c text; alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
BEGIN
  FOR r IN SELECT id FROM public.summit_registrations WHERE referral_code IS NULL LOOP
    LOOP
      c := '';
      FOR i IN 1..8 LOOP c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.summit_registrations WHERE referral_code = c);
    END LOOP;
    UPDATE public.summit_registrations SET referral_code = c WHERE id = r.id;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.summit_referrals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id  uuid NOT NULL REFERENCES public.summit_registrations(id) ON DELETE CASCADE,
  referred_id  uuid NOT NULL UNIQUE REFERENCES public.summit_registrations(id) ON DELETE CASCADE,
  -- pending: signed up, email not yet confirmed | verified: counts | flagged: held for an admin | rejected / reversed: does not count
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'flagged', 'rejected', 'reversed')),
  reason       text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  verified_at  timestamptz,
  reviewed_by  uuid,
  reviewed_at  timestamptz,
  CHECK (referrer_id <> referred_id)
);
CREATE INDEX IF NOT EXISTS summit_referrals_referrer_idx ON public.summit_referrals (referrer_id, status);

ALTER TABLE public.summit_referrals ENABLE ROW LEVEL SECURITY;
