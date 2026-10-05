-- ============================================================================
-- 2026-10-05_member_features.sql
-- Columns and constraints that the member app relies on. Every statement is
-- idempotent and guarded, so it is safe on a database that already has them.
--
--   * user_goals.milestone_N_completed   - dashboard goal card + progress
--   * unique targets for the app's upserts (ON CONFLICT clauses)
--   * lookup indexes for the dashboard and community unread counts
-- ============================================================================

DO $m$
BEGIN
  -- Goal milestones: completion flags drive goal progress on the dashboard.
  IF to_regclass('public.user_goals') IS NOT NULL THEN
    ALTER TABLE public.user_goals
      ADD COLUMN IF NOT EXISTS milestone_1_completed boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS milestone_2_completed boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS milestone_3_completed boolean NOT NULL DEFAULT false;
    CREATE INDEX IF NOT EXISTS user_goals_user_created_idx ON public.user_goals (user_id, created_at DESC);
  END IF;

  IF to_regclass('public.user_commitments') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS user_commitments_user_created_idx ON public.user_commitments (user_id, created_at);
  END IF;

  -- ON CONFLICT (user_id, channel_slug) in /api/community/read
  IF to_regclass('public.channel_read_positions') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS channel_read_positions_user_channel_uniq
      ON public.channel_read_positions (user_id, channel_slug);
  END IF;

  -- ON CONFLICT (endpoint) in /api/push/subscribe*
  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_uniq
      ON public.push_subscriptions (endpoint);
  END IF;

  -- One registration per member per session
  IF to_regclass('public.session_registrations') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS session_registrations_session_user_uniq
      ON public.session_registrations (session_id, user_id);
  END IF;

  -- Upcoming-session lookup (dashboard, experts page, reminders)
  IF to_regclass('public.expert_sessions') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS expert_sessions_status_scheduled_idx
      ON public.expert_sessions (status, scheduled_at);
  END IF;

  -- Referral codes must be unique so onboarding collisions fail loudly
  IF to_regclass('public.profiles') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_uniq
      ON public.profiles (referral_code) WHERE referral_code IS NOT NULL;
  END IF;
END
$m$;
