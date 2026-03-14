-- ============================================================
-- Ascentor Whitelabel Migration
-- Run once in Supabase SQL editor (Dashboard → SQL Editor)
-- Safe to re-run — all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING
-- ============================================================


-- ── 1. partners table ─────────────────────────────────────────────────────────
-- Core whitelabel partner record. One row per coach/company that white-labels
-- the Ascentor platform. Subdomain + custom_domain drive proxy routing.

CREATE TABLE IF NOT EXISTS partners (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     text NOT NULL,
  slug                     text NOT NULL UNIQUE,
  subdomain                text NOT NULL UNIQUE,
  custom_domain            text UNIQUE,
  status                   text NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','active','suspended','rejected')),
  owner_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  revenue_share_percent    int  NOT NULL DEFAULT 70 CHECK (revenue_share_percent BETWEEN 0 AND 100),
  paystack_subaccount_code text,
  paystack_secret_key_enc  text,                   -- AES-256-GCM encrypted; never store plaintext
  brand                    jsonb NOT NULL DEFAULT '{}'::jsonb,
  features                 jsonb NOT NULL DEFAULT '{"ai_coach":true,"community":true,"experts":false,"courses":true,"referrals":true}'::jsonb,
  ai_config                jsonb DEFAULT '{}'::jsonb,  -- AI persona, knowledge base, tone settings
  plan_overrides           jsonb DEFAULT '{}'::jsonb,
  plan_tier                text  CHECK (plan_tier IN ('standard','pro')),
  onboarded_at             timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Indexes for getPartnerContext lookups (hit on every request)
CREATE INDEX IF NOT EXISTS partners_subdomain_idx     ON partners(subdomain) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS partners_custom_domain_idx ON partners(custom_domain) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS partners_owner_idx         ON partners(owner_id);

-- RLS
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- Partners can read their own row; Ascentor admin (service_role) reads all
CREATE POLICY IF NOT EXISTS "partners_owner_select"
  ON partners FOR SELECT
  USING (owner_id = auth.uid());

-- Only service_role can insert/update (application layer enforces ownership)
-- No user-facing INSERT/UPDATE policies — all mutations go through API routes
-- that use the service role key after verifying ownership in application code.


-- ── 2. partner_members table ──────────────────────────────────────────────────
-- Tracks which users belong to which partner platform.
-- A user can be a member of multiple partners.

CREATE TABLE IF NOT EXISTS partner_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'member' CHECK (role IN ('member','moderator','admin')),
  status      text NOT NULL DEFAULT 'invited'
                CHECK (status IN ('invited','active','suspended','removed')),
  invited_by  uuid REFERENCES auth.users(id),
  invited_at  timestamptz NOT NULL DEFAULT now(),
  joined_at   timestamptz,
  UNIQUE (partner_id, email)
);

CREATE INDEX IF NOT EXISTS partner_members_partner_idx ON partner_members(partner_id);
CREATE INDEX IF NOT EXISTS partner_members_email_idx   ON partner_members(email);

ALTER TABLE partner_members ENABLE ROW LEVEL SECURITY;

-- Partner owners can read their members
CREATE POLICY IF NOT EXISTS "partner_members_owner_select"
  ON partner_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM partners
      WHERE partners.id = partner_members.partner_id
        AND partners.owner_id = auth.uid()
    )
  );

-- Members can read their own membership rows
CREATE POLICY IF NOT EXISTS "partner_members_self_select"
  ON partner_members FOR SELECT
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));


-- ── 3. partner_transactions table ─────────────────────────────────────────────
-- Immutable ledger of every Paystack payment event for partner users.
-- Written by the Paystack webhook handler (app/api/partner/webhook/route.ts).
-- This is the source of truth for partner revenue share calculations.
-- NEVER delete or update rows — append-only. Refunds add a new row with
-- status='refunded' and negative amounts.

CREATE TABLE IF NOT EXISTS partner_transactions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id          uuid NOT NULL REFERENCES partners(id) ON DELETE RESTRICT,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  amount_ngn          numeric(12,2) NOT NULL,
  partner_share_ngn   numeric(12,2) NOT NULL,
  ascentor_fee_ngn    numeric(12,2) NOT NULL,
  revenue_share_pct   int NOT NULL,
  plan                text NOT NULL,
  billing_cycle       text NOT NULL CHECK (billing_cycle IN ('monthly','annual')),
  paystack_reference  text UNIQUE,          -- idempotency key (BUG-07 fix relies on this)
  status              text NOT NULL DEFAULT 'completed'
                        CHECK (status IN ('completed','refunded','disputed')),
  paid_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_tx_partner_idx ON partner_transactions(partner_id);
CREATE INDEX IF NOT EXISTS partner_tx_user_idx    ON partner_transactions(user_id);
CREATE INDEX IF NOT EXISTS partner_tx_ref_idx     ON partner_transactions(paystack_reference);
CREATE INDEX IF NOT EXISTS partner_tx_paid_idx    ON partner_transactions(paid_at DESC);

ALTER TABLE partner_transactions ENABLE ROW LEVEL SECURITY;

-- Partner owners can read their own revenue transactions
CREATE POLICY IF NOT EXISTS "partner_tx_owner_select"
  ON partner_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM partners
      WHERE partners.id = partner_transactions.partner_id
        AND partners.owner_id = auth.uid()
    )
  );

-- No user-level INSERT policy — only service_role (webhook) inserts


-- ── 4. Trigger: auto-update partners.updated_at ───────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partners_updated_at ON partners;
CREATE TRIGGER partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── 5. Verify ─────────────────────────────────────────────────────────────────
-- Run this SELECT after the migration to confirm all three tables exist:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('partners', 'partner_members', 'partner_transactions')
ORDER BY table_name;
-- Expected output: 3 rows
