// app/api/community/checkin/route.ts
// ─────────────────────────────────────────────────────────────────────────
// POST /api/community/checkin
// Records the current user's weekly ritual check-in for The Circle.
//
// A check-in is a normal community_messages row flagged is_checkin=true and
// stamped with checkin_week (this week's Monday). It is posted into EVERY
// circle the user belongs to, so check-in status shows accurately on all
// circle cards and counts toward "X of Y checked in this week" in each.
//
// The unique partial index (user_id, checkin_week WHERE is_checkin) was
// designed for a single-circle world. With fan-out we lift that constraint by
// including channel_slug in the uniqueness key — each (user, week, channel)
// triple can only have one check-in. The migration below updates the index.
//
// Request body:
//   { content: string, dimensionTag?: string | null }
//
// Response:
//   200 { message }                 — the first inserted check-in row
//                                     (client uses it for optimistic UI)
//   400 { error }                   — empty content / bad dimension / no circles
//   401 { error }                   — not authenticated
//   409 { error }                   — already checked in this week (all circles)
//   500 { error }                   — database error
//
// ── Database prerequisites ────────────────────────────────────────────────
// 1. database/migrations/20260702_community_ritual.sql
//    (is_checkin, checkin_week on community_messages; circle_members table)
// 2. Run the index migration in this file's header comment to replace the
//    single-column unique index with a per-channel one.
//
// ── Index migration (run once in Supabase SQL Editor) ─────────────────────
//
//   -- Drop the old global-per-week index and replace with per-channel one.
//   DROP INDEX IF EXISTS community_messages_one_checkin_per_week;
//
//   CREATE UNIQUE INDEX IF NOT EXISTS community_messages_one_checkin_per_channel_week
//     ON community_messages (user_id, channel, checkin_week)
//     WHERE is_checkin;
//
// Safe to run more than once (IF NOT EXISTS / DROP IF EXISTS).
// ─────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mondayOf } from '@/lib/week';

const VALID_DIMENSIONS = new Set([
  'Mind', 'Vocation', 'Character', 'Relationships', 'Community', 'Legacy',
]);

const MESSAGE_COLUMNS =
  'id, user_id, channel, content, reply_to_id, created_at, likes, pinned, dimension_tag, reply_count, is_checkin, checkin_week';

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Parse body ──────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { content, dimensionTag } = body as { content: unknown; dimensionTag: unknown };

  if (typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'Write a reflection before checking in.' }, { status: 400 });
  }
  const text = content.trim().slice(0, 2000);

  let dimension: string | null = null;
  if (dimensionTag != null) {
    if (typeof dimensionTag !== 'string' || !VALID_DIMENSIONS.has(dimensionTag)) {
      return NextResponse.json({ error: 'Invalid dimension.' }, { status: 400 });
    }
    dimension = dimensionTag;
  }

  // ── Resolve ALL of the user's circles ────────────────────────────────────
  // Fan-out: the check-in lands in every circle they belong to so "X of Y
  // checked in" is accurate on all circle cards, not just the first one joined.
  const { data: memberships, error: memberError } = await supabase
    .from('circle_members')
    .select('channel_slug')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true });

  if (memberError) {
    console.error('[checkin route] membership lookup failed:', memberError.message);
    return NextResponse.json({ error: 'Could not load your circles.' }, { status: 500 });
  }
  if (!memberships || memberships.length === 0) {
    return NextResponse.json(
      { error: 'Join a circle before checking in.' },
      { status: 400 }
    );
  }

  const week = mondayOf();
  const circleSlugs = memberships.map((m: { channel_slug: string }) => m.channel_slug);

  // ── Detect duplicate check-in ────────────────────────────────────────────
  // A user who has already checked in this week in ANY of their circles gets a
  // 409. We check before inserting to give a clean error instead of relying
  // solely on the unique index (which would give a less helpful 500 for the
  // second+ circles that aren't the conflict source).
  const { count: existingCount } = await supabase
    .from('community_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_checkin', true)
    .eq('checkin_week', week)
    .in('channel', circleSlugs);

  if (existingCount && existingCount > 0) {
    return NextResponse.json(
      { error: "You've already checked in this week." },
      { status: 409 }
    );
  }

  // ── Insert one check-in row per circle ────────────────────────────────────
  // We insert all rows in a single .insert([...]) call. Supabase executes this
  // as one multi-row INSERT, which is atomic and efficient.
  const rows = circleSlugs.map((slug: string) => ({
    user_id: user.id,
    channel: slug,
    content: text,
    dimension_tag: dimension,
    is_checkin: true,
    checkin_week: week,
    likes: [],
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('community_messages')
    .insert(rows)
    .select(MESSAGE_COLUMNS);

  if (insertError) {
    // 23505 = unique_violation → race condition (two tabs, two requests).
    // The user effectively checked in; treat as success for the client.
    if ((insertError as { code?: string }).code === '23505') {
      return NextResponse.json(
        { error: "You've already checked in this week." },
        { status: 409 }
      );
    }
    console.error('[checkin route] insert failed:', insertError.message);
    return NextResponse.json({ error: 'Check-in failed. Try again.' }, { status: 500 });
  }

  if (!inserted || inserted.length === 0) {
    console.error('[checkin route] insert returned no rows');
    return NextResponse.json({ error: 'Check-in failed. Try again.' }, { status: 500 });
  }

  // Return the first row — the client uses it for optimistic UI (hero + circle
  // card update). All circles get the check-in; the client's snapshot is
  // updated on the next server render or realtime update.
  return NextResponse.json({ message: inserted[0] });
}
