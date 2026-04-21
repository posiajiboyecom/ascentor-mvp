// ═══════════════════════════════════════════════════════════
// Clip+CTA Generator — Intake Route
// Drop in: app/api/admin/clip-cta/generate/route.ts
//
// POST multipart/form-data:
//   clip          — video file (required, ≤100MB, ≤5min)
//   ctaImage      — image file (optional, ≤5MB)
//   formData      — JSON string of ClipCTAFormInput
//
// Flow:
//   1. Auth + admin check
//   2. Validate clip (size, type, duration read from client)
//   3. Upload clip → clip-uploads bucket
//   4. Upload CTA image → video-assets bucket (if provided)
//   5. Insert clip_cta_jobs row
//   6. Enqueue Trigger.dev task
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { tasks } from '@trigger.dev/sdk/v3'
import type { clipCTAGeneratorTask } from '@/src/trigger/clip-cta-generator'
import type { ClipCTAFormInput } from '@/types/clip-cta'

// Disable Next.js body size limit — clips can be up to 100MB.
// Without this the default 4MB limit causes a "Request Entity Too Large" error.
// In the App Router this is controlled via next.config.ts experimental.serverActions
// or by streaming the request body directly (which req.formData() does).
export const maxDuration = 60 // seconds — upload + Supabase write + enqueue

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MAX_CLIP_BYTES  = 100 * 1024 * 1024   // 100 MB
const MAX_IMAGE_BYTES =   5 * 1024 * 1024   //   5 MB
const MAX_CLIP_S      = 5 * 60              // 5 minutes

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

async function ensureBucket(name: string, isPublic: boolean, sizeLimit: number) {
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.find(b => b.name === name)) {
    await supabase.storage.createBucket(name, { public: isPublic, fileSizeLimit: sizeLimit })
  }
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth ───────────────────────────────────────────────
    const authClient = await createAuthClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // ── Parse form data ─────────────────────────────────────
    const form = await req.formData()
    const clipFile      = form.get('clip')       as File | null
    const ctaImageFile  = form.get('ctaImage')   as File | null
    const formDataRaw   = form.get('formData')   as string | null

    if (!clipFile)     return NextResponse.json({ success: false, error: 'No clip provided' }, { status: 400 })
    if (!formDataRaw)  return NextResponse.json({ success: false, error: 'No form data provided' }, { status: 400 })

    let formInput: ClipCTAFormInput
    try {
      formInput = JSON.parse(formDataRaw)
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid formData JSON' }, { status: 400 })
    }

    // ── Validate clip ───────────────────────────────────────
    if (!ALLOWED_VIDEO_TYPES.includes(clipFile.type)) {
      return NextResponse.json({ success: false, error: `Unsupported video type: ${clipFile.type}` }, { status: 400 })
    }
    if (clipFile.size > MAX_CLIP_BYTES) {
      return NextResponse.json({
        success: false,
        error: `Clip too large (${(clipFile.size / 1024 / 1024).toFixed(0)}MB). Max 100MB.`
      }, { status: 400 })
    }
    // Duration validated client-side; double-check from formInput
    if (formInput.ctaDurationS < 3 || formInput.ctaDurationS > 15) {
      return NextResponse.json({ success: false, error: 'CTA duration must be 3–15 seconds.' }, { status: 400 })
    }

    // ── Mint job ID ─────────────────────────────────────────
    const jobId = crypto.randomUUID()

    // ── Upload clip ─────────────────────────────────────────
    await ensureBucket('clip-uploads', true, MAX_CLIP_BYTES)
    const clipExt  = clipFile.name.split('.').pop() ?? 'mp4'
    const clipPath = `${jobId}/source.${clipExt}`
    const clipBuf  = await clipFile.arrayBuffer()

    const { error: clipErr } = await supabase.storage
      .from('clip-uploads')
      .upload(clipPath, new Uint8Array(clipBuf), { contentType: clipFile.type, upsert: false })
    if (clipErr) {
      return NextResponse.json({ success: false, error: `Clip upload failed: ${clipErr.message}` }, { status: 500 })
    }
    const { data: { publicUrl: clipUrl } } = supabase.storage
      .from('clip-uploads').getPublicUrl(clipPath)

    // ── Upload CTA image (if provided) ──────────────────────
    let ctaImageUrl: string | undefined
    if (ctaImageFile && ctaImageFile.size > 0) {
      if (!ALLOWED_IMAGE_TYPES.includes(ctaImageFile.type)) {
        return NextResponse.json({ success: false, error: `Unsupported image type: ${ctaImageFile.type}` }, { status: 400 })
      }
      if (ctaImageFile.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ success: false, error: 'CTA image too large (max 5MB)' }, { status: 400 })
      }
      const imgExt  = ctaImageFile.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
      const imgPath = `${jobId}/cta-image.${imgExt}`
      const imgBuf  = await ctaImageFile.arrayBuffer()

      const { error: imgErr } = await supabase.storage
        .from('video-assets')
        .upload(imgPath, new Uint8Array(imgBuf), { contentType: ctaImageFile.type, upsert: true })
      if (imgErr) {
        return NextResponse.json({ success: false, error: `Image upload failed: ${imgErr.message}` }, { status: 500 })
      }
      const { data: { publicUrl } } = supabase.storage
        .from('video-assets').getPublicUrl(imgPath)
      ctaImageUrl = publicUrl
    }

    // ── Insert job row ──────────────────────────────────────
    const { error: insertErr } = await supabase
      .from('clip_cta_jobs')
      .insert({
        id:              jobId,
        created_by:      user.id,
        status:          'queued',
        clip_url:        clipUrl,
        cta_template:    formInput.ctaTemplate,
        cta_duration_s:  formInput.ctaDurationS,
        cta_image_url:   ctaImageUrl  ?? null,
        cta_headline:    formInput.ctaHeadline   ?? null,
        cta_subtitle:    formInput.ctaSubtitle   ?? null,
        cta_button_text: formInput.ctaButtonText ?? null,
        cta_button_url:  formInput.ctaButtonUrl  ?? null,
        cta_closing_line:formInput.ctaClosingLine ?? null,
        transition_type: formInput.transitionType,
        created_at:      new Date().toISOString(),
      })

    if (insertErr) {
      return NextResponse.json({ success: false, error: `Failed to create job: ${insertErr.message}` }, { status: 500 })
    }

    // ── Enqueue Trigger.dev task ────────────────────────────
    try {
      const handle = await tasks.trigger<typeof clipCTAGeneratorTask>(
        'clip-cta-generator',
        { jobId, clipUrl, ctaImageUrl, formInput }
      )
      console.log(`[clip-cta/generate] Job ${jobId} queued. Trigger run: ${handle.id}`)
      return NextResponse.json({ success: true, jobId, triggerRunId: handle.id })

    } catch (triggerErr: any) {
      await supabase
        .from('clip_cta_jobs')
        .update({ status: 'failed', error_message: `Enqueue failed: ${triggerErr?.message}`, completed_at: new Date().toISOString() })
        .eq('id', jobId)
      return NextResponse.json({ success: false, error: `Failed to queue job: ${triggerErr?.message}` }, { status: 502 })
    }

  } catch (err: any) {
    console.error('[clip-cta/generate]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
