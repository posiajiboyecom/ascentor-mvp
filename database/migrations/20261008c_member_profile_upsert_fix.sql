-- ============================================================================
-- 2026-10-08c_member_profile_upsert_fix.sql
-- FIX: the app saves member_profile with an upsert, which re-sets user_id when the row already exists. That needs
-- UPDATE on user_id. Row level security (user_id = auth.uid() in USING and WITH CHECK) still stops anyone from
-- moving a row to another user. is_facilitator stays unwritable by members. Idempotent.
-- ============================================================================
GRANT UPDATE (user_id) ON public.member_profile TO authenticated;
