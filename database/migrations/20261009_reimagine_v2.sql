-- ============================================================================
-- 2026-10-09_reimagine_v2.sql
-- Second pass on the reimagined member app, from the founder's handoff v0.2 and decisions:
--   * Circles: 8 seats, matched on language, stage and time slot
--   * Sage conversations stored, and a log of every admin view or export of chats
--   * Moderation: automatic flags, per-member messaging block
--   * Survey answers moved to private tables that no client can read (service role only)
--   * Circle mentorship (Model A): recommended mentors, Circle vote, availability marks, RSVPs, questions, agreement
--   * Audio call attendance (minutes only, never content)
--   * Check-in note, chat consent, 12 pathway lessons
-- Additive except one deliberate move: public.growth_scores (created yesterday, holds the member's own survey
-- scores) is copied to private_growth_scores and dropped. Idempotent.
-- ============================================================================

-- ── Circles: stage and time slot ────────────────────────────────────────────
ALTER TABLE public.circles ADD COLUMN IF NOT EXISTS stage text;
ALTER TABLE public.circles ADD COLUMN IF NOT EXISTS slot  text;

-- Places a member in a forming/active Circle with a free seat. Language must match. The Circle must also share the
-- member's stage or one of their time slots, and the best fit (stage, then slot, then nearest zone) wins. Otherwise a
-- new Circle opens. Seats are capped at 8; the 6th member starts the 90-day cycle.
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
  SELECT circle_id INTO v_cid FROM public.circle_seats WHERE user_id = p_user AND role = 'member';
  IF v_cid IS NOT NULL THEN RETURN v_cid; END IF;

  SELECT timezone, language, stage, slots INTO v_tz, v_lang, v_stage, v_slots FROM public.member_profile WHERE user_id = p_user;
  v_lang  := COALESCE(v_lang, 'English');
  v_tz    := COALESCE(v_tz, 'Africa/Lagos');
  v_slots := COALESCE(v_slots, '{}');

  SELECT c.id INTO v_cid
  FROM public.circles c
  WHERE c.status IN ('forming','active')
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
      WHERE mp.is_facilitator
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

-- ── member_profile: chat consent and messaging block ────────────────────────
ALTER TABLE public.member_profile ADD COLUMN IF NOT EXISTS chat_consent_at   timestamptz;
ALTER TABLE public.member_profile ADD COLUMN IF NOT EXISTS messaging_blocked boolean NOT NULL DEFAULT false;  -- staff only
GRANT INSERT (chat_consent_at) ON public.member_profile TO authenticated;
GRANT UPDATE (chat_consent_at) ON public.member_profile TO authenticated;

-- ── check-in note ───────────────────────────────────────────────────────────
ALTER TABLE public.practice_checkins ADD COLUMN IF NOT EXISTS note text;

-- ── Sage conversations (read by the owner; written by the server) ───────────
CREATE TABLE IF NOT EXISTS public.sage_conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic      text NOT NULL DEFAULT 'plan',
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sage_conversations_user_idx ON public.sage_conversations (user_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS public.sage_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.sage_conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user','sage')),
  body            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sage_messages_conv_idx ON public.sage_messages (conversation_id, created_at);

-- ── admin access log and automatic moderation flags (service role only) ─────
CREATE TABLE IF NOT EXISTS public.chat_access_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action     text NOT NULL CHECK (action IN ('view','export')),
  scope      text NOT NULL,                     -- circle | group | dm | sage | member
  ref_id     uuid,
  format     text,
  detail     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_access_log_created_idx ON public.chat_access_log (created_at DESC);

CREATE TABLE IF NOT EXISTS public.rx_flags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       text NOT NULL,                     -- dm | circle | group
  ref_id     uuid,
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,   -- who sent it
  reason     text NOT NULL,
  status     text NOT NULL DEFAULT 'open' CHECK (status IN ('open','dismissed','actioned')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rx_flags_status_idx ON public.rx_flags (status, created_at DESC);
ALTER TABLE public.rx_reports ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';

-- ── survey answers: private tables nobody can read from the client ──────────
CREATE TABLE IF NOT EXISTS public.private_survey_responses (
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wave      text NOT NULL CHECK (wave IN ('baseline','m3','m6')),
  item      smallint NOT NULL,
  value     smallint NOT NULL CHECK (value BETWEEN 1 AND 5),
  taken_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, wave, item)
);
CREATE TABLE IF NOT EXISTS public.private_growth_scores (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('baseline','m3','m6')),
  flourishing numeric(3,2),
  purpose     numeric(3,2),
  initiative  numeric(3,2),
  taken_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind)
);

DO $mv$
BEGIN
  IF to_regclass('public.growth_scores') IS NOT NULL THEN
    INSERT INTO public.private_growth_scores (user_id, kind, flourishing, purpose, initiative, taken_at)
      SELECT user_id, kind, flourishing, purpose, initiative, taken_at FROM public.growth_scores
      ON CONFLICT DO NOTHING;
    DROP TABLE public.growth_scores;
  END IF;
