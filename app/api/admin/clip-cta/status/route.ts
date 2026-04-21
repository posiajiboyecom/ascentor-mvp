// ═══════════════════════════════════════════════════════════
// Clip+CTA — Status Route
// Drop in: app/api/admin/clip-cta/status/route.ts
//
// GET /api/admin/clip-cta/status?jobId=xxx
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
      .from('clip_cta_jobs')
      .select('*')
      .eq('id', jobId)
      .is('deleted_at', null)
      .single()

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({
      jobId:       job.id,
      status:      job.status,
      videoUrl:    job.video_url,
      errorMessage:job.error_message,
      durationMs:  job.duration_ms,
      clipWidth:   job.clip_width,
      clipHeight:  job.clip_height,
      clipDurationS: job.clip_duration_s,
      createdAt:   job.created_at,
      completedAt: job.completed_at,
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
