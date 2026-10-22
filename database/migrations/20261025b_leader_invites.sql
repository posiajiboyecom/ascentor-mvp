-- Leader invites: one personal, single-use, expiring link per invitee. Only a SHA-256 hash of the token is stored.
-- Additive only. Accessed with the service role, so RLS is on with no policies.
create table if not exists public.leader_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  token_hash text not null unique,
  status text not null default 'sent' check (status in ('sent','used','expired','revoked')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  last_sent_at timestamptz,
  send_count int default 0
);
create index if not exists leader_invites_email_idx on public.leader_invites (lower(email));
alter table public.leader_invites enable row level security;

-- Leaders lead for free while they facilitate: set true when a Leader invite is accepted.
alter table public.profiles add column if not exists leader_free boolean not null default false;
