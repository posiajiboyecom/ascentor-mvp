// ================================================================
// GET /api/subscription/status
// ================================================================
// Returns current plan, usage counts, and limit flags.
// Plan IDs: explorer | builder | climber (canonical — no legacy)
//
// Fixes applied:
//   - PLAN_LIMITS now imported from lib/session-limits.ts (single
//     source of truth) instead of duplicated inline
//   - communityPosts count now reads from community_messages
//     (the live table) — not cohort_posts (old/dead schema)
// ================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PLAN_LIMITS, getEffectivePlan } from '@/lib/session-limits'
import { effectivePlan } from '@/lib/planTier'

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

    // Use planTier.effectivePlan for display/rank (normalises legacy IDs),
    // and session-limits.getEffectivePlan for limit lookup (same logic,
    // but returns the raw plan string so PLAN_LIMITS can alias it).
    const canonicalPlan = effectivePlan(profile)        // 'free' | 'explorer' | 'builder' | 'climber'
    const limitsKey     = getEffectivePlan(profile)     // may be a legacy alias — PLAN_LIMITS handles it
    const limits        = PLAN_LIMITS[limitsKey] ?? PLAN_LIMITS.free

    const status = profile?.subscription_status || 'free'

    const isActive =
      status === 'active' ||
      status === 'trialing' ||
      (status === 'cancelled' &&
        profile?.subscription_end &&
        new Date(profile.subscription_end) > new Date())

    // ── Monthly usage counts ──────────────────────────────────────────────
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    // Today boundary for communityPosts (per-day limit)
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const [coachRes, postRes] = await Promise.all([
      // Coach sessions: count rows in coaching_sessions this month
      supabase
        .from('coaching_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', startOfMonth.toISOString()),

      // Community posts: count non-checkin messages in community_messages today.
      // community_messages replaced the old cohort_posts table entirely.
      // is_checkin rows are ritual check-ins and don't count against the post limit.
      supabase
        .from('community_messages')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('deleted', false)
        .eq('is_checkin', false)
        .gte('created_at', startOfDay.toISOString()),
    ])

    const usage = {
      coachSessions:  coachRes.count  || 0,
      communityPosts: postRes.count   || 0,
    }

    // Build a display-friendly limits shape that mirrors the old inline
    // format so existing callers of this endpoint aren't broken.
    const displayLimits = {
      coachSessions:  limits.coachingSessions,
      communityPosts: limits.communityPosts,
    }

    const remaining = {
      coachSessions: displayLimits.coachSessions === -1
        ? null
        : Math.max(0, displayLimits.coachSessions - usage.coachSessions),
    }

    return NextResponse.json({
      plan:              canonicalPlan,
      rawPlan:           profile?.subscription_plan || 'free',
      status,
      isActive,
      planRank:          PLAN_RANK[canonicalPlan] || 0,
      subscriptionEnd:   profile?.subscription_end,
      subscriptionStart: profile?.subscription_start,
      paymentMethod:     profile?.payment_method,
      limits:            displayLimits,
      usage,
      remaining,
      // Convenience flags
      canUseCoach:    displayLimits.coachSessions   === -1 || usage.coachSessions   < displayLimits.coachSessions,
      canPost:        displayLimits.communityPosts  === -1 || usage.communityPosts  < displayLimits.communityPosts,
      isExplorerPlus: (PLAN_RANK[canonicalPlan] || 0) >= 1,
      isBuilderPlus:  (PLAN_RANK[canonicalPlan] || 0) >= 2,
      isClimber:      (PLAN_RANK[canonicalPlan] || 0) >= 3,
    })

  } catch (err: any) {
    console.error('[Status API]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
