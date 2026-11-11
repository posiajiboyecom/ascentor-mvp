-- 20261111b_pinnacle_tier.sql
-- Pinnacle: the third paid tier, above Builder (lib/billing/catalog.ts).
--   1. member_subscriptions and expert_sessions accept 'pinnacle'.
--   2. private_mentor_sessions: one private 20-minute mentor session a month for Pinnacle members.
--   3. call_attendance can record a private session (no Circle).
--   4. contact_messages remembers the signed-in sender and flags Pinnacle members as priority.
--   5. sage_messages index for the daily Sage message count.

-- 1 ── tiers ────────────────────────────────────────────────────────────────
alter table public.member_subscriptions drop constraint if exists member_subscriptions_tier_check;
alter table public.member_subscriptions add constraint member_subscriptions_tier_check check (tier in ('explorer','builder','pinnacle'));

alter table public.expert_sessions drop constraint if exists expert_sessions_plan_tier_check;
alter table public.expert_sessions add constraint expert_sessions_plan_tier_check check (plan_tier in ('free','explorer','builder','pinnacle','climber'));

-- 2 ── private mentor sessions ──────────────────────────────────────────────
create table if not exists public.private_mentor_sessions (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references auth.users(id) on delete cascade,
  mentor_id     uuid not null references public.human_mentors(id) on delete cascade,
  slot_id       uuid references public.mentor_slots(id) on delete set null,
  starts_at     timestamptz not null,
  duration_min  integer not null default 20 check (duration_min between 5 and 60),
  agenda        text not null check (char_length(agenda) between 10 and 1200),
  status        text not null default 'scheduled' check (status in ('scheduled','cancelled','completed')),
  cancelled_by  text check (cancelled_by in ('member','mentor','admin')),
  cancel_reason text,
  cancelled_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists pms_member_idx on public.private_mentor_sessions (member_id, starts_at desc);
create index if not exists pms_mentor_idx on public.private_mentor_sessions (mentor_id, starts_at);
-- One live (not cancelled) session per member per calendar month (UTC), so a double click can never book two.
create unique index if not exists pms_one_per_month on public.private_mentor_sessions
  (member_id, (date_trunc('month', starts_at at time zone 'UTC'))) where status <> 'cancelled';

alter table public.private_mentor_sessions enable row level security;
revoke all on public.private_mentor_sessions from anon;
drop policy if exists pms_read on public.private_mentor_sessions;
create policy pms_read on public.private_mentor_sessions for select to authenticated using (
  member_id = (select auth.uid())
  or mentor_id in (select hm.id from public.human_mentors hm where hm.user_id = (select auth.uid()))
);
-- Writes go through server actions with the service role, after the rules are checked.

-- 3 ── call attendance for private sessions ─────────────────────────────────
alter table public.call_attendance alter column circle_id drop not null;
alter table public.call_attendance add column if not exists private_session_id uuid references public.private_mentor_sessions(id) on delete cascade;
alter table public.call_attendance drop constraint if exists call_attendance_kind_check;
alter table public.call_attendance add constraint call_attendance_kind_check check (kind in ('circle','mentor','private'));
alter table public.call_attendance drop constraint if exists call_attendance_target_check;
alter table public.call_attendance add constraint call_attendance_target_check check (
  (kind = 'private' and private_session_id is not null) or (kind <> 'private' and circle_id is not null)
);

-- 4 ── priority support ─────────────────────────────────────────────────────
alter table public.contact_messages add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.contact_messages add column if not exists priority boolean not null default false;
create index if not exists contact_messages_priority_idx on public.contact_messages (priority desc, created_at desc);

-- 5 ── daily Sage count ─────────────────────────────────────────────────────
create index if not exists sage_messages_user_day_idx on public.sage_messages (user_id, created_at) where role = 'user';
