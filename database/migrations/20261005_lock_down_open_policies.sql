-- ============================================================================
-- 2026-10-05_lock_down_open_policies.sql
-- SECURITY: closes Row Level Security policies that let ANY caller holding the public
-- anon key (it ships in the browser bundle) read or write sensitive tables.
--
-- Found by exporting the live schema (database/migrations/00000000_baseline.sql) and
-- querying pg_policies for permissive write policies whose predicate is literally TRUE.
--
-- Root cause: policies named "Service role ..." were created FOR ... TO public. The
-- service role bypasses RLS entirely, so those policies grant nothing to it, but they DO
-- grant everything to the "public" pseudo-role, which includes anon and authenticated.
--
--   partners, partner_members, partner_transactions   FOR ALL USING (true)  -> anyone can read, edit
--        and delete every white-label tenant, including partners.paystack_secret_key
--   payments, product_purchases                       INSERT WITH CHECK (true) -> forged purchases
--   usage_tracking, session_locations, audit_logs     INSERT WITH CHECK (true) -> forged records
--   notifications                                     INSERT by any authenticated user for any user_id
--   referrals                                         INSERT / UPDATE (true)  -> forged referral rewards
--   push_subscriptions, push_events                   FOR ALL (true)           -> read or delete anyone's push endpoints
--   platform_settings, community_categories           FOR ALL (true) TO authenticated, named "admin write"
--        -> any signed-in member could flip checkout, stream or gating settings
--
-- Every replacement is the narrowest policy the application actually needs. Server code uses
-- the service-role key for system writes, which bypasses RLS, so no policy is required for it.
--
-- REVIEW, then apply in the Supabase SQL editor. Idempotent. Not applied automatically.
-- Rollback: re-create a dropped policy from 00000000_baseline.sql.
-- ============================================================================

DO $lock$
DECLARE
  r record;
BEGIN
  -- 1. Drop the open policies (guarded: skip tables/policies that do not exist).
  FOR r IN
    SELECT * FROM (VALUES
      ('partners',             'Service role full access partners'),
      ('partner_members',      'Service role full access members'),
      ('partner_transactions', 'Service role full access transactions'),
      ('payments',             'Service insert payments'),
      ('product_purchases',    'Service role can insert purchases'),
      ('usage_tracking',       'Service insert usage'),
      ('usage_tracking',       'Service inserts usage'),
      ('session_locations',    'Service insert session locations'),
      ('audit_logs',           'Service role insert audit'),
      ('audit_logs',           'audit_logs_insert'),
      ('notifications',        'Service insert notifications'),
      ('notifications',        'Service role insert notifications'),
      ('notifications',        'Authenticated users can create notifications'),
      ('notifications',        'Authenticated users insert notifications'),
      ('referrals',            'System can insert referrals'),
      ('referrals',            'System can update referrals'),
      ('push_subscriptions',   'push_subs_service'),
      ('push_events',          'push_events_service'),
      ('platform_settings',    'admin write'),
      ('community_categories', 'admin write')
    ) AS v(tbl, pol)
  LOOP
    IF to_regclass('public.' || r.tbl) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.pol, r.tbl);
    END IF;
  END LOOP;
END
$lock$;

-- 2. Narrow replacements for the writes the application genuinely performs as the signed-in user.

-- Coach quota rows: a member records and (on failure) removes their own usage.
DO $p$ BEGIN
  IF to_regclass('public.usage_tracking') IS NOT NULL THEN
    DROP POLICY IF EXISTS usage_insert_own ON public.usage_tracking;
    CREATE POLICY usage_insert_own ON public.usage_tracking FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
    DROP POLICY IF EXISTS usage_delete_own ON public.usage_tracking;
    CREATE POLICY usage_delete_own ON public.usage_tracking FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;
END $p$;

-- Audit trail: a signed-in user may only write entries attributed to themselves.
DO $p$ BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    DROP POLICY IF EXISTS audit_logs_insert_own ON public.audit_logs;
    CREATE POLICY audit_logs_insert_own ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
END $p$;

-- Notifications: a signed-in user may create notifications for themselves only.
DO $p$ BEGIN
  IF to_regclass('public.notifications') IS NOT NULL THEN
    DROP POLICY IF EXISTS notifications_insert_own ON public.notifications;
    CREATE POLICY notifications_insert_own ON public.notifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
END $p$;

-- Referrals: a member may record that THEY were referred, and see or update only rows they are part of.
DO $p$ BEGIN
  IF to_regclass('public.referrals') IS NOT NULL THEN
    DROP POLICY IF EXISTS referrals_insert_as_referred ON public.referrals;
    CREATE POLICY referrals_insert_as_referred ON public.referrals FOR INSERT TO authenticated WITH CHECK (referred_id = auth.uid());
    DROP POLICY IF EXISTS referrals_update_participant ON public.referrals;
    CREATE POLICY referrals_update_participant ON public.referrals FOR UPDATE TO authenticated
      USING (auth.uid() IN (referrer_id, referred_id)) WITH CHECK (auth.uid() IN (referrer_id, referred_id));
  END IF;
END $p$;

-- 3. Settings and categories remain readable by everyone (public read) and writable by admins
--    only, through the existing admin_all policy (is_admin()).

-- Verify: this should return no rows.
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname = 'public' AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
--     AND (qual IN ('true','(true)') OR with_check IN ('true','(true)'))
--     AND roles::text !~ 'service_role'
--     AND tablename NOT IN ('contact_messages','newsletter_subscribers','waitlist_entries','job_applications',
--                           'mentor_applications','partner_enquiries','event_registrations','survey_responses',
--                           'summit_interest','content_calendar');
-- (The excluded tables are intentional public-submission forms.)
