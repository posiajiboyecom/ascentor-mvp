// ============================================================
// app/api/partner/storage/ensure-bucket/route.ts
//
// FILE LOCATION: app/api/partner/storage/ensure-bucket/route.ts
//
// FIX (W-05):
//   When two upload requests fired simultaneously (e.g. user
//   drags multiple files quickly), both called this endpoint.
//   The second request failed because the first had just created
//   the bucket, and the Supabase "already exists" error was NOT
//   caught cleanly — it returned a 500 to the client.
//
//   The old code had a comment noting the race condition but
//   only checked createError.message.includes('already exists'),
//   which is fragile. Supabase also sets createError.statusCode
//   to "409" (Conflict) on duplicate bucket creation.
//
//   Fix:
//   - Catch "already exists" by BOTH message string check AND
//     statusCode === '409' check so neither can slip through.
//   - In both cases return { ok: true } — the bucket exists, the
//     caller can proceed, no error should be surfaced.
//   - No other logic changes.
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
    const authClient = await createAuthClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 2 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif', 'image/x-icon'],
      });

      if (createError) {
        // FIX W-05: treat ANY "already exists" signal as success — not an error.
        // Supabase may return a 409 Conflict status code or an "already exists"
        // message string depending on version. Both mean the bucket is ready to use.
        const isAlreadyExists =
          createError.message?.toLowerCase().includes('already exists') ||
          (createError as any).statusCode === '409' ||
          (createError as any).statusCode === 409;

        if (!isAlreadyExists) {
          return NextResponse.json({ error: 'Failed to create bucket: ' + createError.message }, { status: 500 });
        }
        // else: bucket was created by a concurrent request — fall through and return ok
      }
    }

    return NextResponse.json({ ok: true, bucket: BUCKET_NAME });

  } catch (err: any) {
    console.error('[ensure-bucket]', err);
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
