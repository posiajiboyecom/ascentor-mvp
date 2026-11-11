-- 20261111_retire_old_billing_plans.sql  (applied to production 2026-11-11)
-- Ascentor sells two plans through Billing v2: Seeker ('explorer') and Builder. Retire every plan granted by the
-- old billing system: profiles still marked paid with no Billing v2 subscription (none has a payment on record).
-- Their previous values are kept in billing_v1_retired_profiles so this can be undone.
create table if not exists public.billing_v1_retired_profiles (
  user_id uuid primary key,
  subscription_plan text,
  subscription_status text,
  subscription_end timestamptz,
  retired_at timestamptz not null default now()
);
alter table public.billing_v1_retired_profiles enable row level security;

insert into public.billing_v1_retired_profiles (user_id, subscription_plan, subscription_status, subscription_end)
select p.id, p.subscription_plan, p.subscription_status, p.subscription_end
from public.profiles p
where coalesce(p.subscription_plan, 'free') not in ('free', 'none', '', 'leader')
  and not exists (select 1 from public.member_subscriptions m where m.user_id = p.id)
on conflict (user_id) do nothing;

update public.profiles p
set subscription_plan = 'free', subscription_status = 'free', updated_at = now()
where coalesce(p.subscription_plan, 'free') not in ('free', 'none', '', 'leader')
  and not exists (select 1 from public.member_subscriptions m where m.user_id = p.id);

-- The checkout switch was saved as off but never took effect (checkout has been open). Record what members actually get.
update public.platform_settings set value = 'true', updated_at = now() where key = 'checkout_enabled';
