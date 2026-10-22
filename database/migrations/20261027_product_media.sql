-- Product media: a hover picture and a gallery (pictures and GIFs) next to the cover image.
-- Additive and safe to run more than once.
alter table public.products add column if not exists hover_image_url text;
alter table public.products add column if not exists gallery_urls text[];
