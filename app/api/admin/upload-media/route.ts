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
const ALLOWED_TYPES  = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

export async function POST(req: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Admin check
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'social';

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    if (file.size > MAX_SIZE_BYTES) return NextResponse.json({ error: 'File too large (max 8MB)' }, { status: 400 });

    const ext      = file.name.split('.').pop() || 'jpg';
    const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer   = await file.arrayBuffer();

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find(b => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_SIZE_BYTES });
    }

    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(filename, buffer, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filename);

    return NextResponse.json({ url: publicUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
