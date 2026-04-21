// ═══════════════════════════════════════════════════════════
// Clip+CTA — List Route
// Drop in: app/api/admin/clip-cta/list/route.ts
//
// GET /api/admin/clip-cta/list
// Returns all non-deleted clip_cta_jobs for this admin, newest first.
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

    const { data: jobs, error } = await supabase
      .from('clip_cta_jobs')
      .select(`
        id, status, cta_template, cta_duration_s, transition_type,
        clip_duration_s, clip_width, clip_height,
        video_url, error_message,
        created_at, completed_at, duration_ms, deleted_at
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) throw error

    return NextResponse.json({ jobs: jobs ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
