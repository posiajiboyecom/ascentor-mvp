// lib/partnerTier.ts
//
// Single source of truth for all partner tier rules.
// Every API route and UI component imports from here.
// Change a limit once, it's reflected everywhere.
//
// Tiers:
//   starter  — ₦10,000/month, 100 members, Ascentor content only
//   growth   — ₦30,000/month, 500 members, own courses + events
//   pro      — ₦70,000/month, unlimited, full white-label + RAG

export type PartnerTier = 'starter' | 'growth' | 'pro';

// ── Tier config ───────────────────────────────────────────────────────────────

export interface TierConfig {
  name:             string;
  monthlyNgn:       number;
  annualNgn:        number;        // 10 months price = 2 months free
  maxMembers:       number;        // -1 = unlimited
  maxCourses:       number;        // -1 = unlimited, 0 = none
  maxEventsPerMonth: number;       // -1 = unlimited, 0 = none
  revenueSharePct:  number;        // partner keeps this %
  ascentorFeePct:   number;        // Ascentor keeps this %
  features: {
    customDomain:      boolean;
    customAiPersona:   boolean;
    ownCourses:        boolean;
    ownEvents:         boolean;
    hideAscentorBrand: boolean;
    ragKnowledgeBase:  boolean;
    fullAnalytics:     boolean;
    perMemberAnalytics: boolean;
    prioritySupport:   boolean;
  };
}

export const TIER_CONFIG: Record<PartnerTier, TierConfig> = {
  starter: {
    name:              'Starter',
    monthlyNgn:        10_000,
    annualNgn:         100_000,
    maxMembers:        100,
    maxCourses:        0,
    maxEventsPerMonth: 0,
    revenueSharePct:   65,
    ascentorFeePct:    35,
    features: {
      customDomain:       false,
      customAiPersona:    false,
      ownCourses:         false,
      ownEvents:          false,
      hideAscentorBrand:  false,
      ragKnowledgeBase:   false,
      fullAnalytics:      false,
      perMemberAnalytics: false,
      prioritySupport:    false,
    },
  },

  growth: {
    name:              'Growth',
    monthlyNgn:        30_000,
    annualNgn:         300_000,
    maxMembers:        500,
    maxCourses:        10,
    maxEventsPerMonth: 10,
    revenueSharePct:   70,
    ascentorFeePct:    30,
    features: {
      customDomain:       true,
      customAiPersona:    true,
      ownCourses:         true,
      ownEvents:          true,
      hideAscentorBrand:  false,
      ragKnowledgeBase:   false,
      fullAnalytics:      true,
      perMemberAnalytics: false,
      prioritySupport:    false,
    },
  },

  pro: {
    name:              'Pro',
    monthlyNgn:        70_000,
    annualNgn:         700_000,
    maxMembers:        -1,
    maxCourses:        -1,
    maxEventsPerMonth: -1,
    revenueSharePct:   80,
    ascentorFeePct:    20,
    features: {
      customDomain:       true,
      customAiPersona:    true,
      ownCourses:         true,
      ownEvents:          true,
      hideAscentorBrand:  true,
      ragKnowledgeBase:   true,
      fullAnalytics:      true,
      perMemberAnalytics: true,
      prioritySupport:    true,
    },
  },
};

// ── Helper functions ──────────────────────────────────────────────────────────

/** Resolve a partner's tier. Falls back to 'starter' for null/unknown values. */
export function resolveTier(planTier: string | null | undefined): PartnerTier {
  if (planTier === 'growth' || planTier === 'pro' || planTier === 'starter') return planTier;
  // Legacy: 'standard' was the old name for growth
  if (planTier === 'standard') return 'growth';
  return 'starter';
}

/** Get the full config for a partner's tier. */
export function getTierConfig(planTier: string | null | undefined): TierConfig {
  return TIER_CONFIG[resolveTier(planTier)];
}

/** Check if a partner's tier allows a specific named feature. */
export function hasFeature(
  planTier: string | null | undefined,
  feature: keyof TierConfig['features']
): boolean {
  return getTierConfig(planTier).features[feature];
}

/** Check if a partner can add more courses (returns true if within limit). */
export function canAddCourse(planTier: string | null | undefined, currentCount: number): boolean {
  const max = getTierConfig(planTier).maxCourses;
  if (max === 0) return false;
  if (max === -1) return true;
  return currentCount < max;
}

/** Check if a partner can schedule more events this month. */
export function canAddEvent(planTier: string | null | undefined, eventsThisMonth: number): boolean {
  const max = getTierConfig(planTier).maxEventsPerMonth;
  if (max === 0) return false;
  if (max === -1) return true;
  return eventsThisMonth < max;
}

/** Check if a partner can add more members. */
export function canAddMember(planTier: string | null | undefined, currentCount: number): boolean {
  const max = getTierConfig(planTier).maxMembers;
  if (max === -1) return true;
  return currentCount < max;
}

/** Human-readable limit description for UI display. */
export function courseLimitLabel(planTier: string | null | undefined): string {
  const max = getTierConfig(planTier).maxCourses;
  if (max === 0)  return 'Not available on this plan';
  if (max === -1) return 'Unlimited';
  return `Up to ${max} courses`;
}

export function eventLimitLabel(planTier: string | null | undefined): string {
  const max = getTierConfig(planTier).maxEventsPerMonth;
  if (max === 0)  return 'Not available on this plan';
  if (max === -1) return 'Unlimited';
  return `Up to ${max} per month`;
}

export function memberLimitLabel(planTier: string | null | undefined): string {
  const max = getTierConfig(planTier).maxMembers;
  if (max === -1) return 'Unlimited';
  return `Up to ${max} members`;
}

/** What tier to suggest upgrading to. */
export function nextTier(planTier: string | null | undefined): PartnerTier | null {
  const t = resolveTier(planTier);
  if (t === 'starter') return 'growth';
  if (t === 'growth')  return 'pro';
  return null;
}

/** Format NGN price for display. */
export function formatNgn(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`;
}
