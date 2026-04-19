// ═══════════════════════════════════════════════════════════
// Ascentor Video Engine — Retry route (Phase 4)
// Drop in: app/api/admin/video/retry/route.ts
//
// POST /api/admin/video/retry?jobId=xxx
//
// Re-enqueues a failed job using the original form inputs + any
// preset_story stored on the row. Creates a new Trigger run,
// increments retry_count, clears error_message, sets status=queued.
//
// Only failed jobs can be retried. A terminal state (complete) or
// in-flight state (queued/processing) will 400.
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

export async function POST(req: NextRequest) {
  try {
    // ── Auth + admin check ───────────────────────────────────
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

    const jobId = req.nextUrl.searchParams.get('jobId')
    if (!jobId) {
      return NextResponse.json({ success: false, error: 'jobId required' }, { status: 400 })
    }

    // ── Load the row ─────────────────────────────────────────
    const { data: job, error: fetchErr } = await supabase
      .from('video_jobs')
      .select('*')
      .eq('id', jobId)
      .is('deleted_at', null)
      .single()

    if (fetchErr || !job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
    }

    if (job.status !== 'failed') {
      return NextResponse.json(
        { success: false, error: `Cannot retry a job with status "${job.status}". Only failed jobs can be retried.` },
        { status: 400 }
      )
    }

    // ── Rebuild the formInput from stored columns ────────────
    const formInput: VideoFormInput = {
      goal:            job.goal,
      keyMessage:      job.key_message,
      narrativeStyle:  job.narrative_style,
      audienceTier:    job.audience_tier,
      theme:           job.theme,
      ctaTemplate:     job.cta_template,
      ctaButtonText:   job.cta_button_text,
      ctaButtonUrl:    job.cta_button_url,
      audioMode:       job.audio_mode,
      trackMood:       job.track_mood ?? undefined,
    }

    // ── Reset the row for a fresh run ─────────────────────────
    const { error: updateErr } = await supabase
      .from('video_jobs')
      .update({
        status:        'queued',
        started_at:    null,
        completed_at:  null,
        error_message: null,
        cancelled_at:  null,
        duration_ms:   null,
        retry_count:   (job.retry_count ?? 0) + 1,
      })
      .eq('id', jobId)

    if (updateErr) {
      return NextResponse.json(
        { success: false, error: `Failed to reset job: ${updateErr.message}` },
        { status: 500 }
      )
    }

    // ── Enqueue a fresh Trigger run ───────────────────────────
    try {
      const handle = await tasks.trigger<typeof videoGeneratorTask>(
        'video-generator',
        {
          jobId,
          formInput,
          ctaImageStorageUrl: job.cta_image_url ?? undefined,
          scheduleToBuffer:   false, // don't re-queue to Buffer on retry — avoids duplicate posts
          presetStory:        (job.preset_story as StoryEngineResponse | null) ?? undefined,
        }
      )

      console.log(`[video/retry] Job ${jobId} retried. New trigger run: ${handle.id}`)

      return NextResponse.json({
        success:      true,
        jobId,
        triggerRunId: handle.id,
        retryCount:   (job.retry_count ?? 0) + 1,
        message:      'Job re-queued. Poll /api/admin/video/status?jobId=... for updates.',
      })

    } catch (triggerErr: any) {
      console.error('[video/retry] Trigger.dev enqueue failed:', triggerErr)
      await supabase
        .from('video_jobs')
        .update({
          status:        'failed',
          error_message: `Retry failed: ${triggerErr?.message ?? 'unknown error'}`,
          completed_at:  new Date().toISOString(),
        })
        .eq('id', jobId)

      return NextResponse.json(
        { success: false, error: `Retry enqueue failed: ${triggerErr?.message ?? 'unknown'}` },
        { status: 502 }
      )
    }

  } catch (err: any) {
    console.error('[video/retry]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
