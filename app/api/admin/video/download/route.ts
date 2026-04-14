// ═══════════════════════════════════════════════════════════
// Drop in: app/api/admin/video/download/route.ts
//
// GET /api/admin/video/download?jobId=xxx
//
// Proxies the MP4 from Supabase Storage through your Next.js
// server so the browser sees it as same-origin and the
// `Content-Disposition: attachment` header forces a download.
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
    // ── Auth + admin check ───────────────────────────────────
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

    // ── Get jobId ────────────────────────────────────────────
    const jobId = req.nextUrl.searchParams.get('jobId')
    if (!jobId) {
      return NextResponse.json({ error: 'jobId required' }, { status: 400 })
    }

    // ── Look up video_url from video_jobs ────────────────────
    const { data: job, error: jobErr } = await supabase
      .from('video_jobs')
      .select('video_url, goal, created_at')
      .eq('id', jobId)
      .single()

    if (jobErr || !job?.video_url) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    // ── Fetch video bytes from Supabase Storage ──────────────
    const videoRes = await fetch(job.video_url)
    if (!videoRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch video' }, { status: 502 })
    }

    const videoBuffer = await videoRes.arrayBuffer()

    // ── Build a clean filename from the goal ─────────────────
    const slug = (job.goal as string)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40)
    const date = new Date(job.created_at).toISOString().slice(0, 10)
    const filename = `ascentor-${slug}-${date}.mp4`

    // ── Return with Content-Disposition: attachment ──────────
    return new NextResponse(videoBuffer, {
      status: 200,
      headers: {
        'Content-Type':        'video/mp4',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length':      String(videoBuffer.byteLength),
        'Cache-Control':       'no-store',
      },
    })

  } catch (err: any) {
    console.error('[video/download]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
