-- ============================================================================
-- 2026-10-08b_member_profile_grant_fix.sql
-- FIX: onboarding could not save. The member_profile INSERT grant omitted updated_at, which every save writes,
-- so each upsert failed with "permission denied for table member_profile". Members still cannot write
-- is_facilitator. Idempotent.
-- ============================================================================
GRANT INSERT (updated_at) ON public.member_profile TO authenticated;
