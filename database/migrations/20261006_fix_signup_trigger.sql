-- ============================================================================
-- 2026-10-06_fix_signup_trigger.sql
-- FIX: sign-up fails with "Database error saving new user".
--
-- Root cause: the trigger on auth.users, on_auth_user_created, runs public.sync_profile_email(),
-- which does `UPDATE profiles SET ...` with an UNQUALIFIED table name and no pinned search_path.
-- Supabase Auth connects with search_path = auth, so `profiles` does not resolve and the whole
-- INSERT into auth.users fails. (No user has been created in the project since 2026-04-01.)
--
-- Reproduced inside a rolled-back transaction:
--   set local search_path = auth; insert into auth.users ...  ->  relation "profiles" does not exist
--
-- Also: no trigger creates the member's profile row (public.handle_new_user exists but is not
-- attached), so a new account had no profile until onboarding upserted one. This migration:
--   1. pins search_path and schema-qualifies sync_profile_email (used by the email-update trigger)
--   2. rewrites handle_new_user to be failure-proof (a profile problem must never block sign-up)
--   3. attaches handle_new_user to AFTER INSERT on auth.users
-- Idempotent. Needs to be run as the postgres role (SQL editor or scripts/apply-migration.ts).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  ref_code    text;
  name_part   text;
  code_exists boolean;
  attempts    integer := 0;
BEGIN
  name_part := UPPER(LEFT(REGEXP_REPLACE(COALESCE(NEW.raw_user_meta_data->>'full_name', 'USR'), '[^a-zA-Z]', '', 'g'), 3));
  IF LENGTH(name_part) < 3 THEN
    name_part := name_part || REPEAT('X', 3 - LENGTH(name_part));
  END IF;

  LOOP
    ref_code := name_part || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = ref_code) INTO code_exists;
    attempts := attempts + 1;
    EXIT WHEN NOT code_exists OR attempts >= 20;
  END LOOP;

  INSERT INTO public.profiles (
    id, full_name, email, role, subscription_plan, subscription_status,
    referral_count, referral_code, created_at, updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), 'New User'),
    NEW.email,
    'member', 'free', 'free', 0, ref_code, NOW(), NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block account creation because of the profile row: onboarding upserts it anyway.
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- on_auth_user_email_updated already exists and keeps using sync_profile_email().
