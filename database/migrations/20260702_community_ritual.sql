-- ============================================================================
-- 20260702_community_ritual.sql
-- The Circle → "This Week" ritual: weekly check-ins, streaks, circle rosters.
--
-- HOW TO RUN: paste this whole file into the Supabase SQL Editor
--   (Dashboard → SQL Editor → New query → Run). There is no migrations
--   runner in this repo — same manual convention as the milestone columns
--   documented in app/api/goals/milestone/route.ts.
--
-- Safe to run more than once (IF NOT EXISTS / ON CONFLICT throughout).
--
-- Design: a check-in is NOT a separate table. It's a normal community_messages
-- row flagged with is_checkin + checkin_week. That reuses realtime, reactions,
-- author enrichment, and makes check-ins appear naturally in the circle feed.
-- ============================================================================

-- ── 1. Check-in metadata on messages ────────────────────────────────────────
ALTER TABLE community_messages
  ADD COLUMN IF NOT EXISTS is_checkin   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkin_week date;

-- One check-in per user per week (the ritual is community-wide, once a week).
-- Partial unique index → a duplicate insert fails, which the API turns into a
-- friendly 409 rather than a second row.
CREATE UNIQUE INDEX IF NOT EXISTS community_messages_one_checkin_per_week
  ON community_messages (user_id, checkin_week)
  WHERE is_checkin;

-- Fast "who checked in this week" lookups per channel.
CREATE INDEX IF NOT EXISTS community_messages_checkin_lookup
  ON community_messages (channel, checkin_week)
  WHERE is_checkin;

-- ── 2. Circle membership (circle = channel_type 'circle') ────────────────────
CREATE TABLE IF NOT EXISTS circle_members (
  channel_slug text        NOT NULL REFERENCES community_channels(slug) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES profiles(id)            ON DELETE CASCADE,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_slug, user_id)
);

ALTER TABLE circle_members ENABLE ROW LEVEL SECURITY;

-- Rosters are visible to any signed-in member (so "X of Y checked in" renders).
DROP POLICY IF EXISTS cm_read ON circle_members;
CREATE POLICY cm_read  ON circle_members FOR SELECT TO authenticated USING (true);

-- You can only add / remove yourself.
DROP POLICY IF EXISTS cm_join ON circle_members;
CREATE POLICY cm_join  ON circle_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS cm_leave ON circle_members;
CREATE POLICY cm_leave ON circle_members FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── 3. Weekly prompt ("This week's ascent") ──────────────────────────────────
CREATE TABLE IF NOT EXISTS community_prompts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL UNIQUE,          -- Monday (matches lib/week.ts mondayOf)
  question   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE community_prompts ENABLE ROW LEVEL SECURITY;

-- Everyone reads the prompt. Writes are admin-only via this SQL editor /
-- service role — intentionally no INSERT/UPDATE policy for the client.
DROP POLICY IF EXISTS cp_read ON community_prompts;
CREATE POLICY cp_read ON community_prompts FOR SELECT TO authenticated USING (true);

-- ── 4. Seed ──────────────────────────────────────────────────────────────────
-- This week's question. date_trunc('week', ...) is Monday-based in Postgres,
-- which is exactly what mondayOf() produces on the app side.
INSERT INTO community_prompts (week_start, question) VALUES
  (date_trunc('week', now())::date, 'Where did you show up when it was hard?')
ON CONFLICT (week_start) DO NOTHING;

-- A few weeks ahead so the ritual never shows a blank prompt during testing.
INSERT INTO community_prompts (week_start, question) VALUES
  ((date_trunc('week', now()) + interval '1 week')::date, 'What did you say no to this week — and what did it protect?'),
  ((date_trunc('week', now()) + interval '2 week')::date, 'Where are you still performing instead of being honest?'),
  ((date_trunc('week', now()) + interval '3 week')::date, 'What is the smallest promise you kept to yourself?')
ON CONFLICT (week_start) DO NOTHING;

-- ── 5. OPTIONAL dev seed — populate a circle so "Your Circle" isn't empty ─────
-- Uncomment and edit. Find a circle slug:
--   SELECT slug, name FROM community_channels WHERE channel_type = 'circle';
-- Find user ids:
--   SELECT id, full_name FROM profiles LIMIT 20;
-- Then add members (yourself + a few others) to that circle:
--
-- INSERT INTO circle_members (channel_slug, user_id) VALUES
--   ('summit-five', '00000000-0000-0000-0000-000000000000'),  -- you
--   ('summit-five', '11111111-1111-1111-1111-111111111111')
-- ON CONFLICT DO NOTHING;
--
-- If no circle channel exists yet, create one first:
-- INSERT INTO community_channels (slug, name, description, channel_type, category_id, sort_order)
-- VALUES ('summit-five', 'Summit Five', 'Your weekly accountability circle', 'circle',
--         (SELECT id FROM community_categories ORDER BY sort_order LIMIT 1), 1)
-- ON CONFLICT (slug) DO NOTHING;
