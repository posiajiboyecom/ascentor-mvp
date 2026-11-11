-- Partner billing is retired: partners have no plan (Starter/Growth/Pro), pay Ascentor nothing, and do not charge
-- their own members through Ascentor. The partner platform itself (brand, members, courses, events, AI persona) stays.
-- Before this ran: 1 partner (Demo Coaching), 1 unpaid partner subscription, 0 partner transactions.

-- 1. Back up everything removed, as JSON, in one table only the server can read.
create table if not exists public.partner_billing_retired (
  id          bigserial primary key,
  source      text        not null,
  row_data    jsonb       not null,
  retired_at  timestamptz not null default now()
);
alter table public.partner_billing_retired enable row level security;
revoke all on public.partner_billing_retired from anon, authenticated;

insert into public.partner_billing_retired (source, row_data)
select 'partner_subscriptions', to_jsonb(s) from public.partner_subscriptions s;
insert into public.partner_billing_retired (source, row_data)
select 'partner_transactions', to_jsonb(t) from public.partner_transactions t;
insert into public.partner_billing_retired (source, row_data)
select 'partners.billing_columns', jsonb_build_object(
  'partner_id', id, 'plan_tier', plan_tier, 'revenue_share_percent', revenue_share_percent,
  'plan_overrides', plan_overrides, 'has_paystack_secret_key', paystack_secret_key is not null,
  'has_paystack_secret_key_enc', paystack_secret_key_enc is not null, 'paystack_public_key', paystack_public_key,
  'paystack_subaccount_code', paystack_subaccount_code)
from public.partners;

-- 2. Drop the billing tables.
drop table public.partner_transactions;
drop table public.partner_subscriptions;

-- 3. Drop the billing columns on partners (secret keys are not backed up, only whether one existed).
alter table public.partners
  drop column plan_tier,
  drop column revenue_share_percent,
  drop column plan_overrides,
  drop column paystack_secret_key,
  drop column paystack_secret_key_enc,
  drop column paystack_public_key,
  drop column paystack_subaccount_code;

-- 4. With no tiers, every partner can run its own courses and events.
update public.partners
set features = coalesce(features, '{}'::jsonb) || '{"own_courses": true, "own_events": true}'::jsonb,
    updated_at = now();
