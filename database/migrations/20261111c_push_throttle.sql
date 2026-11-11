-- 20261111c_push_throttle.sql
-- Chat pushes (lib/rx/chat-push.ts): when each member last got a push for a chat, so a busy Circle or group chat
-- buzzes at most once every few minutes instead of on every message. Server-only (service role).
create table if not exists public.push_throttle (
  user_id uuid not null references auth.users(id) on delete cascade,
  key     text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.push_throttle enable row level security;
revoke all on public.push_throttle from anon, authenticated;
