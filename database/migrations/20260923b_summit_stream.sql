-- ============================================================================
-- 20260923b_summit_stream.sql   (idempotent, safe to re-run)
--
-- Elevation Summit livestream: a public page where a registrant enters their
-- email, and if it belongs to a PAID registration, they get the embedded
-- YouTube stream. Admin can also email the watch-page link to confirmed
-- virtual attendees only.
--
-- Settings live in the existing platform_settings key/value table (the same
-- one checkout_enabled already uses) - no new table needed:
--   summit_stream_enabled   'true' | 'false'  - whether the watch page shows
--                                                the stream or a "not live yet" message
--   summit_stream_video_id  a specific YouTube video id to embed, or '' to
--                                                fall back to auto-embedding
--                                                whatever is currently live on
--                                                the Ascentor channel
-- ============================================================================

ALTER TABLE public.summit_registrations
  ADD COLUMN IF NOT EXISTS stream_access_sent_at timestamptz;

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.platform_settings (key, value)
VALUES ('summit_stream_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.platform_settings (key, value)
VALUES ('summit_stream_video_id', '')
ON CONFLICT (key) DO NOTHING;
