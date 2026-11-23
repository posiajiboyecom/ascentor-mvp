-- Mentor invites: one personal, single-use, expiring link per mentor, created by an admin. Opening the link lets the
-- person join straight as a mentor (no member sign-up, onboarding, plan or Circle). Only a SHA-256 hash of the token
-- is stored. Additive only. Accessed with the service role, so RLS is on with no policies.
create table if not exists public.mentor_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  token_hash text not null unique,
  status text not null default 'sent' check (status in ('sent','used','expired','revoked')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  last_sent_at timestamptz,
  send_count int not null default 0
);
create index if not exists mentor_invites_email_idx on public.mentor_invites (lower(email));
alter table public.mentor_invites enable row level security;
