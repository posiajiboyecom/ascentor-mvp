// ═══════════════════════════════════════════════════════════
// Ascentor Video Engine — Generate route (Phase 3 patched)
// Drop in: app/api/admin/video/generate/route.ts
//
// Phase 3 change:
//   • Accepts optional `presetStory: StoryEngineResponse`.
//     When present, stored on the video_jobs row and forwarded
//     to the Trigger task, which skips its Claude call.
//     This is the approved/edited output of /preview.
//
// All Phase 1 fixes preserved (jobId unified, idempotency,
// image validation, trigger-failure rollback).
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
      formInput:         VideoFormInput
      ctaImageBase64?:   string
      ctaImageMimeType?: string
      scheduleToBuffer?: boolean
      bufferScheduledFor?: string
      clientRequestId?:  string
      presetStory?:      StoryEngineResponse
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

    // If presetStory is provided, sanity-check its shape
    if (presetStory) {
      if (!Array.isArray(presetStory.scenes) || presetStory.scenes.length === 0) {
        return NextResponse.json(
          { success: false, error: 'presetStory must include at least one scene' },
          { status: 400 }
        )
      }
      for (const s of presetStory.scenes) {
        if (!Array.isArray(s.lines) || s.lines.length === 0) {
          return NextResponse.json(
            { success: false, error: `Scene "${s.id ?? '?'}" has no lines` },
            { status: 400 }
          )
        }
        if (typeof s.durationSeconds !== 'number' || s.durationSeconds <= 0) {
          return NextResponse.json(
            { success: false, error: `Scene "${s.id ?? '?'}" has invalid duration` },
            { status: 400 }
          )
        }
      }
    }

    // ── Idempotency check ─────────────────────────────────────
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
      const imagePath = `video-jobs/${jobId}/cta-image.${ext}`

      const { error: imgErr } = await supabase.storage
        .from('public')
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

      const { data: imgData } = supabase.storage.from('public').getPublicUrl(imagePath)
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
        preset_story:      presetStory ?? null,          // ← Phase 3: store the approved story
        used_preset:       presetStory ? true : false,   // ← Phase 3: audit flag
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
          presetStory, // ← Phase 3: when present, task skips Claude
        }
      )

      console.log(
        `[video/generate] Job ${jobId} queued. ` +
        `Trigger run: ${handle.id}. ` +
        `Preset story: ${presetStory ? 'YES' : 'no'}.`
      )

      return NextResponse.json({
        success:       true,
        jobId,
        triggerRunId:  handle.id,
        usedPreset:    !!presetStory,
        message:       'Video generation started. Poll /api/admin/video/status?jobId=... for updates.',
      })

    } catch (triggerErr: any) {
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
