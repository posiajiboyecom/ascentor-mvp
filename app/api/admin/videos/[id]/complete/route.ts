// app/api/admin/videos/[id]/complete/route.ts
// Called by the admin browser once its direct-to-R2 upload finishes.
// Confirms the object landed, marks the video 'processing', and queues
// the Trigger.dev HLS transcode.

import { NextResponse } from 'next/server';
import { tasks } from '@trigger.dev/sdk/v3';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { headObject } from '@/lib/r2';
import { requireAdmin } from '@/lib/video/requireAdmin';
import type { transcodeVideo } from '@/src/trigger/transcode-video';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;

  const { data: video } = await supabaseAdmin
    .from('ascentor_videos').select('id, status, source_key').eq('id', id).single();
  if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 });

  const head = await headObject(video.source_key);
  if (!head) return NextResponse.json({ error: 'Upload not found in storage. Try uploading again.' }, { status: 409 });

  await supabaseAdmin
    .from('ascentor_videos')
    .update({ status: 'processing', size_bytes: head.size, error: null, updated_at: new Date().toISOString() })
    .eq('id', id);

  try {
    const handle = await tasks.trigger<typeof transcodeVideo>('transcode-video', { videoId: id });
    return NextResponse.json({ ok: true, runId: handle.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not start transcoding';
    await supabaseAdmin
      .from('ascentor_videos')
      .update({ status: 'failed', error: message, updated_at: new Date().toISOString() })
      .eq('id', id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
