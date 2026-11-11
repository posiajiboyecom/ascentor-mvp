// app/api/admin/videos/[id]/route.ts
// GET    → one video's status (polled by the uploader while transcoding)
// PATCH  { title } → rename
// DELETE → remove the R2 objects and the row (courses/lessons that
//          pointed at it fall back to no video via ON DELETE SET NULL)

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { deleteVideoObjects } from '@/lib/r2';
import { guardApi } from '@/lib/admin/api-guard';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const _g = await guardApi('pathways', 'view', req);
  if ('error' in _g) return _g.res;
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('ascentor_videos')
    .select('id, title, status, hls_url, thumbnail_url, duration_seconds, width, height, size_bytes, error, created_at')
    .eq('id', id)
    .single();
  if (error || !data) return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  return NextResponse.json({ video: data });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const _g = await guardApi('pathways', 'edit', req);
  if ('error' in _g) return _g.res;
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('ascentor_videos')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const _g = await guardApi('pathways', 'full', req);
  if ('error' in _g) return _g.res;
  const { id } = await params;

  try {
    await deleteVideoObjects(id);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Storage delete failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { error } = await supabaseAdmin.from('ascentor_videos').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
