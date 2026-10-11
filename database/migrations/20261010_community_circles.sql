-- 20261010_community_circles.sql
-- Community becomes a social feed (categories, rich text, media, reactions, threaded comments, shares).
-- Members can sit in up to three Circles. In-app notifications. Demo Circles for testing.
--
-- Additive and idempotent. Apply with:
--   npx tsx scripts/apply-migration.ts database/migrations/20261010_community_circles.sql --yes
-- Note for the statement splitter: no semicolons inside quoted strings in this file.

-- ── Community: categories ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feed_categories (
  slug       text PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  position   integer NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.feed_categories (slug, name, position) VALUES
  ('questions',   'Questions',          1),
  ('wins',        'Wins',               2),
  ('reflections', 'Reflections',        3),
  ('resources',   'Resources',          4),
  ('cyber',       'Cybersecurity',      5),
  ('ai',          'AI and technology',  6),
  ('money',       'Money and business', 7),
  ('careers',     'Careers',            8),
  ('faith',       'Faith and purpose',  9),
  ('wellbeing',   'Wellbeing',         10),
  ('relationships','Relationships',    11)
ON CONFLICT (slug) DO NOTHING;

-- ── Community: posts, comments, reactions, shares ───────────────────────────
ALTER TABLE public.feed_posts ADD COLUMN IF NOT EXISTS category  text;
ALTER TABLE public.feed_posts ADD COLUMN IF NOT EXISTS body_html text;
ALTER TABLE public.feed_posts ADD COLUMN IF NOT EXISTS media     jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS feed_posts_category_idx ON public.feed_posts (category, created_at DESC);

UPDATE public.feed_posts SET category = CASE type
    WHEN 'Win' THEN 'Wins' WHEN 'Question' THEN 'Questions' WHEN 'Resource' THEN 'Resources' WHEN 'Reflection' THEN 'Reflections' ELSE NULL END
  WHERE category IS NULL AND type <> 'Prompt';

ALTER TABLE public.feed_replies ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.feed_replies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS feed_replies_parent_idx ON public.feed_replies (parent_id);

CREATE TABLE IF NOT EXISTS public.feed_reactions (
  post_id    uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind       text NOT NULL DEFAULT 'like' CHECK (kind IN ('like','support','insight')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS feed_reactions_post_idx ON public.feed_reactions (post_id);

CREATE TABLE IF NOT EXISTS public.feed_shares (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target     text NOT NULL CHECK (target IN ('link','circle','person')),
  target_id  uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feed_shares_post_idx ON public.feed_shares (post_id);

-- ── Notifications: the existing in-app table gains what email throttling needs ──
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS emailed_at timestamptz;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS entity_id  uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_id   uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS kind       text;
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

-- ── Circles: interest Circles, several seats per member, demo Circles ───────
ALTER TABLE public.circles ADD COLUMN IF NOT EXISTS interest        text;
ALTER TABLE public.circles ADD COLUMN IF NOT EXISTS is_demo         boolean NOT NULL DEFAULT false;
ALTER TABLE public.circles ADD COLUMN IF NOT EXISTS demo_call_until timestamptz;
ALTER TABLE public.member_profile ADD COLUMN IF NOT EXISTS is_demo  boolean NOT NULL DEFAULT false;
ALTER TABLE public.human_mentors  ADD COLUMN IF NOT EXISTS is_demo  boolean NOT NULL DEFAULT false;

-- A member may now sit in several Circles (the application caps it at three).
DROP INDEX IF EXISTS public.circle_seats_one_member_seat;
CREATE INDEX IF NOT EXISTS circle_seats_user_idx ON public.circle_seats (user_id);

-- Home placement: the first Circle a member lands in. Interest and demo Circles are joined on purpose, never assigned.
CREATE OR REPLACE FUNCTION public.rx_assign_circle(p_user uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tz    text;
  v_lang  text;
  v_stage text;
  v_slots text[];
  v_city  text;
  v_cid   uuid;
  v_n     integer;
  v_fac   uuid;
BEGIN
  SELECT circle_id INTO v_cid FROM public.circle_seats WHERE user_id = p_user AND role = 'member' ORDER BY joined_at LIMIT 1;
  IF v_cid IS NOT NULL THEN RETURN v_cid; END IF;

  SELECT timezone, language, stage, slots INTO v_tz, v_lang, v_stage, v_slots FROM public.member_profile WHERE user_id = p_user;
  v_lang  := COALESCE(v_lang, 'English');
  v_tz    := COALESCE(v_tz, 'Africa/Lagos');
  v_slots := COALESCE(v_slots, '{}');

  SELECT c.id INTO v_cid
  FROM public.circles c
  WHERE c.status IN ('forming','active')
    AND c.interest IS NULL
    AND NOT c.is_demo
    AND COALESCE(c.language, 'English') = v_lang
    AND (SELECT count(*) FROM public.circle_seats s WHERE s.circle_id = c.id AND s.role = 'member') < 8
    AND (c.status = 'forming' OR c.cycle_start > current_date - 14)
    AND (c.stage IS NULL OR c.stage = v_stage OR c.slot = ANY (v_slots))
  ORDER BY (c.stage = v_stage) DESC NULLS LAST,
           (c.slot = ANY (v_slots)) DESC NULLS LAST,
           (c.timezone = v_tz) DESC NULLS LAST,
           c.created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_cid IS NULL THEN
    v_city := initcap(replace(split_part(v_tz, '/', 2), '_', ' '));
    IF v_city = '' THEN v_city := 'Ascentor'; END IF;
    SELECT COALESCE(max(number), 0) + 1 INTO v_n FROM public.circles;
    SELECT user_id INTO v_fac FROM public.member_profile mp
      WHERE mp.is_facilitator AND NOT mp.is_demo
        AND NOT EXISTS (SELECT 1 FROM public.circles x WHERE x.facilitator_id = mp.user_id AND x.status <> 'completed')
      LIMIT 1;
    INSERT INTO public.circles (name, number, timezone, language, stage, slot, facilitator_id)
      VALUES (v_city || ' Builders', v_n, v_tz, v_lang, v_stage, v_slots[1], v_fac)
      RETURNING id INTO v_cid;
    IF v_fac IS NOT NULL THEN
      INSERT INTO public.circle_seats (circle_id, user_id, role) VALUES (v_cid, v_fac, 'facilitator') ON CONFLICT DO NOTHING;
    END IF;
    INSERT INTO public.circle_messages (circle_id, user_id, body, pinned)
      VALUES (v_cid, NULL, 'Welcome, everyone. Tell us your name and one thing you''re working on.', true);
  END IF;

  INSERT INTO public.circle_seats (circle_id, user_id, role) VALUES (v_cid, p_user, 'member') ON CONFLICT DO NOTHING;

  SELECT count(*) INTO v_n FROM public.circle_seats WHERE circle_id = v_cid AND role = 'member';
  IF v_n >= 6 THEN
    UPDATE public.circles SET status = 'active', cycle_start = COALESCE(cycle_start, current_date) WHERE id = v_cid;
  END IF;
  RETURN v_cid;
END;
$$;
REVOKE ALL ON FUNCTION public.rx_assign_circle(uuid) FROM PUBLIC, anon, authenticated;

-- Joins a member to a chosen Circle. Returns ok, already, full, limit, closed or missing. Locks the Circle so two people
-- cannot take the last seat together. The 6th member starts the 90-day cycle.
CREATE OR REPLACE FUNCTION public.rx_join_circle(p_user uuid, p_circle uuid, p_max integer DEFAULT 3) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status text;
  v_n      integer;
  v_mine   integer;
BEGIN
  SELECT status INTO v_status FROM public.circles WHERE id = p_circle FOR UPDATE;
  IF v_status IS NULL THEN RETURN 'missing'; END IF;
  IF v_status = 'completed' THEN RETURN 'closed'; END IF;
  IF EXISTS (SELECT 1 FROM public.circle_seats WHERE circle_id = p_circle AND user_id = p_user) THEN RETURN 'already'; END IF;
  SELECT count(*) INTO v_mine FROM public.circle_seats WHERE user_id = p_user AND role = 'member';
  IF v_mine >= p_max THEN RETURN 'limit'; END IF;
  SELECT count(*) INTO v_n FROM public.circle_seats WHERE circle_id = p_circle AND role = 'member';
  IF v_n >= 8 THEN RETURN 'full'; END IF;
  INSERT INTO public.circle_seats (circle_id, user_id, role) VALUES (p_circle, p_user, 'member');
  IF v_n + 1 >= 6 THEN
    UPDATE public.circles SET status = 'active', cycle_start = COALESCE(cycle_start, current_date) WHERE id = p_circle;
  END IF;
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.rx_join_circle(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;

-- ── Row level security ──────────────────────────────────────────────────────
ALTER TABLE public.feed_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_reactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_shares       ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION pg_temp.rx_policy3(p_table text, p_name text, p_cmd text, p_using text, p_check text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = p_table AND policyname = p_name) THEN RETURN; END IF;
  EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO authenticated %s %s',
    p_name, p_table, p_cmd,
    CASE WHEN p_using IS NULL THEN '' ELSE 'USING (' || p_using || ')' END,
    CASE WHEN p_check IS NULL THEN '' ELSE 'WITH CHECK (' || p_check || ')' END);
END
$$;

SELECT pg_temp.rx_policy3('feed_categories','fc_read','SELECT','true');
SELECT pg_temp.rx_policy3('feed_reactions','frx_read','SELECT','true');
SELECT pg_temp.rx_policy3('feed_reactions','frx_insert','INSERT',NULL,'user_id = auth.uid()');
SELECT pg_temp.rx_policy3('feed_reactions','frx_update','UPDATE','user_id = auth.uid()','user_id = auth.uid()');
SELECT pg_temp.rx_policy3('feed_reactions','frx_delete','DELETE','user_id = auth.uid()');
SELECT pg_temp.rx_policy3('feed_shares','fsh_insert','INSERT',NULL,'user_id = auth.uid()');
SELECT pg_temp.rx_policy3('feed_shares','fsh_read','SELECT','user_id = auth.uid() OR public.rx_is_staff()');

REVOKE ALL ON public.feed_categories, public.feed_reactions, public.feed_shares FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.feed_categories FROM authenticated;

-- ── Starter posts from the Ascentor team, so Community is never empty ───────
INSERT INTO public.feed_posts (user_id, type, category, body, body_html, pinned)
SELECT NULL, 'Reflection', v.category, v.body, '<p>' || v.body || '</p>', false
FROM (VALUES
  ('Reflections', 'What is one small thing you practised this week, and who did it help? Share it here. A sentence is plenty.'),
  ('Questions',   'What is the hardest part of staying consistent for you right now? Ask the community. Someone has been there.'),
  ('Wins',        'Post a win, big or small. Finished a lesson, kept a promise, shipped something. This is the place to say it out loud.'),
  ('Resources',   'Found a book, video or tool that helped you? Share it with a line on why it was useful.'),
  ('Cybersecurity','New to cybersecurity? Tell us what you are learning and what is confusing. Members working in the field are here to help.'),
  ('Money and business', 'What is one money habit you are building this month? Saving, budgeting, pricing your work. Share it and learn from others.'),
  ('Faith and purpose', 'What gives your work meaning? Share a thought that keeps you going on slow days.')
) AS v(category, body)
WHERE NOT EXISTS (SELECT 1 FROM public.feed_posts WHERE user_id IS NULL AND type <> 'Prompt');
