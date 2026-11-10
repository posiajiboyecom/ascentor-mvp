-- 20261110b_rx_lessons_hosted_video.sql
-- Pathway lessons (rx_lessons) can point at a self-hosted R2/HLS video
-- (ascentor_videos, see 20261110_self_hosted_video.sql). When set and the
-- video is ready, the lesson plays it in Ascentor's own player; otherwise
-- it falls back to video_url (YouTube/Vimeo/file). Additive only.

alter table public.rx_lessons add column if not exists video_id uuid
  references public.ascentor_videos(id) on delete set null;

create index if not exists rx_lessons_video_id_idx on public.rx_lessons (video_id);
