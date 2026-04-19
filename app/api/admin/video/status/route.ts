// ═══════════════════════════════════════════════════════════
// Ascentor Video Engine — Status route (Phase 4+5 patched)
// Drop in: app/api/admin/video/status/route.ts
//
// Phase 4+5 changes:
//   • Filters deleted_at IS NULL.
//   • Returns costUsdClaude, costUsdElevenlabs, costUsdTotal,
//     timings, retryCount so the UI can display them.
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
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

    const jobId = req.nextUrl.searchParams.get('jobId')
    if (!jobId) {
      return NextResponse.json({ error: 'jobId required' }, { status: 400 })
    }

    const { data: job, error } = await supabase
      .from('video_jobs')
      .select(`
        id, status, video_url, voiceover_url, soundtrack_url,
        scene_count, total_duration_seconds, error_message,
        created_at, started_at, completed_at, duration_ms,
        goal, narrative_style, theme, audio_mode,
        retry_count, cancelled_at, deleted_at,
        cost_usd_claude, cost_usd_elevenlabs, cost_usd_total, timings
      `)
      .eq('id', jobId)
      .is('deleted_at', null)
      .single()

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({
      jobId:                job.id,
      status:               job.status,
      videoUrl:             job.video_url,
      sceneCount:           job.scene_count,
      totalDurationSeconds: job.total_duration_seconds,
      errorMessage:         job.error_message,
      durationMs:           job.duration_ms,
      retryCount:           job.retry_count,
      cancelledAt:          job.cancelled_at,
      costUsdClaude:        job.cost_usd_claude,
      costUsdElevenlabs:    job.cost_usd_elevenlabs,
      costUsdTotal:         job.cost_usd_total,
      timings:              job.timings,
      meta: {
        goal:           job.goal,
        narrativeStyle: job.narrative_style,
        theme:          job.theme,
        audioMode:      job.audio_mode,
        createdAt:      job.created_at,
        completedAt:    job.completed_at,
      },
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
