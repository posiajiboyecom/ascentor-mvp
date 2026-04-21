// ═══════════════════════════════════════════════════════════
// Clip+CTA — Presigned Upload URL Route
// Drop in: app/api/admin/clip-cta/upload-url/route.ts
//
// POST { filename: string, contentType: string }
// Returns { signedUrl, path, token } for direct browser→Supabase upload.
//
// Why: Vercel's serverless functions have a hard 4.5MB body limit.
// Sending 100MB clips through an API route is impossible.
// Instead: browser gets a signed URL here, uploads directly to
// Supabase Storage, then sends only the storage path to /generate.
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET          = 'clip-uploads'
const MAX_SIZE_BYTES  = 100 * 1024 * 1024  // 100MB
const EXPIRES_IN_S    = 300                // URL valid for 5 minutes

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.find(b => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, {
      public:        true,
      fileSizeLimit: MAX_SIZE_BYTES,
    })
  }
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth + admin ────────────────────────────────────────
    const authClient = await createAuthClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // ── Parse request ───────────────────────────────────────
    const { filename, contentType } = await req.json()

    if (!contentType || !ALLOWED_TYPES.includes(contentType)) {
      return NextResponse.json({ error: `Unsupported type: ${contentType}` }, { status: 400 })
    }

    // ── Ensure bucket exists ────────────────────────────────
    await ensureBucket()

    // ── Generate a unique storage path ──────────────────────
    const jobId   = crypto.randomUUID()
    const ext     = filename?.split('.').pop()?.toLowerCase() ?? 'mp4'
    const path    = `${jobId}/source.${ext}`

    // ── Create signed upload URL (service role) ─────────────
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path, { upsert: false })

    if (error || !data) {
      return NextResponse.json({ error: `Failed to create upload URL: ${error?.message}` }, { status: 500 })
    }

    // Get the public URL that will exist after upload completes
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

    return NextResponse.json({
      signedUrl:  data.signedUrl,
      token:      data.token,
      path,
      jobId,          // reuse this as the clip-cta job ID
      publicUrl,      // the URL to pass to /generate after upload
      expiresIn:  EXPIRES_IN_S,
    })

  } catch (err: any) {
    console.error('[clip-cta/upload-url]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
