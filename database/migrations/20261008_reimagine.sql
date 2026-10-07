-- ============================================================================
-- 2026-10-08_reimagine.sql
-- Data model for the reimagined member app: onboarding profile, weekly practice
-- and check-ins, pathway lessons, Circles, Groups, the community feed, direct
-- messages, human mentorship, Sage notes, announcements and growth scores.
--
-- Purely additive: no existing table is dropped or has a column removed. The only
-- change to an existing table is two new nullable/defaulted columns on user_goals.
-- Idempotent: every statement is guarded, so it is safe to run twice.
--
-- Access model: row level security on every table. Members read other members'
-- name and avatar through the existing member_directory view, and their stage,
-- city and interests through rx_member_cards (below). Nothing exposes email,
-- billing or role.
-- ============================================================================

-- ── helpers ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rx_is_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','moderator'));
$$;

-- ── member_profile: everything onboarding collects ──────────────────────────
CREATE TABLE IF NOT EXISTS public.member_profile (
  user_id                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  interests              text[]      NOT NULL DEFAULT '{}',
  purpose_score          smallint,
  effort_score           smallint,
  lead_exp               text,
  project_exp            text,
  slots                  text[]      NOT NULL DEFAULT '{}',
  timezone               text,
  timezone_label         text,
  language               text        NOT NULL DEFAULT 'English',
  stage                  text,                      -- Seeking | Building | Leading (derived, never picked)
  city                   text,
  country                text,
  baseline               jsonb       NOT NULL DEFAULT '{}'::jsonb,
  survey_remind_at       timestamptz,
  onboarding_step        text,
  onboarded_at           timestamptz,
  notif                  jsonb       NOT NULL DEFAULT '{"Practice reminders":true,"Circle meetings":true,"Messages":true,"Mentor sessions":true,"Community prompts":false}'::jsonb,
  max_per_day            smallint    NOT NULL DEFAULT 1,
  quiet_hours            boolean     NOT NULL DEFAULT true,
  reminders_paused_until timestamptz,
  research_opt_in        boolean     NOT NULL DEFAULT false,
  ann_muted              boolean     NOT NULL DEFAULT false,
  dm_policy              text        NOT NULL DEFAULT 'circle_and_requests',
  is_facilitator         boolean     NOT NULL DEFAULT false,
  oh_invite              text        NOT NULL DEFAULT 'pending' CHECK (oh_invite IN ('pending','later','joined')),
  beyond_self_project    text,
  beyond_self_since      date,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Goals: who the goal serves (onboarding asks for up to three).
ALTER TABLE public.user_goals ADD COLUMN IF NOT EXISTS serves   text;
ALTER TABLE public.user_goals ADD COLUMN IF NOT EXISTS position smallint NOT NULL DEFAULT 0;

CREATE OR REPLACE VIEW public.rx_member_cards AS
  SELECT p.id AS user_id, p.full_name, p.avatar_url,
         m.stage, m.city, m.country, m.interests, COALESCE(m.is_facilitator, false) AS is_facilitator
  FROM public.profiles p
  LEFT JOIN public.member_profile m ON m.user_id = p.id;
REVOKE ALL ON public.rx_member_cards FROM PUBLIC, anon;
GRANT SELECT ON public.rx_member_cards TO authenticated;

-- ── weekly practice (if-then plan) and daily check-ins ──────────────────────
CREATE TABLE IF NOT EXISTS public.practices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start  date NOT NULL,
  obstacle    text,
  cue         text NOT NULL,          -- "After I ___"
  action      text NOT NULL,          -- "I will ___"
  trigger     text,                   -- "If ___"
  fallback    text,                   -- "then I will ___"
  source      text,                   -- "set on Today" | "planned with Sage" | "from <lesson>"
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

CREATE TABLE IF NOT EXISTS public.practice_checkins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_id uuid REFERENCES public.practices(id) ON DELETE SET NULL,
  day         date NOT NULL,
  status      text NOT NULL CHECK (status IN ('kept','not')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day)
);
CREATE INDEX IF NOT EXISTS practice_checkins_user_day_idx ON public.practice_checkins (user_id, day DESC);

