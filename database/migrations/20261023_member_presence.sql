-- 20261023_member_presence.sql
-- Online presence, restricted AT THE DATA LEVEL.
--
-- Until now presence used one shared Realtime channel, so any signed-in client could list every online member id.
-- This table replaces it: each member's browser writes its own "last seen" row every ~45 seconds while the tab is
-- visible, and row-level security only lets you READ the rows of people you are allowed to message:
--   - members of a Circle you sit in (circle_seats), and
--   - people you have an accepted direct-message conversation with,
-- never anyone you have blocked or who blocked you. Everyone else's rows are invisible to the query itself.
--
-- Additive and safe to re-run: creates a table, a function and policies. Nothing existing is changed or removed.

create table if not exists public.member_presence (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

create or replace function public.can_see_presence(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and target is not null
     and target <> auth.uid()
     and (
       exists (
         select 1 from public.dm_threads t
          where t.status = 'accepted'
            and ((t.user_a = auth.uid() and t.user_b = target) or (t.user_b = auth.uid() and t.user_a = target))
       )
       or exists (
         select 1 from public.circle_seats a join public.circle_seats b on a.circle_id = b.circle_id
          where a.user_id = auth.uid() and b.user_id = target
       )
     )
     and not exists (
       select 1 from public.dm_blocks k
        where (k.blocker_id = auth.uid() and k.blocked_id = target)
           or (k.blocker_id = target and k.blocked_id = auth.uid())
     );
$$;

revoke all on function public.can_see_presence(uuid) from public, anon;
grant execute on function public.can_see_presence(uuid) to authenticated;

alter table public.member_presence enable row level security;

do $$ begin
  create policy member_presence_select on public.member_presence for select to authenticated
    using (user_id = auth.uid() or public.can_see_presence(user_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy member_presence_insert on public.member_presence for insert to authenticated
    with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy member_presence_update on public.member_presence for update to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

grant select, insert, update on public.member_presence to authenticated;
