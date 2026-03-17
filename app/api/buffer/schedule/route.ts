import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { schedulePost } from '@/lib/buffer'
import { z } from 'zod'

const ScheduleSchema = z.object({
  profileIds: z.array(z.string()).min(1, 'At least one profile required'),
  text: z.string().min(1).max(2200),
  mediaUrls: z.array(z.string().url()).optional(),
  scheduledAt: z.string().datetime().optional(),  // ISO string from client
  hashtags: z.array(z.string()).optional(),
})

/**
 * POST /api/buffer/schedule
 * Schedule a social media post via Buffer
 *
 * Body:
 * {
 *   profileIds: string[]
 *   text: string
 *   mediaUrls?: string[]
 *   scheduledAt?: string  (ISO datetime)
 *   hashtags?: string[]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Admin only
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = ScheduleSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { profileIds, text, mediaUrls, scheduledAt, hashtags } = parsed.data

    const posts = await schedulePost({
      profileIds,
      text,
      mediaUrls,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      hashtags,
    })

    // Optionally log the scheduled post to Supabase for tracking
    await supabase.from('scheduled_posts').insert({
      user_id: user.id,
      platform: 'buffer',
      text,
      hashtags: hashtags ?? [],
      media_urls: mediaUrls ?? [],
      scheduled_at: scheduledAt ?? null,
      buffer_update_ids: posts.map(p => p.id),
      status: 'scheduled',
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      posts,
      message: scheduledAt
        ? `Post scheduled for ${new Date(scheduledAt).toLocaleString()}`
        : 'Post added to Buffer queue',
    })
  } catch (error) {
    console.error('Buffer schedule error:', error)
    return NextResponse.json(
      { error: 'Failed to schedule post' },
      { status: 500 }
    )
  }
}
