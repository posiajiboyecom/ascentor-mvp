// ═══════════════════════════════════════════════════════════
// Ascentor Video Engine — Generate route (patched, Phase 1)
//
// Drop in: app/api/admin/video/generate/route.ts
//
// POST { formInput, ctaImageBase64?, ctaImageMimeType?,
//        scheduleToBuffer?, bufferScheduledFor?, clientRequestId? }
//
// Changes from previous version:
//   • Single jobId minted at top of handler — previously one UUID
//     was used for the CTA image path and a different one for the
//     DB row, orphaning images in storage.
//   • clientRequestId stored on the row → idempotent double-click
//     protection (returns existing jobId if the same clientRequestId
//     is resubmitted within 5 minutes).
//   • Image size guard (5MB) before decoding.
//   • Rollback: if Trigger.dev enqueue fails, the DB row is marked
//     'failed' instead of left 'queued' forever.
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { tasks } from '@trigger.dev/sdk/v3'
import type { videoGeneratorTask } from '@/src/trigger/video-generator'
import type { VideoFormInput, StoryEngineResponse } from '@/types/video'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Max 5MB decoded — matches the UI copy. Enforce server-side too.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export async function POST(req: NextRequest) {
  try {
    // ── Auth + admin check ────────────────────────────────────
    const authClient = await createAuthClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // ── Parse body ────────────────────────────────────────────
    const body = await req.json()
    const {
      formInput,
      ctaImageBase64,
      ctaImageMimeType,
      scheduleToBuffer,
      bufferScheduledFor,
      clientRequestId,
      presetStory,
    }: {
      formInput:          VideoFormInput
      ctaImageBase64?:    string
      ctaImageMimeType?:  string
      scheduleToBuffer?:  boolean
      bufferScheduledFor?: string
      clientRequestId?:   string
      presetStory?:       StoryEngineResponse
    } = body

    if (!formInput?.goal || !formInput?.keyMessage) {
      return NextResponse.json(
        { success: false, error: 'goal and keyMessage are required' },
        { status: 400 }
      )
    }
    if (!formInput?.ctaButtonText || !formInput?.ctaButtonUrl) {
      return NextResponse.json(
        { success: false, error: 'ctaButtonText and ctaButtonUrl are required' },
        { status: 400 }
      )
    }
    try {
      const parsed = new URL(formInput.ctaButtonUrl)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error()
    } catch {
      return NextResponse.json(
        { success: false, error: 'ctaButtonUrl must be a valid http(s) URL' },
        { status: 400 }
      )
    }

    // ── Idempotency check ─────────────────────────────────────
    // If the same clientRequestId was submitted in the last 5 minutes by this
    // user, return the existing job instead of creating a new one. Protects
    // against accidental double-submit / network retries.
    if (clientRequestId) {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data: existing } = await supabase
        .from('video_jobs')
        .select('id, status')
        .eq('created_by', user.id)
        .eq('client_request_id', clientRequestId)
        .gte('created_at', fiveMinAgo)
        .maybeSingle()
      if (existing) {
        return NextResponse.json({
          success: true,
          jobId: existing.id,
          idempotent: true,
          message: 'Returning existing job for this clientRequestId.',
        })
      }
    }

    // ── Mint ONE jobId and use it everywhere ──────────────────
    const jobId = crypto.randomUUID()

    // ── Upload CTA image if provided ──────────────────────────
    let ctaImageStorageUrl: string | undefined

    if (ctaImageBase64 && ctaImageMimeType) {
      // Validate mime type
      if (!/^image\/(png|jpe?g|webp)$/i.test(ctaImageMimeType)) {
        return NextResponse.json(
          { success: false, error: `Unsupported image type: ${ctaImageMimeType}` },
          { status: 400 }
        )
      }

      const imageBytes = Buffer.from(ctaImageBase64, 'base64')

      if (imageBytes.byteLength > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { success: false, error: `Image too large (${Math.round(imageBytes.byteLength / 1024 / 1024)}MB). Max 5MB.` },
          { status: 400 }
        )
      }

      const ext = ctaImageMimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
      // Bucket: `video-assets` (public) — admin-uploaded inputs, separate from
      // rendered outputs. The `public` bucket name is avoided because Supabase
      // warns against it (creates confusing /public/public/ URLs).
      const imagePath = `${jobId}/cta-image.${ext}`

      const { error: imgErr } = await supabase.storage
        .from('video-assets')
        .upload(imagePath, imageBytes, {
          contentType: ctaImageMimeType,
          upsert: true,
        })

      if (imgErr) {
        return NextResponse.json(
          { success: false, error: `Image upload failed: ${imgErr.message}` },
          { status: 500 }
        )
      }

      const { data: imgData } = supabase.storage.from('video-assets').getPublicUrl(imagePath)
      ctaImageStorageUrl = imgData.publicUrl
    }

    // ── Create video_jobs row ─────────────────────────────────
    const { error: insertErr } = await supabase
      .from('video_jobs')
      .insert({
        id:                jobId,
        created_by:        user.id,
        client_request_id: clientRequestId ?? null,
        status:            'queued',
        goal:              formInput.goal,
        key_message:       formInput.keyMessage,
        narrative_style:   formInput.narrativeStyle,
        audience_tier:     formInput.audienceTier,
        theme:             formInput.theme,
        cta_template:      formInput.ctaTemplate,
        cta_button_text:   formInput.ctaButtonText,
        cta_button_url:    formInput.ctaButtonUrl,
        cta_image_url:     ctaImageStorageUrl ?? null,
        audio_mode:        formInput.audioMode,
        track_mood:        formInput.trackMood ?? null,
        created_at:        new Date().toISOString(),
      })

    if (insertErr) {
      return NextResponse.json(
        { success: false, error: `Failed to create job: ${insertErr.message}` },
        { status: 500 }
      )
    }

    // ── Enqueue on Trigger.dev ────────────────────────────────
    try {
      const handle = await tasks.trigger<typeof videoGeneratorTask>(
        'video-generator',
        {
          jobId,
          formInput,
          ctaImageStorageUrl,
          scheduleToBuffer,
          bufferScheduledFor,
          presetStory,
        }
      )

      console.log(`[video/generate] Job ${jobId} queued. Trigger run: ${handle.id}`)

      return NextResponse.json({
        success:       true,
        jobId,
        triggerRunId:  handle.id,
        message:       'Video generation started. Poll /api/admin/video/status?jobId=... for updates.',
      })

    } catch (triggerErr: any) {
      // Rollback: mark the row as failed so it doesn't sit in 'queued' forever.
      console.error('[video/generate] Trigger.dev enqueue failed:', triggerErr)
      await supabase
        .from('video_jobs')
        .update({
          status:        'failed',
          error_message: `Failed to enqueue background job: ${triggerErr?.message ?? 'unknown error'}`,
          completed_at:  new Date().toISOString(),
        })
        .eq('id', jobId)

      return NextResponse.json(
        { success: false, error: `Failed to queue render job: ${triggerErr?.message ?? 'unknown'}` },
        { status: 502 }
      )
    }

  } catch (err: any) {
    console.error('[video/generate]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
