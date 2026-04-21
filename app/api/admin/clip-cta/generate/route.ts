// ═══════════════════════════════════════════════════════════
// Clip+CTA Generator — Intake Route
// Drop in: app/api/admin/clip-cta/generate/route.ts
//
// POST application/json:
//   clipUrl       — Supabase public URL of already-uploaded clip
//   jobId         — UUID minted by /upload-url (reused as job ID)
//   formInput     — ClipCTAFormInput object
//   ctaImageBase64  — optional, base64-encoded CTA image (≤5MB)
//   ctaImageMimeType — mime type of CTA image
//
// The clip is uploaded DIRECTLY from the browser to Supabase
// via a signed URL (/api/admin/clip-cta/upload-url), bypassing
// this route entirely. Vercel has a hard 4.5MB body limit on
// serverless functions — sending 100MB clips here is impossible.
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { tasks } from '@trigger.dev/sdk/v3'
import type { clipCTAGeneratorTask } from '@/src/trigger/clip-cta-generator'
import type { ClipCTAFormInput } from '@/types/clip-cta'

export const maxDuration = 30 // seconds — just DB write + enqueue, no file upload

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

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

    // ── Parse JSON body ─────────────────────────────────────
    const body = await req.json()
    const {
      clipUrl,
      jobId,
      formInput,
      ctaImageBase64,
      ctaImageMimeType,
    }: {
      clipUrl:           string
      jobId:             string
      formInput:         ClipCTAFormInput
      ctaImageBase64?:   string
      ctaImageMimeType?: string
    } = body

    if (!clipUrl)   return NextResponse.json({ success: false, error: 'clipUrl is required' }, { status: 400 })
    if (!jobId)     return NextResponse.json({ success: false, error: 'jobId is required' }, { status: 400 })
    if (!formInput) return NextResponse.json({ success: false, error: 'formInput is required' }, { status: 400 })

    if (formInput.ctaDurationS < 3 || formInput.ctaDurationS > 15) {
      return NextResponse.json({ success: false, error: 'CTA duration must be 3–15 seconds.' }, { status: 400 })
    }

    // ── Upload CTA image if provided (≤5MB, fine through Vercel) ──
    let ctaImageUrl: string | undefined
    if (ctaImageBase64 && ctaImageMimeType) {
      if (!ALLOWED_IMAGE_TYPES.includes(ctaImageMimeType)) {
        return NextResponse.json({ success: false, error: `Unsupported image type: ${ctaImageMimeType}` }, { status: 400 })
      }
      const imgBytes = Buffer.from(ctaImageBase64, 'base64')
      if (imgBytes.byteLength > MAX_IMAGE_BYTES) {
        return NextResponse.json({ success: false, error: 'CTA image too large (max 5MB)' }, { status: 400 })
      }
      const imgExt  = ctaImageMimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
      const imgPath = `${jobId}/cta-image.${imgExt}`

      const { error: imgErr } = await supabase.storage
        .from('video-assets')
        .upload(imgPath, imgBytes, { contentType: ctaImageMimeType, upsert: true })
      if (imgErr) {
        return NextResponse.json({ success: false, error: `Image upload failed: ${imgErr.message}` }, { status: 500 })
      }
      const { data: { publicUrl } } = supabase.storage.from('video-assets').getPublicUrl(imgPath)
      ctaImageUrl = publicUrl
    }

    // ── Insert job row ──────────────────────────────────────
    const { error: insertErr } = await supabase
      .from('clip_cta_jobs')
      .insert({
        id:               jobId,
        created_by:       user.id,
        status:           'queued',
        clip_url:         clipUrl,
        cta_template:     formInput.ctaTemplate,
        cta_duration_s:   formInput.ctaDurationS,
        cta_image_url:    ctaImageUrl  ?? null,
        cta_headline:     formInput.ctaHeadline   ?? null,
        cta_subtitle:     formInput.ctaSubtitle   ?? null,
        cta_button_text:  formInput.ctaButtonText ?? null,
        cta_button_url:   formInput.ctaButtonUrl  ?? null,
        cta_closing_line: formInput.ctaClosingLine ?? null,
        transition_type:  formInput.transitionType,
        created_at:       new Date().toISOString(),
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
