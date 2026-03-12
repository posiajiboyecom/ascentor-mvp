// ============================================================
// FILE LOCATION: app/api/partner/storage/ensure-bucket/route.ts
//
// BUG FIXED:
//   BUG-02 — This file contained a verbatim copy of
//             app/api/partner/brand/route.ts. The actual
//             ensure-bucket logic was completely absent.
//             Any component calling this endpoint to provision
//             a partner's Supabase Storage bucket was silently
//             running brand-save logic instead, corrupting brand
//             data or returning unexpected responses.
//
// PURPOSE:
//   POST — Ensures the partner's private storage bucket exists
//          in Supabase Storage. Called once during onboarding
//          and before any file upload (logo, favicon, etc.).
//          Idempotent — safe to call multiple times.
//
//   Bucket naming: partner-assets-{partner_id}
//   Policy: private (authenticated owner access only)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── POST: ensure partner storage bucket exists ────────────
export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const authClient = await createAuthClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Confirm caller owns a partner account
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

    const bucketName = `partner-assets-${partner.id}`;

    // 3. Check if bucket already exists
    const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
    if (listErr) {
      console.error('[EnsureBucket] listBuckets error:', listErr);
      return NextResponse.json({ error: 'Storage check failed' }, { status: 500 });
    }

    const exists = (buckets || []).some(b => b.name === bucketName);

    if (exists) {
      // Already provisioned — return success (idempotent)
      return NextResponse.json({ success: true, bucket: bucketName, created: false });
    }

    // 4. Create the bucket (private by default — no public read)
    const { error: createErr } = await supabase.storage.createBucket(bucketName, {
      public: false,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'],
      fileSizeLimit: 5 * 1024 * 1024, // 5 MB
    });

    if (createErr) {
      // Handle race condition: another request already created it
      if (createErr.message?.includes('already exists')) {
        return NextResponse.json({ success: true, bucket: bucketName, created: false });
      }
      console.error('[EnsureBucket] createBucket error:', createErr);
      return NextResponse.json({ error: 'Failed to create storage bucket' }, { status: 500 });
    }

    // 5. Audit log
    try {
      await supabase.from('audit_logs').insert({
        user_id:     user.id,
        action:      'partner_bucket_created',
        entity_type: 'partner',
        entity_id:   partner.id,
        details:     { bucket: bucketName },
      });
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true, bucket: bucketName, created: true });

  } catch (err: any) {
    console.error('[EnsureBucket] Fatal:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
