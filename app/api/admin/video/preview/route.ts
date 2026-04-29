// ═══════════════════════════════════════════════════════════
// Ascentor Video Engine — Preview endpoint (Phase 3)
// Drop in: app/api/admin/video/preview/route.ts
//
// POST { formInput: VideoFormInput }
//
// Runs the Claude story engine ONLY. Returns the full
// StoryEngineResponse for inline editing in the drawer.
//
// Cheap (~$0.01–0.02). Fast (~5–12s).
// No DB write, no Trigger enqueue, no ElevenLabs, no Remotion.
//
// Once the admin is happy, the drawer calls /api/admin/video/generate
// with `presetStory` populated — that path skips the Claude call.
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { generateVideoStory } from '@/lib/video/story-engine'
import type { VideoFormInput } from '@/types/video'

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

    // ── Parse body ───────────────────────────────────────────
    const body = await req.json()
    const { formInput } = body as { formInput: VideoFormInput }

    if (!formInput?.goal || !formInput?.keyMessage) {
      return NextResponse.json(
        { success: false, error: 'goal and keyMessage are required' },
        { status: 400 }
      )
    }
    if (!formInput?.narrativeStyle || !formInput?.audienceTier) {
      return NextResponse.json(
        { success: false, error: 'narrativeStyle and audienceTier are required' },
        { status: 400 }
      )
    }

    // ── Run the story engine ─────────────────────────────────
    console.log(`[video/preview] Generating story for ${user.id}...`)
    const story = await generateVideoStory(formInput)
    console.log(`[video/preview] ${story.scenes.length} scenes generated`)

    // Apply the same scene-duration transform the Trigger task uses so the
    // preview duration matches the rendered video.
    const SLOW = 1.8
    const CTA_DURATION_SECONDS = 8
    const adjustedScenes = story.scenes
      .slice(0, 8)
      .map(s => ({ ...s, durationSeconds: Math.min(Math.round((s.durationSeconds * SLOW) * 10) / 10, 7) }))

    const totalDurationSeconds =
      adjustedScenes.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) +
      CTA_DURATION_SECONDS

    return NextResponse.json({
      success: true,
      story: {
        ...story,
        scenes: adjustedScenes,
        totalDurationSeconds,
      },
    })

  } catch (err: any) {
    console.error('[video/preview]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
