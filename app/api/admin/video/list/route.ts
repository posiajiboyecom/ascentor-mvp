// ═══════════════════════════════════════════════════════════
// Ascentor Video Engine — List route (Phase 4+5 patched)
// Drop in: app/api/admin/video/list/route.ts
//
// GET /api/admin/video/list
// GET /api/admin/video/list?includeDeleted=true   (audit view)
//
// Phase 4+5 changes:
//   • Filters deleted_at IS NULL by default.
//   • Returns cost_usd_claude, cost_usd_elevenlabs, cost_usd_total,
//     timings, retry_count, deleted_at so the UI can surface them.
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
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const includeDeleted = req.nextUrl.searchParams.get('includeDeleted') === 'true'

    let query = supabase
      .from('video_jobs')
      .select(`
        id, status, goal, narrative_style, theme, audio_mode,
        scene_count, total_duration_seconds, video_url, error_message,
        created_at, completed_at, duration_ms,
        retry_count, deleted_at, used_preset,
        cost_usd_claude, cost_usd_elevenlabs, cost_usd_total, timings
      `)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!includeDeleted) {
      query = query.is('deleted_at', null)
    }

    const { data: jobs, error } = await query
    if (error) throw error

    return NextResponse.json({ jobs: jobs ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
