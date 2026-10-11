// app/api/rx/upload-url/route.ts
// POST { contentType, size } -> { bucket, path, token, publicUrl }
// Gives a signed member a short-lived link to upload one photo or video for a Community post straight to storage.
// The file type and size are checked here and again by the bucket itself, and the file always lands in the member's own folder.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { POST_BUCKET, POST_BUCKET_LIMIT_MB, POST_MEDIA_TYPES } from '@/lib/rx/media';
import { rateLimit } from '@/lib/auth/rate-limit-shared';

export const runtime = 'nodejs';

let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  const { data } = await supabaseAdmin.storage.getBucket(POST_BUCKET);
  if (!data) {
    const { error } = await supabaseAdmin.storage.createBucket(POST_BUCKET, {
      public: true,
      fileSizeLimit: POST_BUCKET_LIMIT_MB * 1024 * 1024,
      allowedMimeTypes: Object.keys(POST_MEDIA_TYPES),
    });
    if (error && !/already exists/i.test(error.message)) throw error;
  }
  bucketReady = true;
}

export async function POST(req: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

  const limit = await rateLimit(user.id, { scope: 'rx-upload:user', max: 30, windowSeconds: 3600 });
  if (!limit.allowed) return NextResponse.json({ error: 'You’ve uploaded a lot in the last hour. Try again a little later.' }, { status: 429 });

  let body: { contentType?: string; size?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad request.' }, { status: 400 }); }

  const type = POST_MEDIA_TYPES[String(body.contentType ?? '').split(';')[0]];
  if (!type) return NextResponse.json({ error: 'Use a JPG, PNG, WebP or GIF photo, or an MP4, WebM or MOV video.' }, { status: 400 });
  const size = Number(body.size);
  if (!Number.isFinite(size) || size <= 0) return NextResponse.json({ error: 'That file looks empty.' }, { status: 400 });
  if (size > type.maxMB * 1024 * 1024) return NextResponse.json({ error: `That ${type.kind} is too large. The limit is ${type.maxMB} MB.` }, { status: 400 });

  try {
    await ensureBucket();
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${type.ext}`;
    const { data, error } = await supabaseAdmin.storage.from(POST_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error('no upload link');
    const { data: pub } = supabaseAdmin.storage.from(POST_BUCKET).getPublicUrl(path);
    return NextResponse.json({ bucket: POST_BUCKET, path, token: data.token, publicUrl: pub.publicUrl, kind: type.kind });
  } catch (e) {
    console.error('[rx/upload-url] failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'We couldn’t start that upload. Please try again.' }, { status: 500 });
  }
}
