// app/api/admin/videos/attach/route.ts
// POST { kind: 'rx_lesson', targetId, videoId | null }
// Links an uploaded video (ascentor_videos) to a lesson, or unlinks it.
// Used by the Pathways and lessons drawer in the admin console, which
// saves as soon as a video is uploaded or chosen.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { guardApi } from '@/lib/admin/api-guard';

const UUID = /^[0-9a-f-]{36}$/i;
const TABLES = { rx_lesson: 'rx_lessons' } as const;

export async function POST(req: NextRequest) {
  const _g = await guardApi('pathways', 'edit', req);
  if ('error' in _g) return _g.res;

  const body = (await req.json().catch(() => ({}))) as { kind?: string; targetId?: string; videoId?: string | null };
  const table = TABLES[body.kind as keyof typeof TABLES];
  if (!table) return NextResponse.json({ error: 'Unknown item type.' }, { status: 400 });
  if (!body.targetId || !UUID.test(body.targetId)) return NextResponse.json({ error: 'Missing lesson.' }, { status: 400 });
  const videoId = body.videoId ?? null;
  if (videoId !== null && !UUID.test(videoId)) return NextResponse.json({ error: 'Invalid video.' }, { status: 400 });

  if (videoId) {
    const { data: v } = await supabaseAdmin.from('ascentor_videos').select('id').eq('id', videoId).maybeSingle();
    if (!v) return NextResponse.json({ error: 'That video no longer exists.' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin.from(table).update({ video_id: videoId }).eq('id', body.targetId).select('id');
  if (error) return NextResponse.json({ error: 'Could not save. Try again.' }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: 'That lesson no longer exists.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
