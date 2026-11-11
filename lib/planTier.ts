// lib/planTier.ts
// ============================================================
// Single source of truth for plan-tier logic across the app.
//
// Ascentor has exactly three paid plans (Billing v2, lib/billing/catalog.ts):
//   Seeker   — stored as 'explorer'
//   Builder  — stored as 'builder'
//   Pinnacle — stored as 'pinnacle'
// Everything else is free. Older plan values (climber, premium, basic, standard, …) belong to the retired
// billing system and are treated as free. Leader is not a paid plan: invited facilitators get Builder-level
// access for free, so 'leader' gates as 'builder'.
//
// Used by: community (cohorts), experts (expert_sessions), admin tier selectors, access checks.
// ============================================================

export type PlanTier = 'free' | 'explorer' | 'builder' | 'pinnacle'

export const PLAN_RANK: Record<PlanTier, number> = {
  free:     0,
  explorer: 1,
  builder:  2,
  pinnacle: 3,
}

/** Maps any stored plan value to a current tier. Unknown and retired values are free. */
export function normalisePlan(raw: string | null | undefined): PlanTier {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'explorer':
    case 'seeker':
      return 'explorer'
    case 'builder':
    case 'leader':
      return 'builder'
    case 'pinnacle':
      return 'pinnacle'
    default:
      return 'free'
  }
}

/**
 * Returns true if the user's effective plan meets or exceeds the required tier.
 * Inclusive upward: a Builder can access Seeker and free content.
 */
export function canAccess(userPlan: string | null | undefined, requiredTier: string | null | undefined): boolean {
  // 'paid' (used by expert sessions) means any paid plan: Seeker, Builder or Pinnacle.
  const required: PlanTier = requiredTier === 'paid' ? 'explorer' : normalisePlan(requiredTier)
  return PLAN_RANK[normalisePlan(userPlan)] >= PLAN_RANK[required]
}

/** Paid access ends this long after subscription_end, so a renewal that is a few hours late never locks anyone out. */
const END_GRACE_MS = 2 * 24 * 60 * 60 * 1000

/**
 * Derives the effective plan for a profile row.
 * Returns 'free' when the subscription is inactive, or when its end date has passed (active, trialing and
 * cancelled alike — Billing v2 moves subscription_end forward on every renewal and through the grace period).
 */
export function effectivePlan(profile: {
  subscription_plan?:   string | null
  subscription_status?: string | null
  subscription_end?:    string | null
} | null | undefined, now: Date = new Date()): PlanTier {
  if (!profile) return 'free'
  const status = profile.subscription_status
  if (status !== 'active' && status !== 'trialing' && status !== 'cancelled') return 'free'

  const end = profile.subscription_end ? new Date(profile.subscription_end).getTime() : null
  if (status === 'cancelled') {
    if (end === null || end <= now.getTime()) return 'free'
  } else if (end !== null && end + END_GRACE_MS <= now.getTime()) {
    return 'free'
  }
  return normalisePlan(profile.subscription_plan)
}

// ── UI metadata for tier badges ────────────────────────────────

export interface TierMeta {
  label:      string
  color:      string       // hex - for text / dot
  bg:         string       // rgba - for badge background
  border:     string       // rgba - for badge border
}

export const TIER_META: Record<PlanTier, TierMeta> = {
  free:     { label: 'Free',    color: '#A09880', bg: 'rgba(160,152,128,0.10)', border: 'rgba(160,152,128,0.22)' },
  explorer: { label: 'Seeker',  color: '#14B8A6', bg: 'rgba(20,184,166,0.10)',  border: 'rgba(20,184,166,0.22)'  },
  builder:  { label: 'Builder', color: '#E8A020', bg: 'rgba(232,160,32,0.10)',  border: 'rgba(232,160,32,0.22)'  },
  pinnacle: { label: 'Pinnacle', color: '#B4532A', bg: 'rgba(180,83,42,0.10)',  border: 'rgba(180,83,42,0.24)'   },
}

export const TIER_OPTIONS: { value: PlanTier; label: string }[] = [
  { value: 'free',     label: 'Free, open to every member' },
  { value: 'explorer', label: 'Every paid plan'            },
  { value: 'builder',  label: 'Builder and Pinnacle'       },
  { value: 'pinnacle', label: 'Pinnacle only'              },
]
