-- Volunteer ("guest") access to the Summit entrance check-in, at /door. One row: whether it is on, the door code
-- volunteers type, and a version that changes whenever the code changes, so a new code signs every volunteer out.
-- Server-only: RLS on and no policies, so only the service role (the app's server code) can read or change it.
create table if not exists public.summit_door_access (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,
  code text not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.summit_door_access enable row level security;
revoke all on public.summit_door_access from anon, authenticated;

-- Volunteers have no Ascentor account, so record who scanned by name as well.
alter table public.summit_registrations add column if not exists checked_in_by_name text;
