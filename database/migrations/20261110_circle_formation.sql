-- Circles form fast and name themselves; mentor agendas reach the mentor 48 hours ahead.
-- Additive and idempotent. Run in the Supabase SQL editor, or:
--   npx tsx scripts/apply-migration.ts database/migrations/20261110_circle_formation.sql --yes
--
-- 1. A Circle becomes active (its 90-day cycle starts) when it reaches 4 members, not 6. It keeps filling to 8.
-- 2. Nobody waits more than 48 hours: rx_form_circles() (run hourly) takes any Circle still forming 48 hours after it was
--    created and merges it into the best matching Circle with room, or starts it as it is if it has 3 members. A Circle with
--    fewer than 3 and nowhere to go is reported so admins can step in.
-- 3. New Circles are named after mountain peaks ("Kilimanjaro", "Olumo", "Denali"…), never repeated. Existing names stay.
-- 4. circle_mentor_sessions records when the agenda was sent to the mentor (48 hours before) and when the Circle was reminded.

ALTER TABLE public.circles ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES public.circles(id) ON DELETE SET NULL;
ALTER TABLE public.circle_mentor_sessions ADD COLUMN IF NOT EXISTS agenda_sent_at     timestamptz;
ALTER TABLE public.circle_mentor_sessions ADD COLUMN IF NOT EXISTS agenda_reminded_at timestamptz;

-- ── names ───────────────────────────────────────────────────────────────────
-- The first peak no Circle is called yet. African peaks first, then the world's. After the list: "Peak <n>".
CREATE OR REPLACE FUNCTION public.rx_next_circle_name() RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  peaks text[] := ARRAY[
    'Kilimanjaro','Olumo','Zuma','Aso','Idanre','Chappal Waddi','Obudu','Shere','Kenya','Rwenzori','Elgon','Meru','Cameroon',
    'Toubkal','Simien','Ras Dashen','Drakensberg','Table Mountain','Sapitwa','Mulanje','Nyiragongo','Karisimbi','Stanley','Margherita',
    'Kinabalu','Atlas','Hoggar','Tibesti','Ahaggar','Mount Afadja','Nimba','Bintumani','Loma','Mount Gorongosa','Inyangani','Binga',
    'Everest','Denali','Aconcagua','Elbrus','Vinson','Kosciuszko','Fuji','Olympus','Matterhorn','Mont Blanc','Rainier','Whitney',
    'Logan','Cotopaxi','Chimborazo','Huascaran','Illimani','Fitz Roy','Cook','Ararat','Damavand','Annapurna','Lhotse','Makalu',
    'Kangchenjunga','Nanga Parbat','K2','Shasta','Hood','Sinai','Etna','Vesuvius','Teide','Ben Nevis','Snowdon','Triglav',
    'Eiger','Jungfrau','Zugspitze','Rysy','Musala','Kazbek','Ushba','Belukha','Kailash','Ama Dablam','Pumori','Cho Oyu'
  ];
  p text;
  n integer;
BEGIN
  FOREACH p IN ARRAY peaks LOOP
    IF NOT EXISTS (SELECT 1 FROM public.circles WHERE lower(name) = lower(p)) THEN RETURN p; END IF;
  END LOOP;
  SELECT count(*) + 1 INTO n FROM public.circles WHERE name LIKE 'Peak %';
  RETURN 'Peak ' || n;
END;
$$;

