-- ============================================================================
-- 2026-10-06_profile_primary_dimension.sql
-- FIX: onboarding could never be saved. It wrote the member's chosen dimension (purpose, mind, ...)
-- into profiles.ascent_stage, but that column is constrained to the stages seeker/builder/leader, so
-- every save failed the CHECK. (All 38 profiles in the project have ascent_stage NULL.)
--
-- The dimension gets its own column; ascent_stage keeps its meaning (Settings still edits it).
-- Additive and idempotent.
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS primary_dimension text;

DO $c$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_primary_dimension_check
    CHECK (primary_dimension IS NULL OR primary_dimension = ANY (ARRAY[
      'purpose', 'mind', 'character', 'work', 'relationships', 'community', 'legacy'
    ]));
EXCEPTION WHEN duplicate_object THEN NULL;
END
$c$;
