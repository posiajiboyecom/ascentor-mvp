// ============================================================
// API — /api/partner/storage/ensure-bucket
// POST: Ensures the 'partner-assets' Supabase storage bucket
//       exists and is public. Creates it if missing.
//       Uses service role key — never exposed to the client.
// ============================================================

import { NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET_NAME = 'partner-assets';

export async function POST() {
  try {
    // Auth guard — must be a logged-in partner owner
    const authClient = await createAuthClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify caller is a partner owner
    const { data: partner } = await supabaseAdmin
      .from('partners')
      .select('id')
      .eq('owner_id', user.id)
      .single();
    if (!partner) {
      return NextResponse.json({ error: 'Not a partner owner' }, { status: 403 });
    }

    // Check if bucket already exists
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    if (listError) {
      return NextResponse.json({ error: 'Failed to list buckets: ' + listError.message }, { status: 500 });
    }

    const exists = buckets?.some(b => b.name === BUCKET_NAME);

    if (!exists) {
      // Create the public bucket
      const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 2 * 1024 * 1024,           // 2 MB cap
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif', 'image/x-icon'],
      });

      if (createError) {
        // Race condition: another request already created it — that's fine
        if (!createError.message.includes('already exists')) {
          return NextResponse.json({ error: 'Failed to create bucket: ' + createError.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ ok: true, bucket: BUCKET_NAME });
  } catch (err: any) {
    console.error('[ensure-bucket]', err);
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
