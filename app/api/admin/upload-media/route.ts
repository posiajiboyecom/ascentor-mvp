// app/api/admin/upload-media/route.ts
// POST multipart/form-data { file, folder? }
// Returns { url: string }
// Uploads to Supabase 'content-media' bucket (public)

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET         = 'content-media';
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

// C-02: SVG removed — SVG files can embed JS and execute in browsers when served from a public CDN.
// Use PNG or WebP for logos and icons instead.
const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/gif':  'gif',
};

// C-03: Allowlist prevents path traversal via the folder parameter.
const ALLOWED_FOLDERS = new Set(['social', 'blog', 'newsletter', 'courses', 'general']);

export async function POST(req: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    // C-03: sanitise folder — only allow known values
    const rawFolder = (formData.get('folder') as string) || 'social';
    const folder = ALLOWED_FOLDERS.has(rawFolder) ? rawFolder : 'social';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // C-02: reject SVG and any unlisted MIME type
    const ext = ALLOWED_MIME_TO_EXT[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'File too large (max 8MB)' }, { status: 400 });
    }

    // Use server-validated extension — never derive from file.name or client input
    const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer   = await file.arrayBuffer();

    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find(b => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_SIZE_BYTES });
    }

    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(filename, buffer, {
      contentType: file.type, // safe — validated against allowlist above
      upsert: false,
    });

    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    return NextResponse.json({ url: publicUrl });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
