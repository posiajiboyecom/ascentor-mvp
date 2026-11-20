-- 20261120_summit_free_year.sql
-- Elevation Summit attendees get Ascentor Builder free for 12 months. This is the approved list: only an email on it can
-- claim at /summit-access (email -> 6-digit code -> password). Server-only: RLS on, no policies.
create table if not exists public.summit_access_grants (
  email           text primary key check (email = lower(email) and email like '%@%'),
  name            text,
  source          text not null default 'admin' check (source in ('emailed', 'checked_in', 'admin')),
  tier            text not null default 'builder' check (tier in ('builder')),
  months          int  not null default 12 check (months between 1 and 24),
  note            text,
  added_by        uuid references auth.users(id) on delete set null,
  added_at        timestamptz not null default now(),
  invited_at      timestamptz,
  claimed_user_id uuid references auth.users(id) on delete set null,
  claimed_at      timestamptz,
  access_until    timestamptz,
  revoked_at      timestamptz
);
create index if not exists summit_access_grants_open_idx on public.summit_access_grants (added_at desc) where revoked_at is null;
alter table public.summit_access_grants enable row level security;
