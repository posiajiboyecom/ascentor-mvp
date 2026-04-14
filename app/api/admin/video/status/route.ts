// ═══════════════════════════════════════════════════════════
// Ascentor Video Engine — Status Polling Route
// Drop in: app/api/admin/video/status/route.ts
//
// GET /api/admin/video/status?jobId=xxx
// Returns current status + video URL when complete
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
        goal, narrative_style, theme, audio_mode
      `)
      .eq('id', jobId)
      .single()

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,              // queued | processing | complete | failed
      videoUrl: job.video_url,
      sceneCount: job.scene_count,
      totalDurationSeconds: job.total_duration_seconds,
      errorMessage: job.error_message,
      durationMs: job.duration_ms,
      meta: {
        goal: job.goal,
        narrativeStyle: job.narrative_style,
        theme: job.theme,
        audioMode: job.audio_mode,
        createdAt: job.created_at,
        completedAt: job.completed_at,
      },
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
