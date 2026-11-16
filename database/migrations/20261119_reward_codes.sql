-- 20261119_reward_codes.sql
-- Reward codes: one-use codes that give a member a paid plan for a set number of months, with no card and no charge.
-- First use: Elevation Summit referral winners (10+ confirmed referrals) get Builder for 2 months, or 3 months for
-- the people an admin marks "above and beyond". Codes are created, emailed and redeemed by server code only
-- (lib/rewards/access-codes.ts) with the service role; members never read this table directly.

create table if not exists public.access_codes (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  tier             text not null default 'builder' check (tier in ('explorer','builder','pinnacle')),
  months           integer not null check (months between 1 and 24),
  source           text not null default 'manual',
  -- The Summit registration this code rewards (one code per winner).
  registration_id  uuid unique references public.summit_registrations(id) on delete set null,
  recipient_name   text,
  recipient_email  text,
  above_and_beyond boolean not null default false,
  emailed_at       timestamptz,
  emailed_months   integer,
  redeem_by        timestamptz,
  redeemed_by      uuid references auth.users(id) on delete set null,
  redeemed_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists access_codes_redeemed_by_idx on public.access_codes (redeemed_by);
alter table public.access_codes enable row level security;
-- No policies on purpose: only the service role (server code) reads or writes codes.
revoke all on public.access_codes from anon, authenticated;

-- A subscription that came from a reward, so billing screens can say so (and never offer to "resume" it).
alter table public.member_subscriptions add column if not exists gift_source text;
