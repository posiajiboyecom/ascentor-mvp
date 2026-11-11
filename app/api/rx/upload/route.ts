// app/api/rx/upload/route.ts
// POST multipart/form-data { file, kind: 'voice' | 'img' } -> { url }
// Stores a chat photo or voice note in the public rx-media bucket (created on first use) and returns its URL.
// The caller must be signed in. File type is checked here, never trusted from the client.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { MEDIA_BUCKET } from '@/lib/rx/media';
import { sniffFile, sniffMatches } from '@/lib/security';

export const runtime = 'nodejs';

const AUDIO: Record<string, string> = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4', 'audio/mpeg': 'mp3' };
const IMAGE: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  const { data } = await supabaseAdmin.storage.getBucket(MEDIA_BUCKET);
  if (!data) await supabaseAdmin.storage.createBucket(MEDIA_BUCKET, { public: true, fileSizeLimit: 10 * 1024 * 1024 });
  bucketReady = true;
}

export async function POST(req: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  const kind = form.get('kind');
  if (!(file instanceof Blob) || (kind !== 'voice' && kind !== 'img')) {
    return NextResponse.json({ error: 'A file and its kind are required.' }, { status: 400 });
  }

  const base = file.type.split(';')[0];
  const ext = kind === 'voice' ? AUDIO[base] : IMAGE[base];
  if (!ext) return NextResponse.json({ error: kind === 'voice' ? 'That audio format is not supported.' : 'Use a JPG, PNG, WebP or GIF photo.' }, { status: 400 });
  const limit = kind === 'voice' ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size > limit) return NextResponse.json({ error: `That file is too large (max ${limit / 1024 / 1024} MB).` }, { status: 400 });
  // Declared type is client-controlled: the bytes must match it.
  if (!sniffMatches(sniffFile(new Uint8Array(await file.slice(0, 64).arrayBuffer())), base)) {
    return NextResponse.json({ error: kind === 'voice' ? 'That file isn’t a valid audio recording.' : 'That file isn’t a valid image.' }, { status: 400 });
  }

  try {
    await ensureBucket();
    const path = `${kind}/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabaseAdmin.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: base, upsert: false });
    if (error) throw error;
    const { data } = supabaseAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (e) {
    console.error('[rx/upload] failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}
