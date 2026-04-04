// ================================================================
// GET /api/subscription/status
// ================================================================
// Returns current plan, usage counts, and limit flags.
// Plan IDs: explorer | builder | climber (canonical — no legacy)
// ================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PLAN_LIMITS: Record<string, { coachSessions: number; communityPosts: number }> = {
  free:     { coachSessions: 5,  communityPosts: 3  },
  explorer: { coachSessions: 30, communityPosts: -1 },
  builder:  { coachSessions: -1, communityPosts: -1 },
  climber:  { coachSessions: -1, communityPosts: -1 },
}

const PLAN_RANK: Record<string, number> = {
  free:     0,
  explorer: 1,
  builder:  2,
  climber:  3,
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan, subscription_status, subscription_end, subscription_start, payment_method')
      .eq('id', user.id)
      .single()

    const plan   = profile?.subscription_plan || 'free'
    const status = profile?.subscription_status || 'free'

    const isActive =
      status === 'active' ||
      status === 'trialing' ||
      (status === 'cancelled' &&
        profile?.subscription_end &&
        new Date(profile.subscription_end) > new Date())

    const effectivePlan = isActive ? plan : 'free'

    // Limits default to free if plan not found (handles any unmigrated legacy rows)
    const limits = PLAN_LIMITS[effectivePlan] || PLAN_LIMITS.free

    // Monthly usage counts
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const [coachRes, postRes] = await Promise.all([
      supabase
        .from('coaching_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', startOfMonth.toISOString()),
      supabase
        .from('cohort_posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', startOfMonth.toISOString()),
    ])

    const usage = {
      coachSessions:  coachRes.count  || 0,
      communityPosts: postRes.count   || 0,
    }

    const remaining = {
      coachSessions: limits.coachSessions === -1
        ? null
        : Math.max(0, limits.coachSessions - usage.coachSessions),
    }

    return NextResponse.json({
      plan:              effectivePlan,
      rawPlan:           plan,
      status,
      isActive,
      planRank:          PLAN_RANK[effectivePlan] || 0,
      subscriptionEnd:   profile?.subscription_end,
      subscriptionStart: profile?.subscription_start,
      paymentMethod:     profile?.payment_method,
      limits,
      usage,
      remaining,
      // Convenience flags
      canUseCoach:     limits.coachSessions   === -1 || usage.coachSessions   < limits.coachSessions,
      canPost:         limits.communityPosts  === -1 || usage.communityPosts  < limits.communityPosts,
      isExplorerPlus:  (PLAN_RANK[effectivePlan] || 0) >= 1,
      isBuilderPlus:   (PLAN_RANK[effectivePlan] || 0) >= 2,
      isClimber:       (PLAN_RANK[effectivePlan] || 0) >= 3,
    })

  } catch (err: any) {
    console.error('[Status API]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
