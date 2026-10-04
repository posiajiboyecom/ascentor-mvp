// app/api/community/read/route.ts
// ─────────────────────────────────────────────────────────────────────────
// POST /api/community/read   { slug: string }
//
// Marks a channel as fully read for the current user by upserting their
// last_read_at timestamp in channel_read_positions. Called by CommunityClient
// whenever a channel is opened (selectChannel) so the unread badge clears.
//
// This is a fire-and-forget route from the client's perspective - failures
// only mean the badge stays stale until the next page load, which is fine.
//
// Response:
//   200 { ok: true }
//   400 { error }   - missing or invalid slug
//   401 { error }   - not authenticated
//   500 { error }   - database error
//
// Requires: database/migrations/20260702_community_read_positions.sql
// ─────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseJson, parseQuery } from '@/lib/validation/http';
import * as memberSchemas from '@/lib/validation/schemas/member';

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = await parseJson(req, memberSchemas.channelSlug);
  if (!parsed.ok) return parsed.response;
  const slug = parsed.data.slug;

  const { error } = await supabase
    .from('channel_read_positions')
    .upsert(
      { user_id: user.id, channel_slug: slug, last_read_at: new Date().toISOString() },
      { onConflict: 'user_id,channel_slug' }
    );

  if (error) {
    console.error('[read route] upsert failed:', error.message);
    return NextResponse.json({ error: 'Could not mark channel as read.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
