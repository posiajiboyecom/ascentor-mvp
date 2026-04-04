// ================================================================
// lib/subscriptionGuard.ts
// ================================================================
// Server-side subscription guard for API routes.
// Plan IDs: explorer | builder | climber (canonical)
//
// Usage in an API route:
//   const guard = await requireSubscription('builder')
//   if (guard.error) return guard.error
//   const { user, effectivePlan } = guard
// ================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── Plan hierarchy ────────────────────────────────────────────
const PLAN_RANK: Record<string, number> = {
  free:     0,
  explorer: 1,
  builder:  2,
  climber:  3,
}

export type MinPlan = 'free' | 'explorer' | 'builder' | 'climber'

export interface GuardSuccess {
  error:         null
  user:          { id: string; email: string }
  effectivePlan: string
  planRank:      number
}

export interface GuardFailure {
  error:         NextResponse
  user:          null
  effectivePlan: null
  planRank:      null
}

export type GuardResult = GuardSuccess | GuardFailure

export async function requireSubscription(minPlan: MinPlan = 'free'): Promise<GuardResult> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null, effectivePlan: null, planRank: null,
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_plan, subscription_status, subscription_end')
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
  const userRank = PLAN_RANK[effectivePlan] ?? 0
  const minRank  = PLAN_RANK[minPlan] ?? 0

  if (userRank < minRank) {
    return {
      error: NextResponse.json(
        {
          error:       'Subscription required',
          requiredPlan: minPlan,
          currentPlan:  effectivePlan,
          upgradeUrl:   `/checkout?required=${minPlan}`,
        },
        { status: 403 }
      ),
      user: null, effectivePlan: null, planRank: null,
    }
  }

  return {
    error: null,
    user: { id: user.id, email: user.email || '' },
    effectivePlan,
    planRank: userRank,
  }
}

// ── Coach session monthly limit ───────────────────────────────
// -1 = unlimited
const COACH_LIMITS: Record<string, number> = {
  free:     5,
  explorer: 30,
  builder:  -1,
  climber:  -1,
}

export async function checkCoachSessionLimit(userId: string, effectivePlan: string): Promise<{
  allowed: boolean
  used:    number
  limit:   number
  error?:  NextResponse
}> {
  const limit = COACH_LIMITS[effectivePlan] ?? 5
  if (limit === -1) return { allowed: true, used: 0, limit: -1 }

  const supabase = await createClient()
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('coaching_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString())

  const used = count || 0

  if (used >= limit) {
    const nextPlan = effectivePlan === 'free' ? 'explorer' : 'builder'
    return {
      allowed: false,
      used,
      limit,
      error: NextResponse.json(
        {
          error:      'Monthly session limit reached',
          used,
          limit,
          upgradeUrl: `/checkout?required=${nextPlan}&feature=coach`,
          message:    `You've used all ${limit} Sage sessions this month. Upgrade for more.`,
        },
        { status: 429 }
      ),
    }
  }

  return { allowed: true, used, limit }
}

// ── Expert session monthly limit ──────────────────────────────
// free=0, explorer=1, builder=2, climber=unlimited
const EXPERT_LIMITS: Record<string, number> = {
  free:     0,
  explorer: 1,
  builder:  2,
  climber:  -1,
}

export async function checkExpertSessionLimit(userId: string, effectivePlan: string): Promise<{
  allowed: boolean
  used:    number
  limit:   number
  error?:  NextResponse
}> {
  const limit = EXPERT_LIMITS[effectivePlan] ?? 0

  if (limit === -1) return { allowed: true, used: 0, limit: -1 }

  if (limit === 0) {
    return {
      allowed: false,
      used:    0,
      limit:   0,
      error:   NextResponse.json(
        {
          error:      'Expert sessions require a paid plan',
          upgradeUrl: '/checkout?required=explorer&feature=experts',
          message:    'Upgrade to Explorer or higher to register for expert sessions.',
        },
        { status: 403 }
      ),
    }
  }

  const supabase = await createClient()
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('session_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString())

  const used = count || 0

  if (used >= limit) {
    return {
      allowed: false,
      used,
      limit,
      error: NextResponse.json(
        {
          error:      'Monthly expert session limit reached',
          used,
          limit,
          upgradeUrl: '/checkout?required=builder&feature=experts',
          message:    `You've used your ${limit} expert session${limit > 1 ? 's' : ''} this month. Upgrade to Builder for more.`,
        },
        { status: 429 }
      ),
    }
  }

  return { allowed: true, used, limit }
}
