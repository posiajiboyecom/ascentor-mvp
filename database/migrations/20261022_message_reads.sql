-- 20261022_message_reads.sql
-- NOT APPLIED. Run in the Supabase SQL editor. Additive and safe to run more than once.
--
-- Read tracking for direct messages: one row per member per conversation, holding when that member last
-- opened it. A conversation is "unread" for a member when its latest message came from the other person
-- and is newer than last_read_at (or there is no row). Without this table the app shows no unread state
-- and nothing breaks.

create table if not exists public.dm_reads (
  thread_id    uuid not null references public.dm_threads(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

alter table public.dm_reads enable row level security;

drop policy if exists dm_reads_own_select on public.dm_reads;
create policy dm_reads_own_select on public.dm_reads for select to authenticated using (user_id = auth.uid());

drop policy if exists dm_reads_own_insert on public.dm_reads;
create policy dm_reads_own_insert on public.dm_reads for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.dm_threads t where t.id = thread_id and auth.uid() in (t.user_a, t.user_b)));

drop policy if exists dm_reads_own_update on public.dm_reads;
create policy dm_reads_own_update on public.dm_reads for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The other person in a conversation can see that you have read it ("Seen"): allow reading the other
-- participant's row for threads you are in.
drop policy if exists dm_reads_peer_select on public.dm_reads;
create policy dm_reads_peer_select on public.dm_reads for select to authenticated
  using (exists (select 1 from public.dm_threads t where t.id = thread_id and auth.uid() in (t.user_a, t.user_b)));
