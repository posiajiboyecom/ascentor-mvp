// ═══════════════════════════════════════════════════════════
// Ascentor Video Engine — Cancel route (Phase 4)
// Drop in: app/api/admin/video/cancel/route.ts
//
// POST /api/admin/video/cancel?jobId=xxx
//
// Cancels an in-flight job:
//   1. Calls runs.cancel(trigger_run_id) — best-effort. If the run
//      has already finished, Trigger.dev returns no-op.
//   2. Marks the row status='failed' with
//      error_message='Cancelled by admin'.
//
// Only 'queued' or 'processing' jobs can be cancelled.
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { runs } from '@trigger.dev/sdk/v3'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
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

    const { data: job, error: fetchErr } = await supabase
      .from('video_jobs')
      .select('id, status, trigger_run_id')
      .eq('id', jobId)
      .is('deleted_at', null)
      .single()

    if (fetchErr || !job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
    }

    if (job.status !== 'queued' && job.status !== 'processing') {
      return NextResponse.json(
        { success: false, error: `Cannot cancel a job with status "${job.status}".` },
        { status: 400 }
      )
    }

    // ── Attempt to cancel the Trigger.dev run (best-effort) ──
    let triggerCancelled = false
    if (job.trigger_run_id) {
      try {
        await runs.cancel(job.trigger_run_id)
        triggerCancelled = true
        console.log(`[video/cancel] Cancelled Trigger run ${job.trigger_run_id} for job ${jobId}`)
      } catch (err: any) {
        // Don't block the DB update — if the run already finished, that's fine
        console.warn(
          `[video/cancel] Trigger runs.cancel failed for ${job.trigger_run_id}: ${err?.message ?? err}. ` +
          `Proceeding with DB update anyway.`
        )
      }
    } else {
      console.log(`[video/cancel] Job ${jobId} has no trigger_run_id — only updating DB row`)
    }

    // ── Mark the row cancelled ───────────────────────────────
    const now = new Date().toISOString()
    const { error: updateErr } = await supabase
      .from('video_jobs')
      .update({
        status:        'failed',
        error_message: 'Cancelled by admin',
        cancelled_at:  now,
        completed_at:  now,
      })
      .eq('id', jobId)

    if (updateErr) {
      return NextResponse.json(
        { success: false, error: `Failed to mark job cancelled: ${updateErr.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      jobId,
      triggerCancelled,
      message: triggerCancelled
        ? 'Run cancelled and job marked failed.'
        : 'Job marked failed. Trigger run could not be cancelled (may have already finished).',
    })

  } catch (err: any) {
    console.error('[video/cancel]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
