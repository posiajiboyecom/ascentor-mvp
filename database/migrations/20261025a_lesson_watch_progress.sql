-- Learn: remember how far each member got through a lesson video, so they can resume and so we can remind them to finish.
-- Additive only. Code degrades gracefully (no resume, no reminders) until this is applied.
alter table public.rx_lesson_progress add column if not exists watch_percent smallint not null default 0;
alter table public.rx_lesson_progress add column if not exists last_position_sec real not null default 0;
alter table public.rx_lesson_progress add column if not exists duration_sec real;
alter table public.rx_lesson_progress add column if not exists reminded_at timestamptz;
