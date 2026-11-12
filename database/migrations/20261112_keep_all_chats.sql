-- 20261112_keep_all_chats.sql
-- Every chat in the app is kept in the database and can be read in admin.
--  1. call_chat_messages: chat typed during a Circle call, a mentor session or a private mentor session (until now it only
--     travelled between the people in the call and was lost when the call ended).
--  2. chat_archive: a copy of any chat message taken just before it is deleted (an admin removing a message, or a Circle or
--     group being deleted). Not kept when the author's own account is being deleted, so erasure requests still work.
-- Both tables are server-only: RLS on, no policies; the app reads and writes them with the service role.

create table if not exists public.call_chat_messages (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null unique,
  call_id            uuid not null,                   -- one call: the mentor or private session id, or a per-day id for a Circle call
  kind               text not null check (kind in ('circle', 'mentor', 'private')),
  circle_id          uuid references public.circles(id) on delete set null,
  mentor_session_id  uuid,
  private_session_id uuid,
  user_id            uuid references auth.users(id) on delete set null,
  sender_name        text not null default '',
  body               text not null check (char_length(body) between 1 and 500),
  created_at         timestamptz not null default now()
);
create index if not exists call_chat_messages_call_idx on public.call_chat_messages (call_id, created_at);
create index if not exists call_chat_messages_user_idx on public.call_chat_messages (user_id, created_at);
create index if not exists call_chat_messages_created_idx on public.call_chat_messages (created_at desc);
alter table public.call_chat_messages enable row level security;

create table if not exists public.chat_archive (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,                           -- the table the message came from
  row_id      uuid,
  author_id   uuid,
  body        text,
  data        jsonb not null,                          -- the whole row as it was
  sent_at     timestamptz,
  archived_at timestamptz not null default now()
);
create index if not exists chat_archive_archived_idx on public.chat_archive (archived_at desc);
create index if not exists chat_archive_author_idx on public.chat_archive (author_id);
alter table public.chat_archive enable row level security;

create or replace function public.archive_chat_row() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare
  r jsonb := to_jsonb(old);
  author uuid := coalesce(nullif(r->>'user_id', ''), nullif(r->>'sender_id', ''))::uuid;
begin
  -- The author's account is being deleted (it is already gone in this transaction): honour the erasure, keep nothing.
  if author is not null and not exists (select 1 from auth.users where id = author) then
    return old;
  end if;
  insert into public.chat_archive (source, row_id, author_id, body, data, sent_at)
  values (tg_table_name, (r->>'id')::uuid, author, coalesce(r->>'body', r->>'content'), r, (r->>'created_at')::timestamptz);
  return old;
end $$;
revoke all on function public.archive_chat_row() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['circle_messages', 'rx_group_messages', 'dm_messages', 'community_messages', 'sage_messages', 'call_chat_messages'] loop
    execute format('drop trigger if exists keep_deleted_chat on public.%I', t);
    execute format('create trigger keep_deleted_chat before delete on public.%I for each row execute function public.archive_chat_row()', t);
  end loop;
end $$;
