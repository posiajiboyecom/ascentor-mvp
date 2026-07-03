// app/api/community/voice-upload/route.ts
// ============================================================
// POST /api/community/voice-upload
// Accepts a voice message recording and uploads it server-side using
// the service role key, bypassing storage RLS. Auth is still verified
// via the user's session cookie before anything is written.
//
// Request: multipart/form-data
//   file:    Blob (audio)
//   channel: string (channel slug)
//
// On success, inserts the message row directly (content encodes the
// voice URL as `[voice:<url>]`, matching how the message bubble
// renderer detects and plays voice messages) and returns it so the
// client can show it immediately without waiting for the realtime
// echo of its own insert.
// ============================================================

import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const VOICE_BUCKET = 'community-voice';

export async function POST(req: Request) {
  // ── Verify the caller is authenticated via their normal session ──
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file');
  const channel = formData.get('channel');

  if (!(file instanceof Blob) || typeof channel !== 'string' || !channel) {
    return NextResponse.json({ error: 'file and channel are required' }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Voice message too large (max 10MB)' }, { status: 400 });
  }

  // ── Upload + insert using the service role client (bypasses RLS) ──
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const ext = file.type.includes('mp4')
    ? 'mp4'
    : file.type.includes('ogg')
      ? 'ogg'
      : 'webm';
  const path = `voice/${user.id}/${Date.now()}.${ext}`;

  const { error: uploadError } = await serviceClient.storage
    .from(VOICE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error('[voice-upload] storage upload failed:', uploadError.message);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }

  const { data: urlData } = serviceClient.storage.from(VOICE_BUCKET).getPublicUrl(path);

  const { data: message, error: insertError } = await serviceClient
    .from('community_messages')
    .insert({
      user_id: user.id,
      channel,
      content: `[voice:${urlData.publicUrl}]`,
      likes: [],
    })
    .select('id, user_id, channel, content, created_at, likes, reply_to_id, pinned, dimension_tag, reply_count')
    .single();

  if (insertError || !message) {
    console.error('[voice-upload] message insert failed:', insertError?.message);
    return NextResponse.json({ error: 'Failed to send voice message.' }, { status: 500 });
  }

  return NextResponse.json({ message });
}
