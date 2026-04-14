// ═══════════════════════════════════════════════════════════
// Ascentor Video Engine — API Route
// Drop in: app/api/admin/video/generate/route.ts
//
// POST { formInput: VideoFormInput, ctaImageStorageUrl?, scheduleToBuffer?, bufferScheduledFor? }
// 1. Auth + admin check (same pattern as buffer-send)
// 2. Upload CTA image to Supabase Storage if provided as base64
// 3. Insert video_jobs row
// 4. Trigger Trigger.dev video-generator task
// 5. Return jobId for polling
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { tasks } from '@trigger.dev/sdk/v3'
import { videoGeneratorTask } from '@/src/trigger/video-generator'
import type { VideoFormInput } from '@/types/video'

// Service role client — same pattern as buffer-send/route.ts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // ── Auth + admin check — identical to buffer-send ────────
    const authClient = await createAuthClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // ── Parse request body ───────────────────────────────────
    const body = await req.json()
    const {
      formInput,
      ctaImageBase64,       // optional: base64 encoded image from admin upload
      ctaImageMimeType,     // e.g. 'image/jpeg'
      scheduleToBuffer,
      bufferScheduledFor,
    }: {
      formInput: VideoFormInput
      ctaImageBase64?: string
      ctaImageMimeType?: string
      scheduleToBuffer?: boolean
      bufferScheduledFor?: string
    } = body

    if (!formInput?.goal || !formInput?.keyMessage) {
      return NextResponse.json({ error: 'goal and keyMessage are required' }, { status: 400 })
    }

    // ── Upload CTA image if provided ─────────────────────────
    let ctaImageStorageUrl: string | undefined

    if (ctaImageBase64 && ctaImageMimeType) {
      const jobId = crypto.randomUUID()
      const ext = ctaImageMimeType.split('/')[1] || 'jpg'
      const imagePath = `video-jobs/${jobId}/cta-image.${ext}`

      // Decode base64
      const imageBytes = Buffer.from(ctaImageBase64, 'base64')

      const { error: imgErr } = await supabase.storage
        .from('public')
        .upload(imagePath, imageBytes, {
          contentType: ctaImageMimeType,
          upsert: true,
        })

      if (imgErr) {
        return NextResponse.json({ error: `Image upload failed: ${imgErr.message}` }, { status: 500 })
      }

      const { data: imgData } = supabase.storage.from('public').getPublicUrl(imagePath)
      ctaImageStorageUrl = imgData.publicUrl
    }

    // ── Create video_jobs row ────────────────────────────────
    const jobId = crypto.randomUUID()

    const { error: insertErr } = await supabase
      .from('video_jobs')
      .insert({
        id: jobId,
        created_by: user.id,
        status: 'queued',
        goal: formInput.goal,
        key_message: formInput.keyMessage,
        narrative_style: formInput.narrativeStyle,
        audience_tier: formInput.audienceTier,
        theme: formInput.theme,
        cta_template: formInput.ctaTemplate,
        cta_button_text: formInput.ctaButtonText,
        cta_button_url: formInput.ctaButtonUrl,
        cta_image_url: ctaImageStorageUrl || null,
        audio_mode: formInput.audioMode,
        track_mood: formInput.trackMood || null,
        created_at: new Date().toISOString(),
      })

    if (insertErr) {
      return NextResponse.json({ error: `Failed to create job: ${insertErr.message}` }, { status: 500 })
    }

    // ── Trigger the Trigger.dev task ─────────────────────────
    const handle = await tasks.trigger<typeof videoGeneratorTask>(
      'video-generator',
      {
        jobId,
        formInput,
        ctaImageStorageUrl,
        scheduleToBuffer,
        bufferScheduledFor,
      }
    )

    console.log(`[video/generate] Job ${jobId} queued. Trigger run: ${handle.id}`)

    return NextResponse.json({
      success: true,
      jobId,
      triggerRunId: handle.id,
      message: 'Video generation started. Poll /api/admin/video/status?jobId=... for updates.',
    })

  } catch (err: any) {
    console.error('[video/generate]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