-- ── pathway lessons ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rx_lessons (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text UNIQUE NOT NULL,
  title      text NOT NULL,
  dimension  text NOT NULL,
  sub        text,
  minutes    integer NOT NULL DEFAULT 10,
  format     text NOT NULL DEFAULT 'Video' CHECK (format IN ('Video','Reading')),
  video_url  text,
  body       text,
  week_no    integer,                    -- which week of the 12-week pathway it anchors, if any
  sort       integer NOT NULL DEFAULT 0,
  published  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rx_lesson_progress (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id    uuid NOT NULL REFERENCES public.rx_lessons(id) ON DELETE CASCADE,
  reflection   text,
  practice_id  uuid REFERENCES public.practices(id) ON DELETE SET NULL,
  completed_at timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

-- ── Circles ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.circles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  number         integer NOT NULL,
  status         text NOT NULL DEFAULT 'forming' CHECK (status IN ('forming','active','completed')),
  facilitator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  timezone       text,
  language       text,
  cycle_start    date,
  meeting_dow    smallint NOT NULL DEFAULT 4,           -- 0 Sun .. 6 Sat; default Thursday
  meeting_time   time NOT NULL DEFAULT '19:00',
  meeting_url    text,
  focus          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.circle_seats (
  circle_id  uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member' CHECK (role IN ('member','facilitator')),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  pledged_at timestamptz,
  PRIMARY KEY (circle_id, user_id)
);
-- A member sits in one Circle at a time.
CREATE UNIQUE INDEX IF NOT EXISTS circle_seats_one_member_seat ON public.circle_seats (user_id) WHERE role = 'member';

CREATE TABLE IF NOT EXISTS public.circle_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id  uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind       text NOT NULL DEFAULT 'text' CHECK (kind IN ('text','voice','img')),
  body       text NOT NULL,
  is_win     boolean NOT NULL DEFAULT false,
  pinned     boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS circle_messages_circle_idx ON public.circle_messages (circle_id, created_at);

CREATE TABLE IF NOT EXISTS public.circle_reports (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id  uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_no    integer NOT NULL,
  kept       text NOT NULL CHECK (kept IN ('Kept','Partly kept','Not kept')),
  obstacle   text,
  next_step  text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (circle_id, user_id, week_no)
);

CREATE TABLE IF NOT EXISTS public.circle_reviews (
  circle_id     uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  carry_forward text,
  next_choice   text CHECK (next_choice IN ('join','break')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (circle_id, user_id)
);

CREATE OR REPLACE FUNCTION public.rx_in_circle(cid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.circle_seats WHERE circle_id = cid AND user_id = auth.uid());
$$;

-- Places a member in a forming/active Circle with a free seat (same language, nearest time zone first),
-- or opens a new one. Seats are capped at 8. The 6th member starts the 90-day cycle. Returns the circle id.
CREATE OR REPLACE FUNCTION public.rx_assign_circle(p_user uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tz   text;
  v_lang text;
  v_city text;
  v_cid  uuid;
  v_n    integer;
  v_fac  uuid;
BEGIN
  SELECT circle_id INTO v_cid FROM public.circle_seats WHERE user_id = p_user AND role = 'member';
  IF v_cid IS NOT NULL THEN RETURN v_cid; END IF;

  SELECT timezone, language INTO v_tz, v_lang FROM public.member_profile WHERE user_id = p_user;
  v_lang := COALESCE(v_lang, 'English');
  v_tz   := COALESCE(v_tz, 'Africa/Lagos');

  SELECT c.id INTO v_cid
  FROM public.circles c
  WHERE c.status IN ('forming','active')
    AND COALESCE(c.language, 'English') = v_lang
    AND (SELECT count(*) FROM public.circle_seats s WHERE s.circle_id = c.id AND s.role = 'member') < 8
    AND (c.status = 'forming' OR c.cycle_start > current_date - 14)   -- do not drop people into a cycle already well under way
  ORDER BY (c.timezone = v_tz) DESC NULLS LAST, c.created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_cid IS NULL THEN
    v_city := initcap(replace(split_part(v_tz, '/', 2), '_', ' '));
    IF v_city = '' THEN v_city := 'Ascentor'; END IF;
    SELECT COALESCE(max(number), 0) + 1 INTO v_n FROM public.circles;
    SELECT user_id INTO v_fac FROM public.member_profile mp
      WHERE mp.is_facilitator
        AND NOT EXISTS (SELECT 1 FROM public.circles x WHERE x.facilitator_id = mp.user_id AND x.status <> 'completed')
      LIMIT 1;
    INSERT INTO public.circles (name, number, timezone, language, facilitator_id)
      VALUES (v_city || ' Builders', v_n, v_tz, v_lang, v_fac)
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

-- ── Groups ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rx_groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  name            text NOT NULL,
  description     text,
  dimension       text,
  fit             text[] NOT NULL DEFAULT '{}',
  prompt          text,
  is_general      boolean NOT NULL DEFAULT false,
  is_city         boolean NOT NULL DEFAULT false,
  is_facilitators boolean NOT NULL DEFAULT false,
  is_new          boolean NOT NULL DEFAULT false,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rx_group_members (
  group_id  uuid NOT NULL REFERENCES public.rx_groups(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.rx_group_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES public.rx_groups(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rx_group_messages_group_idx ON public.rx_group_messages (group_id, created_at);

CREATE TABLE IF NOT EXISTS public.rx_group_requests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Admin decisions on computed group suggestions (key = the suggested sub-interest).
CREATE TABLE IF NOT EXISTS public.rx_group_suggestion_state (
  key        text PRIMARY KEY,
  status     text NOT NULL CHECK (status IN ('dismissed','created')),
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.rx_in_group(gid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.rx_group_members WHERE group_id = gid AND user_id = auth.uid());
$$;

-- The facilitators' room is private to flagged members and staff; every other active group is open to read.
CREATE OR REPLACE FUNCTION public.rx_can_see_group(gid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rx_groups g
    WHERE g.id = gid
      AND (NOT g.is_facilitators
           OR public.rx_is_staff()
           OR EXISTS (SELECT 1 FROM public.member_profile m WHERE m.user_id = auth.uid() AND m.is_facilitator))
  );
$$;

CREATE OR REPLACE VIEW public.rx_group_stats AS
  SELECT g.id AS group_id,
         (SELECT count(*) FROM public.rx_group_members m WHERE m.group_id = g.id)::int AS member_count,
         (SELECT count(*) FROM public.rx_group_messages x WHERE x.group_id = g.id AND x.created_at > now() - interval '7 days')::int AS posts_7d,
         (SELECT max(x.created_at) FROM public.rx_group_messages x WHERE x.group_id = g.id) AS last_active
  FROM public.rx_groups g
  WHERE public.rx_can_see_group(g.id) OR public.rx_is_staff();
GRANT SELECT ON public.rx_group_stats TO authenticated;

-- ── community feed ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feed_posts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,   -- null = posted by the Ascentor team
  type       text NOT NULL CHECK (type IN ('Question','Win','Reflection','Resource','Prompt')),
  dimension  text,
  sub        text,
  body       text NOT NULL,
  pinned     boolean NOT NULL DEFAULT false,
  deleted    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feed_posts_created_idx ON public.feed_posts (created_at DESC);

CREATE TABLE IF NOT EXISTS public.feed_replies (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feed_replies_post_idx ON public.feed_replies (post_id, created_at);

-- ── direct messages ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dm_threads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_by    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'request' CHECK (status IN ('request','accepted','declined','blocked')),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (user_a <> user_b)
);
CREATE UNIQUE INDEX IF NOT EXISTS dm_threads_pair_uniq ON public.dm_threads (LEAST(user_a, user_b), GREATEST(user_a, user_b));

CREATE TABLE IF NOT EXISTS public.dm_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  uuid NOT NULL REFERENCES public.dm_threads(id) ON DELETE CASCADE,
  sender_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       text NOT NULL,
  flagged    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dm_messages_thread_idx ON public.dm_messages (thread_id, created_at);

CREATE TABLE IF NOT EXISTS public.dm_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS public.rx_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        text NOT NULL,                 -- dm | circle | group
  ref_id      uuid,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── human mentorship ────────────────────────────────────────────────────────
-- (mentor_profiles holds the AI coach personas; people who mentor live here.)
CREATE TABLE IF NOT EXISTS public.human_mentors (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name       text NOT NULL,
  headline   text,
  bio        text,
  tags       text[] NOT NULL DEFAULT '{}',
  langs      text[] NOT NULL DEFAULT '{English}',
  formats    text[] NOT NULL DEFAULT '{Video}',
  avatar_url text,
  capacity   integer NOT NULL DEFAULT 3,
  accepting  boolean NOT NULL DEFAULT true,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mentor_slots (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES public.human_mentors(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  taken     boolean NOT NULL DEFAULT false,
  UNIQUE (mentor_id, starts_at)
);

CREATE TABLE IF NOT EXISTS public.mentee_intake (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  goal       text,
  interests  text[] NOT NULL DEFAULT '{}',
  frequency  text,
  format     text,
  times      text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mentor_matches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentor_id   uuid NOT NULL REFERENCES public.human_mentors(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','accepted','declined','active','ended')),
  slot_id     uuid REFERENCES public.mentor_slots(id) ON DELETE SET NULL,
  slot_at     timestamptz,
  first_ask   text,
  why         text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);
CREATE INDEX IF NOT EXISTS mentor_matches_member_idx ON public.mentor_matches (member_id);
CREATE INDEX IF NOT EXISTS mentor_matches_mentor_idx ON public.mentor_matches (mentor_id);

CREATE TABLE IF NOT EXISTS public.mentor_goals (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.mentor_matches(id) ON DELETE CASCADE,
  position smallint NOT NULL DEFAULT 0,
  text     text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.mentor_tasks (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.mentor_matches(id) ON DELETE CASCADE,
  task     text NOT NULL,
  owner    text NOT NULL CHECK (owner IN ('member','mentor')),
  due      date,
  done     boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.mentor_confirmations (
  match_id     uuid NOT NULL REFERENCES public.mentor_matches(id) ON DELETE CASCADE,
  party        text NOT NULL CHECK (party IN ('member','mentor')),
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, party)
);

CREATE TABLE IF NOT EXISTS public.mentor_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   uuid NOT NULL REFERENCES public.mentor_matches(id) ON DELETE CASCADE,
  sender_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.rx_in_match(mid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mentor_matches m
    LEFT JOIN public.human_mentors h ON h.id = m.mentor_id
    WHERE m.id = mid AND (m.member_id = auth.uid() OR h.user_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.rx_is_match_mentor(mid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mentor_matches m JOIN public.human_mentors h ON h.id = m.mentor_id
    WHERE m.id = mid AND h.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.rx_is_match_member(mid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.mentor_matches WHERE id = mid AND member_id = auth.uid());
$$;

-- True when the other person in a DM thread has blocked the caller.
CREATE OR REPLACE FUNCTION public.rx_blocked_in_thread(tid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dm_threads t JOIN public.dm_blocks b
      ON b.blocker_id IN (t.user_a, t.user_b) AND b.blocked_id = auth.uid() AND b.blocker_id <> auth.uid()
    WHERE t.id = tid
  );
$$;

-- Records that the caller agreed to the Circle confidentiality pledge.
CREATE OR REPLACE FUNCTION public.rx_pledge(cid uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.circle_seats SET pledged_at = COALESCE(pledged_at, now()) WHERE circle_id = cid AND user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.rx_pledge(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rx_pledge(uuid) TO authenticated;

-- ── Sage notes, announcements, growth ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sage_memories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sage_memories_user_idx ON public.sage_memories (user_id, created_at);

CREATE TABLE IF NOT EXISTS public.announcements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  text       text,
  date_label text,
  time_label text,
  location   text,
  btn_label  text,
  link       text,
  image_url  text,
  audience   text NOT NULL DEFAULT 'All members' CHECK (audience IN ('All members','By stage','By city','By Circle','By language')),
  aud_value  text,
  banner     boolean NOT NULL DEFAULT false,
  featured   boolean NOT NULL DEFAULT false,
  starts_on  date,
  ends_on    date,
  status     text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Scheduled','Live','Ended')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.announcement_reads (
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  read_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, announcement_id)
);

CREATE TABLE IF NOT EXISTS public.growth_scores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('baseline','m3','m6')),
  flourishing numeric(3,2),
  purpose     numeric(3,2),
  initiative  numeric(3,2),
  taken_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);

-- ── row level security ──────────────────────────────────────────────────────
DO $rls$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'member_profile','practices','practice_checkins','rx_lessons','rx_lesson_progress',
    'circles','circle_seats','circle_messages','circle_reports','circle_reviews',
    'rx_groups','rx_group_members','rx_group_messages','rx_group_requests','rx_group_suggestion_state',
    'feed_posts','feed_replies','dm_threads','dm_messages','dm_blocks','rx_reports',
    'human_mentors','mentor_slots','mentee_intake','mentor_matches','mentor_goals','mentor_tasks',
    'mentor_confirmations','mentor_messages','sage_memories','announcements','announcement_reads','growth_scores'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END
$rls$;

-- policy helper: create only if absent (keeps the file idempotent)
CREATE OR REPLACE FUNCTION pg_temp.rx_policy(p_table text, p_name text, p_cmd text, p_using text, p_check text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = p_table AND policyname = p_name) THEN
    RETURN;
  END IF;
  EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO authenticated %s %s',
    p_name, p_table, p_cmd,
    CASE WHEN p_using IS NULL THEN '' ELSE 'USING (' || p_using || ')' END,
    CASE WHEN p_check IS NULL THEN '' ELSE 'WITH CHECK (' || p_check || ')' END);
END
$$;

-- member_profile: owner, plus staff read
SELECT pg_temp.rx_policy('member_profile','mp_own_select','SELECT','user_id = auth.uid() OR public.rx_is_staff()');
SELECT pg_temp.rx_policy('member_profile','mp_own_insert','INSERT',NULL,'user_id = auth.uid()');
SELECT pg_temp.rx_policy('member_profile','mp_own_update','UPDATE','user_id = auth.uid()','user_id = auth.uid()');

-- members may write their own row, but never is_facilitator (staff set it through the service role)
REVOKE INSERT, UPDATE ON public.member_profile FROM authenticated;
GRANT INSERT (user_id, interests, purpose_score, effort_score, lead_exp, project_exp, slots, timezone, timezone_label,
              language, stage, city, country, baseline, survey_remind_at, onboarding_step, onboarded_at, notif,
              max_per_day, quiet_hours, reminders_paused_until, research_opt_in, ann_muted, dm_policy,
              oh_invite, beyond_self_project, beyond_self_since) ON public.member_profile TO authenticated;
GRANT UPDATE (interests, purpose_score, effort_score, lead_exp, project_exp, slots, timezone, timezone_label,
              language, stage, city, country, baseline, survey_remind_at, onboarding_step, onboarded_at, notif,
              max_per_day, quiet_hours, reminders_paused_until, research_opt_in, ann_muted, dm_policy,
              oh_invite, beyond_self_project, beyond_self_since, updated_at) ON public.member_profile TO authenticated;

-- owner-only tables
SELECT pg_temp.rx_policy('practices','pr_own','ALL','user_id = auth.uid()','user_id = auth.uid()');
SELECT pg_temp.rx_policy('practice_checkins','pc_own','ALL','user_id = auth.uid()','user_id = auth.uid()');
SELECT pg_temp.rx_policy('rx_lesson_progress','lp_own','ALL','user_id = auth.uid()','user_id = auth.uid()');
SELECT pg_temp.rx_policy('mentee_intake','mi_own','ALL','user_id = auth.uid()','user_id = auth.uid()');
SELECT pg_temp.rx_policy('sage_memories','sm_own','ALL','user_id = auth.uid()','user_id = auth.uid()');
SELECT pg_temp.rx_policy('growth_scores','gs_own','ALL','user_id = auth.uid()','user_id = auth.uid()');
SELECT pg_temp.rx_policy('announcement_reads','ar_own','ALL','user_id = auth.uid()','user_id = auth.uid()');
SELECT pg_temp.rx_policy('dm_blocks','blk_own','ALL','blocker_id = auth.uid()','blocker_id = auth.uid()');
SELECT pg_temp.rx_policy('rx_reports','rep_insert','INSERT',NULL,'reporter_id = auth.uid()');
SELECT pg_temp.rx_policy('rx_reports','rep_staff_read','SELECT','public.rx_is_staff()');
SELECT pg_temp.rx_policy('rx_group_requests','gr_insert','INSERT',NULL,'user_id = auth.uid()');
SELECT pg_temp.rx_policy('rx_group_requests','gr_staff_read','SELECT','public.rx_is_staff()');

-- lessons: published ones are readable by members; staff manage
SELECT pg_temp.rx_policy('rx_lessons','les_read','SELECT','published OR public.rx_is_staff()');
SELECT pg_temp.rx_policy('rx_lessons','les_staff','ALL','public.rx_is_staff()','public.rx_is_staff()');

-- circles: members of the circle (and staff). Writes go through rx_assign_circle (service role).
SELECT pg_temp.rx_policy('circles','c_read','SELECT','public.rx_in_circle(id) OR public.rx_is_staff()');
SELECT pg_temp.rx_policy('circles','c_staff','ALL','public.rx_is_staff()','public.rx_is_staff()');
SELECT pg_temp.rx_policy('circle_seats','cs_read','SELECT','public.rx_in_circle(circle_id) OR public.rx_is_staff()');
SELECT pg_temp.rx_policy('circle_seats','cs_leave','DELETE','user_id = auth.uid() OR public.rx_is_staff()');
SELECT pg_temp.rx_policy('circle_messages','cm_read','SELECT','public.rx_in_circle(circle_id) OR public.rx_is_staff()');
SELECT pg_temp.rx_policy('circle_messages','cm_insert','INSERT',NULL,'user_id = auth.uid() AND NOT pinned AND public.rx_in_circle(circle_id)');
SELECT pg_temp.rx_policy('circle_reports','cr_read','SELECT','public.rx_in_circle(circle_id) OR public.rx_is_staff()');
SELECT pg_temp.rx_policy('circle_reports','cr_insert','INSERT',NULL,'user_id = auth.uid() AND public.rx_in_circle(circle_id)');
SELECT pg_temp.rx_policy('circle_reports','cr_update','UPDATE','user_id = auth.uid()','user_id = auth.uid()');
SELECT pg_temp.rx_policy('circle_reviews','crv_own','ALL','user_id = auth.uid()','user_id = auth.uid() AND public.rx_in_circle(circle_id)');

-- groups
SELECT pg_temp.rx_policy('rx_groups','g_read','SELECT','status = ''active'' AND public.rx_can_see_group(id) OR public.rx_is_staff()');
SELECT pg_temp.rx_policy('rx_groups','g_staff','ALL','public.rx_is_staff()','public.rx_is_staff()');
SELECT pg_temp.rx_policy('rx_group_members','gm_read','SELECT','public.rx_can_see_group(group_id) OR public.rx_is_staff()');
SELECT pg_temp.rx_policy('rx_group_members','gm_join','INSERT',NULL,'user_id = auth.uid() AND public.rx_can_see_group(group_id)');
SELECT pg_temp.rx_policy('rx_group_members','gm_leave','DELETE','user_id = auth.uid()');
SELECT pg_temp.rx_policy('rx_group_messages','gmsg_read','SELECT','public.rx_can_see_group(group_id)');
SELECT pg_temp.rx_policy('rx_group_messages','gmsg_insert','INSERT',NULL,'user_id = auth.uid() AND public.rx_in_group(group_id)');
SELECT pg_temp.rx_policy('rx_group_suggestion_state','gss_staff','ALL','public.rx_is_staff()','public.rx_is_staff()');

-- feed
SELECT pg_temp.rx_policy('feed_posts','fp_read','SELECT','NOT deleted OR user_id = auth.uid() OR public.rx_is_staff()');
SELECT pg_temp.rx_policy('feed_posts','fp_insert','INSERT',NULL,'(user_id = auth.uid() AND type <> ''Prompt'' AND NOT pinned) OR public.rx_is_staff()');
SELECT pg_temp.rx_policy('feed_posts','fp_update','UPDATE','user_id = auth.uid() OR public.rx_is_staff()','(user_id = auth.uid() AND type <> ''Prompt'' AND NOT pinned) OR public.rx_is_staff()');
SELECT pg_temp.rx_policy('feed_replies','fr_read','SELECT','true');
SELECT pg_temp.rx_policy('feed_replies','fr_insert','INSERT',NULL,'user_id = auth.uid()');
SELECT pg_temp.rx_policy('feed_replies','fr_delete','DELETE','user_id = auth.uid() OR public.rx_is_staff()');

-- direct messages: participants only
SELECT pg_temp.rx_policy('dm_threads','dt_read','SELECT','auth.uid() IN (user_a, user_b)');
SELECT pg_temp.rx_policy('dm_threads','dt_insert','INSERT',NULL,'requested_by = auth.uid() AND auth.uid() IN (user_a, user_b) AND status = ''request''');
SELECT pg_temp.rx_policy('dm_threads','dt_update','UPDATE','auth.uid() IN (user_a, user_b) AND requested_by <> auth.uid()','auth.uid() IN (user_a, user_b) AND requested_by <> auth.uid()');
SELECT pg_temp.rx_policy('dm_messages','dmm_read','SELECT','EXISTS (SELECT 1 FROM public.dm_threads t WHERE t.id = thread_id AND auth.uid() IN (t.user_a, t.user_b))');
SELECT pg_temp.rx_policy('dm_messages','dmm_insert','INSERT',NULL,'sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.dm_threads t WHERE t.id = thread_id AND auth.uid() IN (t.user_a, t.user_b) AND (t.status = ''accepted'' OR (t.status = ''request'' AND t.requested_by = auth.uid()))) AND NOT public.rx_blocked_in_thread(thread_id)');

-- mentorship
SELECT pg_temp.rx_policy('human_mentors','hm_read','SELECT','active OR public.rx_is_staff() OR user_id = auth.uid()');
SELECT pg_temp.rx_policy('human_mentors','hm_staff','ALL','public.rx_is_staff()','public.rx_is_staff()');
SELECT pg_temp.rx_policy('human_mentors','hm_self','UPDATE','user_id = auth.uid()','user_id = auth.uid()');
-- a mentor may change only these columns of their own row (staff edit through the service role)
REVOKE UPDATE ON public.human_mentors FROM authenticated;
GRANT UPDATE (capacity, accepting, bio, headline) ON public.human_mentors TO authenticated;
SELECT pg_temp.rx_policy('mentor_slots','ms_read','SELECT','true');
SELECT pg_temp.rx_policy('mentor_slots','ms_manage','ALL','EXISTS (SELECT 1 FROM public.human_mentors h WHERE h.id = mentor_id AND (h.user_id = auth.uid() OR public.rx_is_staff()))','EXISTS (SELECT 1 FROM public.human_mentors h WHERE h.id = mentor_id AND (h.user_id = auth.uid() OR public.rx_is_staff()))');
SELECT pg_temp.rx_policy('mentor_matches','mm_read','SELECT','public.rx_in_match(id) OR public.rx_is_staff()');
SELECT pg_temp.rx_policy('mentor_matches','mm_insert','INSERT',NULL,'member_id = auth.uid() AND status = ''requested''');
SELECT pg_temp.rx_policy('mentor_matches','mm_update','UPDATE','public.rx_is_match_mentor(id) OR (member_id = auth.uid() AND status = ''requested'')','public.rx_is_match_mentor(id) OR (member_id = auth.uid() AND status = ''requested'')');
SELECT pg_temp.rx_policy('mentor_goals','mg_all','ALL','public.rx_in_match(match_id)','public.rx_in_match(match_id)');
SELECT pg_temp.rx_policy('mentor_tasks','mt_all','ALL','public.rx_in_match(match_id)','public.rx_in_match(match_id)');
SELECT pg_temp.rx_policy('mentor_confirmations','mc_read','SELECT','public.rx_in_match(match_id)');
SELECT pg_temp.rx_policy('mentor_confirmations','mc_insert','INSERT',NULL,'(party = ''member'' AND public.rx_is_match_member(match_id)) OR (party = ''mentor'' AND public.rx_is_match_mentor(match_id))');
SELECT pg_temp.rx_policy('mentor_confirmations','mc_delete','DELETE','public.rx_in_match(match_id)');
SELECT pg_temp.rx_policy('mentor_messages','mmsg_read','SELECT','public.rx_in_match(match_id)');
SELECT pg_temp.rx_policy('mentor_messages','mmsg_insert','INSERT',NULL,'sender_id = auth.uid() AND public.rx_in_match(match_id)');

-- announcements: members read live and ended ones; staff manage everything
SELECT pg_temp.rx_policy('announcements','an_read','SELECT','status IN (''Live'',''Ended'') OR public.rx_is_staff()');
SELECT pg_temp.rx_policy('announcements','an_staff','ALL','public.rx_is_staff()','public.rx_is_staff()');

-- ── seed: lessons, groups, the weekly prompt and the first announcements ────
INSERT INTO public.rx_lessons (slug, title, dimension, sub, minutes, format, week_no, sort, body) VALUES
 ('choosing-what-you-practise','Choosing what you practise','Mind','Focus',12,'Video',1,1,
  E'Growth comes from what you practise, not what you watch. Choose one small action you can repeat, tie it to something you already do, and plan for the moment it gets hard.\n\nStart by naming the one part of your day that already happens without effort: a commute, a meal, the first minute at your desk. That is your anchor.\n\nThen pick an action small enough that you could do it on your worst day. Ten minutes beats an hour you skip.'),
 ('small-promises-kept','Small promises, kept','Character','Discipline',9,'Video',2,2,
  E'Discipline is mostly a record of promises kept to yourself. Each small one you keep makes the next one easier to believe.\n\nMake the promise smaller than feels impressive. Say exactly when you will do it. Then keep it, and notice that you did.\n\nA missed day does not erase the record. It is one data point, and the next day is open.'),
 ('mapping-your-first-security-role','Mapping your first security role','Vocation','Cybersecurity',14,'Video',5,3,
  E'Security is a family of roles, not one job. Analysts watch and respond, engineers build defences, and governance people write the rules and check they are followed.\n\nRead three real job posts for entry-level roles. Highlight the skills that repeat. That repeating list is your map.\n\nChoose the role that fits the skills you already have, then plan the one gap to close first.'),
 ('reading-a-job-post-like-an-analyst','Reading a job post like an analyst','Vocation','Cybersecurity',8,'Reading',6,4,
  E'A job post is a list of problems the employer wants solved, written in a hurry. Separate the must-haves from the wish list.\n\nCount how often each skill appears across posts. Tools change, but the skills underneath them repeat.\n\nWrite your own one-line answer to each repeated requirement, using something you have actually done.'),
 ('prompting-with-care','Prompting with care','Vocation','AI engineering',11,'Video',NULL,5,
  E'A good prompt states the task, the context, and what a good answer looks like. Vague in, vague out.\n\nGive the model the facts it cannot guess. Ask for the format you need. Then read the answer critically: it is a draft, and you own the result.\n\nKeep a short note of the prompts that worked. That note becomes your own toolkit.'),
 ('your-first-paying-customer','Your first paying customer','Vocation','Entrepreneurship',13,'Video',NULL,6,
  E'Your first customer is proof that a real person values what you make enough to pay for it.\n\nSkip the website. Describe the problem to one person who has it and ask what they would pay to solve it. Their answer teaches more than a plan.\n\nOffer something small and specific, deliver it well, and ask what they would change.'),
 ('asking-for-help-well','Asking for help well','Relationships','Communication',10,'Video',NULL,7,
  E'People are more willing to help than we expect, but only when the ask is easy to answer.\n\nSay what you are trying to do, what you have already tried, and the one specific thing you need. Make it small enough to answer in a few minutes.\n\nThank them, and tell them what happened. That is how a single answer becomes a relationship.'),
 ('showing-up-for-your-circle','Showing up for your Circle','Community','Teamwork',7,'Reading',NULL,8,
  E'A Circle works because people turn up, listen first and keep what is shared in the room.\n\nShare your report before the meeting, even when the week went badly. Honest misses help everyone more than polished wins.\n\nWhen someone goes quiet, a short personal message does more than a reminder.'),
 ('work-that-outlives-you','Work that outlives you','Legacy','Mentoring others',12,'Video',NULL,9,
  E'Legacy is not a monument. It is the people you helped and the habits you passed on.\n\nChoose one person you can help this month with something you already know. Teach it simply. Ask what would have helped you at their stage.\n\nSmall, repeated acts of teaching outlast almost everything else you build.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.rx_groups (slug, name, description, dimension, fit, is_general, prompt) VALUES
 ('cyber-corner','Cyber Corner','Learning and working in cybersecurity, from first labs to first jobs.','Vocation','{Cybersecurity}',false,'What are you studying this week, and where are you stuck?'),
 ('ai-builders','AI Builders','Building with AI, from prompts to products.','Vocation','{"AI engineering"}',false,'Share one thing you built or tried this week.'),
 ('founders-table','Founders’ Table','For people starting and running small businesses.','Vocation','{Entrepreneurship,"Small business finance","Business growth"}',false,'What is one customer conversation you had this week?'),
 ('money-matters','Money Matters','Personal and small-business finance, plainly explained.','Vocation','{"Personal finance","Budgeting and saving","Small business finance","Business growth"}',false,'What is one money habit you are building this month?'),
 ('deep-focus','Deep Focus','Protecting time for the work that matters.','Mind','{Focus,"Learning how to learn"}',false,'When is your best hour for focused work?'),
 ('daily-discipline','Daily Discipline','Small promises, kept every day.','Character','{Discipline}',false,'What is one small promise you kept today?'),
 ('open-house','Open house','A general group for every member. Say hello, ask anything.','Community','{}',true,'Introduce yourself: your name, your city and one thing you are working on.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.rx_groups (slug, name, description, dimension, is_city, prompt) VALUES
 ('city-lagos','Lagos','Members in and around Lagos.','Community',true,'Any meetups or study spots this weekend?')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.rx_groups (slug, name, description, dimension, is_facilitators, prompt) VALUES
 ('facilitators-room','Facilitators’ room','Private. For active Circle facilitators.','Legacy',true,'What helped a quiet member this week?')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.feed_posts (user_id, type, dimension, body, pinned)
SELECT NULL, 'Prompt', NULL, 'What''s one small thing you''re practising, and who does it serve?', true
WHERE NOT EXISTS (SELECT 1 FROM public.feed_posts WHERE type = 'Prompt' AND pinned);

INSERT INTO public.announcements (title, text, date_label, location, btn_label, link, banner, featured, starts_on, ends_on, status)
SELECT 'The Elevation Summit 2026', 'The Rise We Choose. Free entry, registration required.', 'Thu 19 Nov 2026',
       'Aderemi Makanjuola Hall, LASU · in person or online', 'Register', '/elevation-summit', true, true, current_date, DATE '2026-11-19', 'Live'
WHERE NOT EXISTS (SELECT 1 FROM public.announcements WHERE title = 'The Elevation Summit 2026');

INSERT INTO public.announcements (title, text, btn_label, link, status, starts_on)
SELECT 'Groups are open', 'Find people who share your interests in Community.', 'Browse groups', '/community/groups', 'Live', current_date
WHERE NOT EXISTS (SELECT 1 FROM public.announcements WHERE title = 'Groups are open');

-- ── realtime: chat tables push new rows to open conversations ───────────────
DO $rt$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['circle_messages','rx_group_messages','dm_messages','mentor_messages'] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
    END;
  END LOOP;
END
$rt$;
