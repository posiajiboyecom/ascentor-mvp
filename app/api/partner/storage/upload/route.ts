// app/api/partner/storage/upload/route.ts
//
// POST /api/partner/storage/upload
// Accepts a multipart/form-data body with:
//   file  — the image file (logo or favicon)
//   type  — 'logo' | 'logo_dark' | 'favicon'
//
// Returns: { url: string } — the public URL of the uploaded file.
//
// Storage layout: one shared public bucket 'partner-assets'.
// Files are stored at: {partner_id}/{type}/{filename}
// Bucket is public so logos load without auth tokens in <img> tags.
//
// Limits: 2MB, images only (jpeg, png, webp, gif, svg).

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET         = 'partner-assets';
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES  = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const ALLOWED_ASSET_TYPES = ['logo', 'logo_dark', 'favicon'] as const;

type AssetType = typeof ALLOWED_ASSET_TYPES[number];

export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth ──────────────────────────────────────────────
    const authClient = await createAuthClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── 2. Ownership check ───────────────────────────────────
    const { data: partner } = await supabase
      .from('partners')
      .select('id, status')
      .eq('owner_id', user.id)
      .single();

    if (!partner) {
      return NextResponse.json({ error: 'No partner account' }, { status: 404 });
    }
    if (partner.status === 'suspended') {
      return NextResponse.json({ error: 'Account suspended' }, { status: 403 });
    }

    // ── 3. Parse form data ───────────────────────────────────
    const formData = await req.formData();
    const file     = formData.get('file') as File | null;
    const assetType = formData.get('type') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!assetType || !(ALLOWED_ASSET_TYPES as readonly string[]).includes(assetType)) {
      return NextResponse.json(
        { error: `type must be one of: ${ALLOWED_ASSET_TYPES.join(', ')}` },
        { status: 400 }
      );
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'File must be an image (JPEG, PNG, WebP, GIF, or SVG)' },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File too large — maximum 2 MB' },
        { status: 400 }
      );
    }

    // ── 4. Ensure public bucket exists ───────────────────────
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = (buckets || []).some(b => b.name === BUCKET);

    if (!bucketExists) {
      const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
        public: true,
        allowedMimeTypes: ALLOWED_TYPES,
        fileSizeLimit: MAX_SIZE_BYTES,
      });
      // Ignore "already exists" race condition
      if (createErr && !createErr.message?.includes('already exists')) {
        console.error('[Upload] createBucket error:', createErr);
        return NextResponse.json({ error: 'Storage unavailable' }, { status: 500 });
      }
    }

    // ── 5. Build storage path ────────────────────────────────
    // Use a stable name per asset type so re-uploads overwrite the old file
    // (no orphaned files accumulating in storage).
    const ext      = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filePath = `${partner.id}/${assetType}.${ext}`;

    // ── 6. Upload (upsert so re-uploads overwrite) ────────────
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, arrayBuffer, {
        contentType:  file.type,
        upsert:       true,   // overwrite previous logo/favicon
        cacheControl: '3600',
      });

    if (uploadErr) {
      console.error('[Upload] upload error:', uploadErr);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    // ── 7. Get public URL ────────────────────────────────────
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      return NextResponse.json({ error: 'Could not get file URL' }, { status: 500 });
    }

    // Bust Supabase CDN cache by appending a version query param
    const url = `${urlData.publicUrl}?v=${Date.now()}`;

    return NextResponse.json({ url });

  } catch (err: any) {
    console.error('[Partner Upload]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
