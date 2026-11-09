-- Add thumbnail_url to both lesson tables so admins can upload a poster image for each lesson.
-- Thumbnail dimensions: 1280×720px, 16:9 ratio, JPG or PNG, under 500 KB.
-- Stored as a URL (Supabase Storage public URL or external CDN link).

-- rx_lessons: the main member-app pathway lessons
ALTER TABLE public.rx_lessons ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- lessons: the partner/course catalogue lessons
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS thumbnail_url text;
