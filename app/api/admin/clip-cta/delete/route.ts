// ═══════════════════════════════════════════════════════════
// Clip+CTA — Delete Route
// Drop in: app/api/admin/clip-cta/delete/route.ts
//
// POST /api/admin/clip-cta/delete?jobId=xxx
//
// Hard deletes the storage files (clip-uploads + video-renders)
// and soft-deletes the DB row (sets deleted_at).
// Failed jobs are fully deletable; in-flight jobs must be
// cancelled first (not yet implemented for clip-cta — just
// reject them with a clear message).
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
      .from('clip_cta_jobs')
      .select('id, status, deleted_at')
      .eq('id', jobId)
      .single()

    if (fetchErr || !job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
    }
    if (job.deleted_at) {
      return NextResponse.json({ success: false, error: 'Already deleted' }, { status: 400 })
    }
    if (job.status === 'queued' || job.status === 'processing') {
      return NextResponse.json({ success: false, error: 'Job is still running. Wait for it to finish or fail.' }, { status: 400 })
    }

    // Remove storage files (best-effort — don't fail if files are missing)
    await supabase.storage.from('clip-uploads').remove([`${jobId}/source.mp4`, `${jobId}/source.mov`, `${jobId}/source.webm`])
    await supabase.storage.from('video-renders').remove([`${jobId}/final.mp4`])
    await supabase.storage.from('video-assets').remove([`${jobId}/cta-image.jpg`, `${jobId}/cta-image.png`, `${jobId}/cta-image.webp`])

    // Soft-delete the row
    await supabase
      .from('clip_cta_jobs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', jobId)

    console.log(`[clip-cta/delete] Job ${jobId} deleted`)
    return NextResponse.json({ success: true, jobId })

  } catch (err: any) {
    console.error('[clip-cta/delete]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
