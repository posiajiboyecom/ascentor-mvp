-- ============================================================================
-- 2026-10-04_member_data_rls.sql
-- Row Level Security for member-owned tables that had no policies in the repo.
--
-- REVIEW BEFORE APPLYING. Run scripts/audit-rls.sql first to see what is already
-- enabled in your project. Every policy here is additive and idempotent
-- (DROP POLICY IF EXISTS / CREATE POLICY), and each table is skipped if it does
-- not exist, so it cannot break a table that already has working policies.
--
-- Rule of thumb applied: a member can read and write ONLY rows where
-- user_id = auth.uid(). Admins keep full access via the existing admin_all
-- policy (20260704_master_repair.sql) and the service role bypasses RLS.
--
-- NOT touched on purpose (need a design decision, not a blanket policy):
--   community_messages / community_channels - members legitimately read each
--   other's posts and bump like counters on them. Enable RLS there only together
--   with an RPC for likes, otherwise liking breaks. Until then those tables are
--   protected only by the app routes, which is the gap to close next.
-- ============================================================================

DO $rls$
DECLARE
  t text;
  tables text[] := ARRAY[
    'user_goals', 'user_commitments', 'notifications', 'notification_preferences',
    'user_progress', 'usage_tracking', 'channel_read_positions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'skipping % (table not found)', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_own_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (user_id = auth.uid())', t || '_own_select', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_own_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())', t || '_own_insert', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_own_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t || '_own_update', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_own_delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (user_id = auth.uid())', t || '_own_delete', t);
  END LOOP;
END
$rls$;

-- Verify with:
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname = 'public' AND policyname LIKE '%\_own\_%' ORDER BY 1, 2;
