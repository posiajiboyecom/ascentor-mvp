-- 20261026a_billing_v2.sql
-- Billing v2 (see docs/billing-v2-design.md). ADDITIVE ONLY: new tables and columns, RLS on, no policies (the server uses the
-- service role). Nothing here changes or deletes existing data. Safe to re-run.

-- Saved cards. auth_enc is the Paystack authorization code encrypted with lib/crypto.ts; it never leaves the server.
create table if not exists public.payment_methods (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  paystack_customer_code  text,
  auth_enc                text not null,
  signature               text,
  brand                   text,
  last4                   text,
  exp_month               text,
  exp_year                text,
  bank                    text,
  card_type               text,
  country_code            text,
  reusable                boolean not null default true,
  is_default              boolean not null default false,
  created_at              timestamptz not null default now(),
  removed_at              timestamptz
);
create index if not exists payment_methods_user_idx on public.payment_methods (user_id) where removed_at is null;
create unique index if not exists payment_methods_user_sig_uidx on public.payment_methods (user_id, signature) where removed_at is null and signature is not null;
create unique index if not exists payment_methods_one_default_uidx on public.payment_methods (user_id) where is_default and removed_at is null;
alter table public.payment_methods enable row level security;

-- One subscription per member for the v2 engine. Legacy members have no row and keep their current access.
create table if not exists public.member_subscriptions (
  user_id                  uuid primary key references auth.users(id) on delete cascade,
  plan_code                text not null,
  tier                     text not null check (tier in ('explorer','builder')),
  price_type               text not null default 'solo' check (price_type in ('solo','group')),
  cycle                    text not null default 'monthly' check (cycle in ('monthly','yearly')),
  state                    text not null default 'trial' check (state in ('trial','active','grace','lapsed','cancelled')),
  trial_ends_at            timestamptz,
  next_charge_at           timestamptz,
  period_end               timestamptz,
  payment_method_id        uuid references public.payment_methods(id) on delete set null,
  failed_count             integer not null default 0,
  last_failed_at           timestamptz,
  grace_ends_at            timestamptz,
  extension_used           boolean not null default false,
  cancel_at_period_end     boolean not null default false,
  started_at               timestamptz not null default now(),
  last_charge_at           timestamptz,
  last_charge_ref          text,
  locked_group_price_until timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists member_subscriptions_due_idx on public.member_subscriptions (next_charge_at) where state in ('trial','active','grace');
alter table public.member_subscriptions enable row level security;

-- Every billing event, for audit and for the admin screens.
create table if not exists public.billing_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  type        text not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists billing_events_user_idx on public.billing_events (user_id, created_at desc);
create index if not exists billing_events_type_idx on public.billing_events (type, created_at desc);
alter table public.billing_events enable row level security;

-- Groups (3 or more active members get the group price).
create table if not exists public.billing_groups (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  link_token   text not null unique,
  created_by   uuid references auth.users(id) on delete set null,
  status       text not null default 'forming' check (status in ('forming','active','broken')),
  flagged      boolean not null default false,
  flag_reason  text,
  created_at   timestamptz not null default now()
);
alter table public.billing_groups enable row level security;

create table if not exists public.billing_group_members (
  group_id   uuid not null references public.billing_groups(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  left_at    timestamptz,
  plan_code  text,
  primary key (group_id, user_id, joined_at)
);
create unique index if not exists billing_group_members_one_active_uidx on public.billing_group_members (user_id) where left_at is null;
create index if not exists billing_group_members_group_idx on public.billing_group_members (group_id) where left_at is null;
alter table public.billing_group_members enable row level security;

-- Referral credit in kobo. Positive = earned, negative = used / expired / cancelled.
create table if not exists public.credit_ledger (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  amount_kobo         integer not null,
  reason              text not null check (reason in ('referral_earned','used','expired','cancelled')),
  source_referral_id  uuid,
  source_payment_ref  text,
  expires_at          timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists credit_ledger_user_idx on public.credit_ledger (user_id, created_at);
alter table public.credit_ledger enable row level security;

-- Referrals: when credit was granted (after the first paid charge clears and the 14-day window passes).
alter table public.referrals add column if not exists credit_earned_at timestamptz;

-- Leaders are free while they facilitate (set by an accepted facilitator invite; see docs/leader-invites.md).
alter table public.profiles add column if not exists leader_free boolean not null default false;
