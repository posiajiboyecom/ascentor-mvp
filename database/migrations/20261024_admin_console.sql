-- 20261024_admin_console.sql
-- Admin console (built to the admin prototype): roles are DATA, one role per teammate, and a role sets a level for every
-- admin area (none / view / edit / full). The server checks the level on every action; this migration only stores it.
--
--   admin_roles           id, name, locked, levels {area: 'view'|'edit'|'full'} (an area missing from levels = no access)
--   profiles.admin_role   which role a teammate has (NULL = fall back from profiles.role: admin -> admin, moderator -> moderator)
--
-- Additive and safe to re-run. Nothing is removed or rewritten. RLS is on with NO policies, so only the server
-- (service role) can read or write roles: a browser can never edit its own access.

create table if not exists public.admin_roles (
  id          text primary key,
  name        text not null,
  locked      boolean not null default false,
  levels      jsonb not null default '{}'::jsonb,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.admin_roles enable row level security;

insert into public.admin_roles (id, name, locked, levels, sort_order) values
  ('admin', 'Admin', true, '{}'::jsonb, 0),
  ('moderator', 'Moderator', false,
    '{"overview":"view","members":"view","mentors":"edit","circles":"edit","matching":"edit","mentorship":"view","groups":"edit","cities":"edit","meetups":"edit","categories":"edit","announcements":"edit","moderation":"full","pathways":"edit","knowledge":"edit","blog":"edit","newsletter":"edit","intel":"view","reports":"view"}'::jsonb, 1),
  ('community', 'Community manager', false,
    '{"overview":"view","recs":"edit","members":"view","mentors":"view","circles":"edit","matching":"edit","mentorship":"edit","groups":"edit","cities":"edit","meetups":"edit","categories":"edit","announcements":"edit","broadcasts":"edit","moderation":"full","chats":"view","analysis":"view"}'::jsonb, 2),
  ('finance', 'Finance', false,
    '{"overview":"view","members":"view","payments":"full","plans":"edit","promos":"edit","referrals":"edit","products":"view","orders":"full","registrations":"view","donations":"full","reports":"full"}'::jsonb, 3),
  ('summit', 'Summit team', false,
    '{"overview":"view","announcements":"edit","orders":"view","registrations":"full","donations":"view","livestream":"full","events":"edit"}'::jsonb, 4)
on conflict (id) do nothing;

alter table public.profiles add column if not exists admin_role text;

-- A member must never be able to change their own role, level or bonus days from the browser. The existing guard trigger
-- (see 20260919_payment_security.sql) lists protected columns; this replaces ONLY that function to add two more.
create or replace function public.check_profile_role_permissions()
returns trigger
language plpgsql as $$
declare
  protected_cols text[] := array[
    'role', 'permissions', 'admin_role',
    'subscription_plan', 'subscription_status', 'subscription_start',
    'subscription_end', 'billing_cycle', 'payment_method', 'card_details',
    'paystack_sub_code', 'paystack_customer_code',
    'referral_count', 'referral_bonus_days'
    -- referral_code / referred_by are intentionally NOT listed: onboarding and
    -- /api/referral write them with the user's own session.
  ];
  old_j jsonb := to_jsonb(OLD);
  new_j jsonb := to_jsonb(NEW);
  col   text;
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    foreach col in array protected_cols loop
      if (new_j -> col) is distinct from (old_j -> col) then
        raise exception 'Column "%" cannot be modified by clients', col
          using errcode = '42501';
      end if;
    end loop;
  end if;

  return new;
end;
$$;
