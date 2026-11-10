-- 20261110_self_hosted_video.sql
-- Self-hosted video on Cloudflare R2 (HLS), replacing YouTube embeds.
--
--   ascentor_videos  one row per uploaded video. The admin uploads the
--                    original MP4 straight to R2 (presigned PUT); a
--                    Trigger.dev job transcodes it to HLS and flips
--                    status to 'ready' with hls_url set.
--   courses.video_id / lessons.video_id  point at the video to play.
--   video_progress   per-user resume position, keyed by (user, video).
--                    Kept separate from user_progress because that
--                    table requires a lesson_id, and single-video
--                    courses have no lesson rows.

create table if not exists public.ascentor_videos (
  id                uuid primary key default gen_random_uuid(),
  title             text not null default '',
  status            text not null default 'uploading'
                    check (status in ('uploading', 'processing', 'ready', 'failed')),
  source_key        text not null,          -- R2 key of the original upload
  hls_url           text,                   -- public URL of master.m3u8
  thumbnail_url     text,
  duration_seconds  integer,
  width             integer,
  height            integer,
  size_bytes        bigint,
  error             text,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists ascentor_videos_status_idx on public.ascentor_videos (status);

alter table public.ascentor_videos enable row level security;

drop policy if exists ascentor_videos_read_ready on public.ascentor_videos;
create policy ascentor_videos_read_ready on public.ascentor_videos
  for select to authenticated
  using (status = 'ready' or (select public.is_admin()));

drop policy if exists ascentor_videos_admin_all on public.ascentor_videos;
create policy ascentor_videos_admin_all on public.ascentor_videos
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

alter table public.courses add column if not exists video_id uuid
  references public.ascentor_videos(id) on delete set null;
alter table public.lessons add column if not exists video_id uuid
  references public.ascentor_videos(id) on delete set null;

create index if not exists courses_video_id_idx on public.courses (video_id);
create index if not exists lessons_video_id_idx on public.lessons (video_id);

create table if not exists public.video_progress (
  user_id           uuid not null references public.profiles(id) on delete cascade,
  video_id          uuid not null references public.ascentor_videos(id) on delete cascade,
  position_seconds  real not null default 0,
  duration_seconds  real,
  percent           integer not null default 0 check (percent between 0 and 100),
  completed         boolean not null default false,
  updated_at        timestamptz not null default now(),
  primary key (user_id, video_id)
);

create index if not exists video_progress_video_id_idx on public.video_progress (video_id);

alter table public.video_progress enable row level security;

drop policy if exists video_progress_own on public.video_progress;
create policy video_progress_own on public.video_progress
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists video_progress_admin_read on public.video_progress;
create policy video_progress_admin_read on public.video_progress
  for select to authenticated
  using ((select public.is_admin()));
