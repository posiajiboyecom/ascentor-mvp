-- 20261111_group_access.sql
-- Groups can be closed to new members and can have a size limit, both set in Admin → Groups.
--   join_mode    'open'   anyone can join from the app (the default, as today)
--                'closed' only the team can add members
--   max_members  null = no limit
-- Joining is checked in the database too, so the limit holds however a join arrives.

ALTER TABLE public.rx_groups ADD COLUMN IF NOT EXISTS join_mode   text NOT NULL DEFAULT 'open';
ALTER TABLE public.rx_groups ADD COLUMN IF NOT EXISTS max_members integer;
DO $$ BEGIN
  ALTER TABLE public.rx_groups ADD CONSTRAINT rx_groups_join_mode_check CHECK (join_mode IN ('open','closed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.rx_groups ADD CONSTRAINT rx_groups_max_members_check CHECK (max_members IS NULL OR max_members > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- May the signed-in member join this group themselves? Staff always may.
CREATE OR REPLACE FUNCTION public.rx_can_join_group(gid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.rx_is_staff() OR EXISTS (
    SELECT 1 FROM public.rx_groups g
    WHERE g.id = gid
      AND g.status = 'active'
      AND g.join_mode = 'open'
      AND public.rx_can_see_group(gid)
      AND (g.max_members IS NULL OR (SELECT count(*) FROM public.rx_group_members m WHERE m.group_id = gid) < g.max_members)
  );
$$;
REVOKE ALL ON FUNCTION public.rx_can_join_group(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rx_can_join_group(uuid) TO authenticated;

DROP POLICY IF EXISTS gm_join ON public.rx_group_members;
CREATE POLICY gm_join ON public.rx_group_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.rx_can_join_group(group_id));
