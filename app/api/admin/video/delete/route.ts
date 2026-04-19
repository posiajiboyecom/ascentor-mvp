// ═══════════════════════════════════════════════════════════
// Ascentor Video Engine — Delete route (Phase 4)
// Drop in: app/api/admin/video/delete/route.ts
//
// POST /api/admin/video/delete?jobId=xxx
//
// Soft delete — sets `deleted_at` on the row. Storage objects
// (MP4, voiceover, CTA image) are retained so the delete is
// reversible for audit. Hard-delete is a separate operational
// task (Supabase lifecycle rule or manual SQL).
//
// Using POST instead of DELETE so the browser fetch API is
// consistent with the other admin endpoints and avoids some
// proxy/CORS issues with method overrides.
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

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
      .select('id, status, deleted_at')
      .eq('id', jobId)
      .single()

    if (fetchErr || !job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
    }

    if (job.deleted_at) {
      return NextResponse.json(
        { success: false, error: 'Job already deleted' },
        { status: 400 }
      )
    }

    // Can't delete in-flight jobs — ask the admin to cancel first.
    if (job.status === 'queued' || job.status === 'processing') {
      return NextResponse.json(
        { success: false, error: 'Cancel the job before deleting it.' },
        { status: 400 }
      )
    }

    const { error: updateErr } = await supabase
      .from('video_jobs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', jobId)

    if (updateErr) {
      return NextResponse.json(
        { success: false, error: `Failed to delete: ${updateErr.message}` },
        { status: 500 }
      )
    }

    console.log(`[video/delete] Soft-deleted job ${jobId} (storage retained)`)

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Job soft-deleted. Storage objects retained.',
    })

  } catch (err: any) {
    console.error('[video/delete]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
