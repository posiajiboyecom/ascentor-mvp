// app/api/community/circle/route.ts
// ─────────────────────────────────────────────────────────────────────────
// POST   /api/community/circle   { slug }   → join a circle
// DELETE /api/community/circle   { slug }   → leave a circle
//
// Membership is what makes "X of Y checked in" real: Y is the circle's roster.
// A member can only add / remove themselves (enforced here AND by the
// circle_members RLS policies in the migration — defence in depth).
//
// Response:
//   200 { ok: true }
//   400 { error }   — missing slug / not a circle channel
//   401 { error }   — not authenticated
//   500 { error }   — database error
//
// Requires database/migrations/20260702_community_ritual.sql (circle_members).
// ─────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function readSlug(req: Request): Promise<string | null> {
  try {
    const body = (await req.json()) as { slug?: unknown };
    return typeof body.slug === 'string' && body.slug.trim() ? body.slug.trim() : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const slug = await readSlug(req);
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

  // Only circle-type channels can be joined.
  const { data: channel, error: channelError } = await supabase
    .from('community_channels')
    .select('slug, channel_type')
    .eq('slug', slug)
    .maybeSingle();

  if (channelError) {
    console.error('[circle route] channel lookup failed:', channelError.message);
    return NextResponse.json({ error: 'Could not load that circle.' }, { status: 500 });
  }
  if (!channel || channel.channel_type !== 'circle') {
    return NextResponse.json({ error: 'That channel is not a circle.' }, { status: 400 });
  }

  const { error: insertError } = await supabase
    .from('circle_members')
    .upsert({ channel_slug: slug, user_id: user.id }, { onConflict: 'channel_slug,user_id' });

  if (insertError) {
    console.error('[circle route] join failed:', insertError.message);
    return NextResponse.json({ error: 'Could not join the circle.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const slug = await readSlug(req);
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

  const { error } = await supabase
    .from('circle_members')
    .delete()
    .eq('channel_slug', slug)
    .eq('user_id', user.id);

  if (error) {
    console.error('[circle route] leave failed:', error.message);
    return NextResponse.json({ error: 'Could not leave the circle.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
