-- Circle agendas: prepared by the Circle's members before the weekly call, shown live during it.
-- Additive and idempotent. Run on the existing project with:
--   npx tsx scripts/apply-migration.ts database/migrations/20261107_circle_agendas.sql --yes
--
-- circle_agendas  one row per agenda; the call uses the most recent one for the Circle.
-- agenda_items    ordered items (position), each with a title and an optional duration in minutes.
--
-- Access: members of the Circle (any seat) read and write its agenda; nobody else can (staff may read).
-- The current item during a call (current_item_index / current_item_started_at) is set only by the facilitator,
-- through /api/rx/call/agenda (service role), so members cannot change those two columns directly.

CREATE TABLE IF NOT EXISTS public.circle_agendas (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id               uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  created_by              uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  updated_by              uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  current_item_index      integer NOT NULL DEFAULT 0 CHECK (current_item_index >= 0),
  current_item_started_at timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS circle_agendas_circle_idx ON public.circle_agendas (circle_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.agenda_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_id        uuid NOT NULL REFERENCES public.circle_agendas(id) ON DELETE CASCADE,
  position         integer NOT NULL DEFAULT 0,
  title            text NOT NULL DEFAULT '' CHECK (char_length(title) <= 200),
  duration_minutes integer CHECK (duration_minutes IS NULL OR (duration_minutes BETWEEN 1 AND 240)),
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agenda_items_agenda_idx ON public.agenda_items (agenda_id, position);

-- The Circle an agenda belongs to (SECURITY DEFINER so item policies don't recurse through circle_agendas RLS).
CREATE OR REPLACE FUNCTION public.rx_agenda_circle(aid uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT circle_id FROM public.circle_agendas WHERE id = aid;
$$;

-- Any change to an agenda's items records who last edited it and when ("Last updated by Emmanuel · 2h ago").
CREATE OR REPLACE FUNCTION public.rx_agenda_touch() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_aid uuid := COALESCE(NEW.agenda_id, OLD.agenda_id);
BEGIN
  UPDATE public.circle_agendas SET updated_at = now(), updated_by = COALESCE(auth.uid(), updated_by) WHERE id = v_aid;
  RETURN NULL;
END
$$;
DROP TRIGGER IF EXISTS agenda_items_touch ON public.agenda_items;
CREATE TRIGGER agenda_items_touch AFTER INSERT OR UPDATE OR DELETE ON public.agenda_items
  FOR EACH ROW EXECUTE FUNCTION public.rx_agenda_touch();

-- ── row level security ──────────────────────────────────────────────────────
ALTER TABLE public.circle_agendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_items   ENABLE ROW LEVEL SECURITY;

DO $p$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='circle_agendas' AND policyname='ca_read') THEN
    CREATE POLICY ca_read ON public.circle_agendas FOR SELECT TO authenticated
      USING (public.rx_in_circle(circle_id) OR public.rx_is_staff());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='circle_agendas' AND policyname='ca_insert') THEN
    CREATE POLICY ca_insert ON public.circle_agendas FOR INSERT TO authenticated
      WITH CHECK (public.rx_in_circle(circle_id) AND created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='circle_agendas' AND policyname='ca_update') THEN
    CREATE POLICY ca_update ON public.circle_agendas FOR UPDATE TO authenticated
      USING (public.rx_in_circle(circle_id)) WITH CHECK (public.rx_in_circle(circle_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='circle_agendas' AND policyname='ca_delete') THEN
    CREATE POLICY ca_delete ON public.circle_agendas FOR DELETE TO authenticated
      USING (public.rx_in_circle(circle_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='agenda_items' AND policyname='ai_read') THEN
    CREATE POLICY ai_read ON public.agenda_items FOR SELECT TO authenticated
      USING (public.rx_in_circle(public.rx_agenda_circle(agenda_id)) OR public.rx_is_staff());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='agenda_items' AND policyname='ai_insert') THEN
    CREATE POLICY ai_insert ON public.agenda_items FOR INSERT TO authenticated
      WITH CHECK (public.rx_in_circle(public.rx_agenda_circle(agenda_id)) AND created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='agenda_items' AND policyname='ai_update') THEN
    CREATE POLICY ai_update ON public.agenda_items FOR UPDATE TO authenticated
      USING (public.rx_in_circle(public.rx_agenda_circle(agenda_id)))
      WITH CHECK (public.rx_in_circle(public.rx_agenda_circle(agenda_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='agenda_items' AND policyname='ai_delete') THEN
    CREATE POLICY ai_delete ON public.agenda_items FOR DELETE TO authenticated
      USING (public.rx_in_circle(public.rx_agenda_circle(agenda_id)));
  END IF;
END
$p$;

-- Column grants: members never set the live current item or move an item to another agenda.
REVOKE INSERT, UPDATE ON public.circle_agendas FROM authenticated, anon;
GRANT SELECT, DELETE ON public.circle_agendas TO authenticated;
GRANT INSERT (circle_id, created_by, updated_by) ON public.circle_agendas TO authenticated;
GRANT UPDATE (updated_by, updated_at) ON public.circle_agendas TO authenticated;

REVOKE INSERT, UPDATE ON public.agenda_items FROM authenticated, anon;
GRANT SELECT, DELETE ON public.agenda_items TO authenticated;
GRANT INSERT (agenda_id, position, title, duration_minutes, created_by) ON public.agenda_items TO authenticated;
GRANT UPDATE (position, title, duration_minutes) ON public.agenda_items TO authenticated;

-- Realtime: members editing the same agenda see each other's changes; the call sees the facilitator's current item.
DO $rt$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['circle_agendas','agenda_items'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END
$rt$;
