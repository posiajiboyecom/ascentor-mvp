-- ============================================================================
-- 2026-10-07_member_directory.sql
-- Members can read each other's NAME and AVATAR only, never the rest of a profile.
--
-- Before: policy profiles_read (FOR SELECT TO authenticated USING (true)) let any signed-in member
-- read every column of every profile: email, subscription and billing fields, referral data,
-- payment-method details, WhatsApp number, role and permissions.
--
-- Now: the table itself is readable only by its owner (profiles_own_read / profiles_select),
-- moderators (profiles_moderator_read) and admins (admin_all). Anything that must show another
-- member's name (Circle messages, check-in rosters, course discussions) reads this view, which
-- exposes exactly three columns. The view runs with its owner's rights (it is not security_invoker),
-- so it can read the table, and it is granted only to signed-in users.
-- Idempotent.
-- ============================================================================

CREATE OR REPLACE VIEW public.member_directory AS
  SELECT id, full_name, avatar_url
  FROM public.profiles;

REVOKE ALL ON public.member_directory FROM PUBLIC, anon;
GRANT SELECT ON public.member_directory TO authenticated;

DROP POLICY IF EXISTS profiles_read ON public.profiles;
