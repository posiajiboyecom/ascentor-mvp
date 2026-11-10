// app/api/admin/videos/route.ts
//
// GET  → list videos (newest first) for the admin library / picker.
// POST { title, contentType, size } → create an ascentor_videos row in
//      'uploading' state and return a presigned R2 PUT URL. The browser
//      uploads the file straight to R2, so Vercel's request-size limit
//      never applies. Afterwards the client calls
//      POST /api/admin/videos/[id]/complete to start transcoding.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { presignPut, VIDEO_KEYS } from '@/lib/r2';
import { requireAdmin } from '@/lib/video/requireAdmin';

const MIME_TO_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-m4v': 'm4v',
};

// A single R2 PUT accepts up to 5 GB.
const MAX_BYTES = 5 * 1024 * 1024 * 1024;

export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const { data, error } = await supabaseAdmin
    .from('ascentor_videos')
    .select('id, title, status, hls_url, thumbnail_url, duration_seconds, width, height, size_bytes, error, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ videos: data ?? [] });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  let body: { title?: string; contentType?: string; size?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const contentType = body.contentType ?? '';
  const ext = MIME_TO_EXT[contentType];
  if (!ext) {
    return NextResponse.json({ error: 'Unsupported file type. Use MP4, MOV, WebM or M4V.' }, { status: 400 });
  }
  const size = Number(body.size ?? 0);
  if (!size || size > MAX_BYTES) {
    return NextResponse.json({ error: 'File must be between 1 byte and 5 GB.' }, { status: 400 });
  }

  const title = (body.title ?? '').trim().slice(0, 200) || 'Untitled video';
  const id = crypto.randomUUID();
  const sourceKey = VIDEO_KEYS.source(id, ext);

  const { error } = await supabaseAdmin.from('ascentor_videos').insert({
    id,
    title,
    status: 'uploading',
    source_key: sourceKey,
    size_bytes: size,
    created_by: gate.userId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const uploadUrl = await presignPut(sourceKey, contentType, 6 * 3600);
    return NextResponse.json({ videoId: id, uploadUrl });
  } catch (err) {
    await supabaseAdmin.from('ascentor_videos').delete().eq('id', id);
    const message = err instanceof Error ? err.message : 'Could not create upload URL';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