END
$mv$;
-- survey answers do not belong in the profile row staff can read
UPDATE public.member_profile SET baseline = baseline - 'answers' WHERE baseline ? 'answers';

-- ── Circle mentorship (Model A) ─────────────────────────────────────────────
-- Mentors are recommended, the Circle votes, the highest vote becomes the Circle's mentor. Writes happen in the
-- server (service role) after the rules are checked; members and the mentor can only read what is theirs.
CREATE TABLE IF NOT EXISTS public.circle_mentor_rounds (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id        uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open','tie','closed','cancelled')),
  is_swap          boolean NOT NULL DEFAULT false,
  closes_at        timestamptz NOT NULL,
  winner_mentor_id uuid REFERENCES public.human_mentors(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS circle_mentor_one_open_round ON public.circle_mentor_rounds (circle_id) WHERE status IN ('open','tie');

CREATE TABLE IF NOT EXISTS public.circle_mentor_candidates (
  round_id  uuid NOT NULL REFERENCES public.circle_mentor_rounds(id) ON DELETE CASCADE,
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  mentor_id uuid NOT NULL REFERENCES public.human_mentors(id) ON DELETE CASCADE,
  why       text,
  score     integer NOT NULL DEFAULT 0,
  PRIMARY KEY (round_id, mentor_id)
);

CREATE TABLE IF NOT EXISTS public.circle_mentor_votes (
  round_id   uuid NOT NULL REFERENCES public.circle_mentor_rounds(id) ON DELETE CASCADE,
  circle_id  uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  mentor_id  uuid NOT NULL REFERENCES public.human_mentors(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (round_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.circle_mentors (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id  uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  mentor_id  uuid NOT NULL REFERENCES public.human_mentors(id) ON DELETE CASCADE,
  round_id   uuid REFERENCES public.circle_mentor_rounds(id) ON DELETE SET NULL,
  status     text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','scheduling','active','paused','ended','declined')),
  swap_used  boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS circle_mentors_one_current ON public.circle_mentors (circle_id) WHERE status IN ('requested','scheduling','active','paused');

CREATE TABLE IF NOT EXISTS public.circle_mentor_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_mentor_id uuid NOT NULL REFERENCES public.circle_mentors(id) ON DELETE CASCADE,
  circle_id        uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  mentor_id        uuid NOT NULL REFERENCES public.human_mentors(id) ON DELETE CASCADE,
  starts_at        timestamptz NOT NULL,
  duration_min     integer NOT NULL DEFAULT 20,
  status           text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','held','cancelled')),
  cancel_reason    text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS circle_mentor_sessions_circle_idx ON public.circle_mentor_sessions (circle_id, starts_at);

CREATE TABLE IF NOT EXISTS public.session_rsvps (
  session_id uuid NOT NULL REFERENCES public.circle_mentor_sessions(id) ON DELETE CASCADE,
  circle_id  uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status     text NOT NULL CHECK (status IN ('going','cannot')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.slot_marks (
  circle_mentor_id uuid NOT NULL REFERENCES public.circle_mentors(id) ON DELETE CASCADE,
  circle_id        uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  slot_id          uuid NOT NULL REFERENCES public.mentor_slots(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (circle_mentor_id, slot_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.mentor_questions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.circle_mentor_sessions(id) ON DELETE CASCADE,
  circle_id  uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.agreement_goals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_mentor_id uuid NOT NULL REFERENCES public.circle_mentors(id) ON DELETE CASCADE,
  circle_id        uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  text             text NOT NULL,
  position         smallint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.agreement_tasks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_mentor_id uuid NOT NULL REFERENCES public.circle_mentors(id) ON DELETE CASCADE,
  circle_id        uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  task             text NOT NULL,
  owner_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  due              date,
  owner_confirmed  boolean NOT NULL DEFAULT false,
  mentor_confirmed boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── audio call attendance (minutes only) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.call_attendance (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id  uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('circle','mentor')),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  left_at    timestamptz,
  minutes    numeric(8,2)
);
CREATE INDEX IF NOT EXISTS call_attendance_joined_idx ON public.call_attendance (joined_at DESC);

-- ── row level security ──────────────────────────────────────────────────────
DO $rls$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sage_conversations','sage_messages','chat_access_log','rx_flags','private_survey_responses','private_growth_scores',
    'circle_mentor_rounds','circle_mentor_candidates','circle_mentor_votes','circle_mentors','circle_mentor_sessions',
    'session_rsvps','slot_marks','mentor_questions','agreement_goals','agreement_tasks','call_attendance'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END
$rls$;

-- The survey tables, logs and flags are for the service role only: no client grants at all.
REVOKE ALL ON public.private_survey_responses, public.private_growth_scores, public.chat_access_log, public.rx_flags, public.call_attendance FROM PUBLIC, anon, authenticated;

-- A mentor of a Circle, for read policies. Mentors see the agreement, sessions and questions, never the chat or reports.
CREATE OR REPLACE FUNCTION public.rx_mentors_circle(cid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circle_mentors cm JOIN public.human_mentors h ON h.id = cm.mentor_id
    WHERE cm.circle_id = cid AND h.user_id = auth.uid() AND cm.status IN ('requested','scheduling','active','paused')
  );
$$;

CREATE OR REPLACE FUNCTION pg_temp.rx_policy2(p_table text, p_name text, p_using text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = p_table AND policyname = p_name) THEN RETURN; END IF;
  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)', p_name, p_table, p_using);
END
$$;

SELECT pg_temp.rx_policy2('sage_conversations','sc_own','user_id = auth.uid()');
SELECT pg_temp.rx_policy2('sage_messages','sgm_own','user_id = auth.uid()');
-- members of the Circle (not the mentor) see rounds, candidates and votes
SELECT pg_temp.rx_policy2('circle_mentor_rounds','cmr_read','public.rx_in_circle(circle_id) OR public.rx_is_staff()');
SELECT pg_temp.rx_policy2('circle_mentor_candidates','cmc_read','public.rx_in_circle(circle_id) OR public.rx_is_staff()');
SELECT pg_temp.rx_policy2('circle_mentor_votes','cmv_read','public.rx_in_circle(circle_id) OR public.rx_is_staff()');
-- members and the mentor see the current mentorship, sessions, RSVPs, marks, questions and the agreement
SELECT pg_temp.rx_policy2('circle_mentors','cm_read','public.rx_in_circle(circle_id) OR public.rx_mentors_circle(circle_id) OR public.rx_is_staff()');
SELECT pg_temp.rx_policy2('circle_mentor_sessions','cms_read','public.rx_in_circle(circle_id) OR public.rx_mentors_circle(circle_id) OR public.rx_is_staff()');
SELECT pg_temp.rx_policy2('session_rsvps','sr_read','public.rx_in_circle(circle_id) OR public.rx_mentors_circle(circle_id) OR public.rx_is_staff()');
SELECT pg_temp.rx_policy2('slot_marks','sm_read','public.rx_in_circle(circle_id) OR public.rx_mentors_circle(circle_id) OR public.rx_is_staff()');
SELECT pg_temp.rx_policy2('mentor_questions','mq_read','public.rx_in_circle(circle_id) OR public.rx_mentors_circle(circle_id) OR public.rx_is_staff()');
SELECT pg_temp.rx_policy2('agreement_goals','ag_read','public.rx_in_circle(circle_id) OR public.rx_mentors_circle(circle_id) OR public.rx_is_staff()');
SELECT pg_temp.rx_policy2('agreement_tasks','at_read','public.rx_in_circle(circle_id) OR public.rx_mentors_circle(circle_id) OR public.rx_is_staff()');

-- ── pathway: one lesson per week, twelve weeks ──────────────────────────────
UPDATE public.rx_lessons SET week_no = 1  WHERE slug = 'choosing-what-you-practise';
UPDATE public.rx_lessons SET week_no = 2  WHERE slug = 'small-promises-kept';
UPDATE public.rx_lessons SET week_no = 3  WHERE slug = 'asking-for-help-well';
UPDATE public.rx_lessons SET week_no = 4  WHERE slug = 'showing-up-for-your-circle';
UPDATE public.rx_lessons SET week_no = 5  WHERE slug = 'mapping-your-first-security-role';
UPDATE public.rx_lessons SET week_no = 6  WHERE slug = 'reading-a-job-post-like-an-analyst';
UPDATE public.rx_lessons SET week_no = 7  WHERE slug = 'prompting-with-care';
UPDATE public.rx_lessons SET week_no = 8  WHERE slug = 'your-first-paying-customer';
UPDATE public.rx_lessons SET week_no = 10 WHERE slug = 'work-that-outlives-you';

INSERT INTO public.rx_lessons (slug, title, dimension, sub, minutes, format, week_no, sort, body) VALUES
 ('when-the-plan-meets-a-hard-week','When the plan meets a hard week','Mind','Resilience',9,'Reading',9,10,
  E'Every plan meets a week that goes wrong. The question is not how to avoid it, but what you do on the first bad day.\n\nShrink the practice instead of dropping it. Five minutes keeps the habit alive and tells you that you are still someone who shows up.\n\nWrite your smaller version down now, while the week is calm, so you do not have to invent it when you are tired.'),
 ('people-who-help-you-grow','People who help you grow','Relationships','Friendship',8,'Reading',11,11,
  E'Growth is rarely solo. Look at the people you spend the most time with and ask which of them make your next step easier.\n\nName one person who stretches you kindly and one you could stretch in return. Reach out to each this week with something specific.\n\nSmall, regular contact matters more than a perfect conversation.'),
 ('what-we-carry-forward','What we carry forward','Legacy','Building something lasting',10,'Video',12,12,
  E'At the end of a cycle the most useful question is not what you finished, but what you will keep.\n\nLook back at your reports and pick the one practice that made the biggest difference. That is the one to carry into the next ninety days.\n\nWrite it as a single sentence you could say to a friend who is just starting.')
ON CONFLICT (slug) DO NOTHING;