-- ── placement (unchanged rules, except: starts at 4, peak names) ───────────
CREATE OR REPLACE FUNCTION public.rx_assign_circle(p_user uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tz    text;
  v_lang  text;
  v_stage text;
  v_slots text[];
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
  ORDER BY (c.status = 'forming') DESC,              -- fill Circles that are still forming first, so they start sooner
           (c.stage = v_stage) DESC NULLS LAST,
           (c.slot = ANY (v_slots)) DESC NULLS LAST,
           (c.timezone = v_tz) DESC NULLS LAST,
           c.created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_cid IS NULL THEN
    SELECT COALESCE(max(number), 0) + 1 INTO v_n FROM public.circles;
    SELECT user_id INTO v_fac FROM public.member_profile mp
      WHERE mp.is_facilitator AND NOT mp.is_demo
        AND NOT EXISTS (SELECT 1 FROM public.circles x WHERE x.facilitator_id = mp.user_id AND x.status <> 'completed')
      LIMIT 1;
    INSERT INTO public.circles (name, number, timezone, language, stage, slot, facilitator_id)
      VALUES (public.rx_next_circle_name(), v_n, v_tz, v_lang, v_stage, v_slots[1], v_fac)
      RETURNING id INTO v_cid;
    IF v_fac IS NOT NULL THEN
      INSERT INTO public.circle_seats (circle_id, user_id, role) VALUES (v_cid, v_fac, 'facilitator') ON CONFLICT DO NOTHING;
    END IF;
    INSERT INTO public.circle_messages (circle_id, user_id, body, pinned)
      VALUES (v_cid, NULL, 'Welcome, everyone. Tell us your name and one thing you''re working on.', true);
  END IF;

  INSERT INTO public.circle_seats (circle_id, user_id, role) VALUES (v_cid, p_user, 'member') ON CONFLICT DO NOTHING;

  SELECT count(*) INTO v_n FROM public.circle_seats WHERE circle_id = v_cid AND role = 'member';
  IF v_n >= 4 THEN
    UPDATE public.circles SET status = 'active', cycle_start = COALESCE(cycle_start, current_date) WHERE id = v_cid;
  END IF;
  RETURN v_cid;
END;
$$;
REVOKE ALL ON FUNCTION public.rx_assign_circle(uuid) FROM PUBLIC, anon, authenticated;

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
  IF v_n + 1 >= 4 THEN
    UPDATE public.circles SET status = 'active', cycle_start = COALESCE(cycle_start, current_date) WHERE id = p_circle;
  END IF;
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.rx_join_circle(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;

-- ── the 48-hour rule ────────────────────────────────────────────────────────
-- Every home Circle still forming 48 hours after it was created is settled:
--   • merged into the best matching Circle with room (same language; prefers same stage, then time zone, then the fullest),
--     whose own facilitator and chat carry on; the old Circle is closed with merged_into set;
--   • or, with nowhere to go, started as it is when it has 3 or more members;
--   • or, with fewer than 3, reported as waiting so an admin can help (new members still fill it first meanwhile).
-- Returns { merged: [{from, to, users}], started: [ids], waiting: [ids] } so the caller can tell people.
CREATE OR REPLACE FUNCTION public.rx_form_circles(p_hours integer DEFAULT 48) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c        record;
  v_n      integer;
  v_target uuid;
  v_tn     integer;
  v_users  uuid[];
  merged   jsonb := '[]'::jsonb;
  started  jsonb := '[]'::jsonb;
  waiting  jsonb := '[]'::jsonb;
  v_title  text;
BEGIN
  FOR c IN
    SELECT id, name, number, language, stage, timezone FROM public.circles
    WHERE status = 'forming' AND interest IS NULL AND NOT is_demo AND created_at <= now() - make_interval(hours => p_hours)
    ORDER BY created_at
  LOOP
    PERFORM 1 FROM public.circles WHERE id = c.id AND status = 'forming' FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;   -- settled earlier in this run (it was another Circle's merge target)
    SELECT count(*) INTO v_n FROM public.circle_seats WHERE circle_id = c.id AND role = 'member';

    IF v_n = 0 THEN
      UPDATE public.circles SET status = 'completed' WHERE id = c.id;   -- everyone left: close it quietly
      CONTINUE;
    END IF;
    IF v_n >= 4 THEN
      UPDATE public.circles SET status = 'active', cycle_start = COALESCE(cycle_start, current_date) WHERE id = c.id;
      started := started || to_jsonb(c.id);
      CONTINUE;
    END IF;

    SELECT t.id INTO v_target
    FROM public.circles t
    WHERE t.id <> c.id AND t.status IN ('forming','active') AND t.interest IS NULL AND NOT t.is_demo
      AND COALESCE(t.language, 'English') = COALESCE(c.language, 'English')
      AND (t.status = 'forming' OR t.cycle_start > current_date - 14)
      AND (SELECT count(*) FROM public.circle_seats s WHERE s.circle_id = t.id AND s.role = 'member') + v_n <= 8
    ORDER BY (t.stage IS NOT DISTINCT FROM c.stage) DESC,
             (t.timezone IS NOT DISTINCT FROM c.timezone) DESC,
             (SELECT count(*) FROM public.circle_seats s WHERE s.circle_id = t.id AND s.role = 'member') DESC,
             t.created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_target IS NOT NULL THEN
      SELECT array_agg(user_id) INTO v_users FROM public.circle_seats WHERE circle_id = c.id AND role = 'member';
      INSERT INTO public.circle_seats (circle_id, user_id, role, pledged_at)
        SELECT v_target, s.user_id, 'member', s.pledged_at FROM public.circle_seats s WHERE s.circle_id = c.id AND s.role = 'member'
        ON CONFLICT DO NOTHING;
      DELETE FROM public.circle_seats WHERE circle_id = c.id;
      UPDATE public.circles SET status = 'completed', merged_into = v_target WHERE id = c.id;
      INSERT INTO public.circle_messages (circle_id, user_id, body, pinned)
        VALUES (v_target, NULL, format('%s new %s joined this Circle. Say hello and share one thing you''re working on.', v_n, CASE WHEN v_n = 1 THEN 'member' ELSE 'members' END), false);
      SELECT count(*) INTO v_tn FROM public.circle_seats WHERE circle_id = v_target AND role = 'member';
      IF v_tn >= 4 THEN
        UPDATE public.circles SET status = 'active', cycle_start = COALESCE(cycle_start, current_date) WHERE id = v_target AND status = 'forming';
      END IF;
      merged := merged || jsonb_build_object('from', c.id, 'to', v_target, 'users', to_jsonb(v_users));
    ELSIF v_n >= 3 THEN
      UPDATE public.circles SET status = 'active', cycle_start = COALESCE(cycle_start, current_date) WHERE id = c.id;
      started := started || to_jsonb(c.id);
    ELSE
      waiting := waiting || to_jsonb(c.id);
    END IF;
  END LOOP;
  RETURN jsonb_build_object('merged', merged, 'started', started, 'waiting', waiting);
END;
$$;
REVOKE ALL ON FUNCTION public.rx_form_circles(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rx_form_circles(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.rx_next_circle_name() TO service_role;

-- Circles already forming with 4 or more members start now (the new threshold).
UPDATE public.circles c SET status = 'active', cycle_start = COALESCE(cycle_start, current_date)
WHERE c.status = 'forming' AND c.interest IS NULL AND NOT c.is_demo
  AND (SELECT count(*) FROM public.circle_seats s WHERE s.circle_id = c.id AND s.role = 'member') >= 4;
