-- ============================================================================
-- 2026-09-14_profiles_rls.sql
-- Enable and configure Row Level Security on the profiles table.
--
-- Existing admin_all policy from 20260704_master_repair.sql already covers
-- all public tables, including profiles, using public.is_admin(). It will
-- become active once RLS is enabled. This migration adds the remaining
-- policies needed for normal users and moderators, and a trigger to stop
-- non-admins from updating role or permissions even on their own row.
-- ============================================================================

-- ── Helper for moderator checks ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'moderator'
  );
$$;

-- ── Trigger: only admins (or service role / RLS-bypass) may change role/permissions ──
CREATE OR REPLACE FUNCTION public.check_profile_role_permissions()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- auth.uid() is NULL for service-role / RLS-bypass calls, so we allow those.
  -- For any logged-in user, only an admin may change role or permissions.
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.permissions IS DISTINCT FROM OLD.permissions THEN
      RAISE EXCEPTION 'Only admins can update role or permissions';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_profile_role_permissions ON public.profiles;
CREATE TRIGGER check_profile_role_permissions
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_role_permissions();

-- ── Enable RLS on profiles ───────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop and recreate the policies this migration owns, so the file is idempotent.
DROP POLICY IF EXISTS profiles_own_read ON public.profiles;
DROP POLICY IF EXISTS profiles_own_update ON public.profiles;
DROP POLICY IF EXISTS profiles_moderator_read ON public.profiles;

-- Authenticated users can read and update their own row.
-- (Admins are already covered by admin_all; this handles non-admin users.)
CREATE POLICY profiles_own_read ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_own_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Moderators can read any profile, but updates are still limited by the
-- trigger and the absence of an update policy granting them access.
CREATE POLICY profiles_moderator_read ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_moderator());

-- ============================================================================
-- Verify with:
--   SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'profiles';
-- ============================================================================
