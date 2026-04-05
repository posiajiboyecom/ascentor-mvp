// lib/planTier.ts
// ============================================================
// Single source of truth for plan-tier logic across the app.
//
// Used by:
//   - Community page  (cohorts)
//   - Learn page      (courses)
//   - Experts page    (expert_sessions)
//   - Admin forms     (tier selector)
// ============================================================

export type PlanTier = 'free' | 'explorer' | 'builder' | 'climber'

export const PLAN_RANK: Record<string, number> = {
  free:     0,
  explorer: 1, basic:    1,   // legacy alias
  builder:  2, standard: 2,   // legacy alias
  climber:  3, premium:  3,   // legacy alias
}

// Normalise legacy DB values to canonical names
const PLAN_ALIAS: Record<string, PlanTier> = {
  basic:    'explorer',
  standard: 'builder',
  premium:  'climber',
}

export function normalisePlan(raw: string | null | undefined): PlanTier {
  if (!raw) return 'free'
  return PLAN_ALIAS[raw] ?? (raw as PlanTier)
}

/**
 * Returns true if the user's effective plan meets or exceeds the required tier.
 * Inclusive upward: a Builder can access explorer + builder + free content.
 */
export function canAccess(userPlan: string | null | undefined, requiredTier: PlanTier): boolean {
  const userRank = PLAN_RANK[normalisePlan(userPlan)] ?? 0
  const reqRank  = PLAN_RANK[requiredTier] ?? 0
  return userRank >= reqRank
}

/**
 * Derives the effective plan for a profile row.
 * Returns 'free' if subscription is expired, cancelled past end, or inactive.
 */
export function effectivePlan(profile: {
  subscription_plan?:   string | null
  subscription_status?: string | null
  subscription_end?:    string | null
} | null | undefined): PlanTier {
  if (!profile) return 'free'

  const isActive =
    profile.subscription_status === 'active' ||
    profile.subscription_status === 'trialing' ||
    (profile.subscription_status === 'cancelled' &&
      profile.subscription_end &&
      new Date(profile.subscription_end) > new Date())

  if (!isActive) return 'free'
  return normalisePlan(profile.subscription_plan)
}

// ── UI metadata for tier badges ────────────────────────────────

export interface TierMeta {
  label:      string
  color:      string       // hex — for text / dot
  bg:         string       // rgba — for badge background
  border:     string       // rgba — for badge border
}

export const TIER_META: Record<PlanTier, TierMeta> = {
  free:     { label: 'Free',     color: '#A09880', bg: 'rgba(160,152,128,0.10)', border: 'rgba(160,152,128,0.22)' },
  explorer: { label: 'Explorer', color: '#14B8A6', bg: 'rgba(20,184,166,0.10)',  border: 'rgba(20,184,166,0.22)'  },
  builder:  { label: 'Builder',  color: '#E8A020', bg: 'rgba(232,160,32,0.10)',  border: 'rgba(232,160,32,0.22)'  },
  climber:  { label: 'Climber',  color: '#8B5CF6', bg: 'rgba(139,92,246,0.10)',  border: 'rgba(139,92,246,0.22)'  },
}

export const TIER_OPTIONS: { value: PlanTier; label: string }[] = [
  { value: 'free',     label: 'Free — accessible to all users'          },
  { value: 'explorer', label: 'Explorer and above'                       },
  { value: 'builder',  label: 'Builder and above'                        },
  { value: 'climber',  label: 'Climber only (highest tier)'              },
]
