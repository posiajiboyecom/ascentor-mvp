// lib/plans-display.ts
// The one place that maps database plan ids to the names members see.
// Database ids (profiles.subscription_plan) are NOT renamed: explorer / builder / leader / climber.
//
//   explorer -> Seeker   builder -> Builder   leader -> Leader   climber -> Climber (legacy, not featured in the plan UI)
//
// Access gating (lib/planTier.ts) treats Leader as the top tier; the NAME stays "Leader" everywhere it is shown.
//
// PRICES are not here. They live in lib/plans-config.ts (env-driven, server only) and reach client components
// as props, so what is displayed and what /api/pay/start charges can never disagree.

import { normalisePlan, PLAN_RANK, type PlanTier } from '@/lib/planTier';

export const PLAN_DISPLAY_NAME: Record<PlanTier, string> = {
  free: 'Free',
  explorer: 'Seeker',
  builder: 'Builder',
  climber: 'Climber',
};

/** Member-facing name for any stored plan value, including legacy ones (basic, standard, premium). */
export function planDisplayName(raw: string | null | undefined): string {
  if (raw === 'leader') return 'Leader';
  return PLAN_DISPLAY_NAME[normalisePlan(raw)] ?? 'Free';
}

/** The plan id to show and compare on screen: like normalisePlan, but Leader stays Leader. */
export function planKey(raw: string | null | undefined): PlanTier | 'leader' {
  return raw === 'leader' ? 'leader' : normalisePlan(raw);
}

/** Plans shown as cards in the plan screen, in order. Climber is intentionally not listed. */
export const FEATURED_PLANS = ['explorer', 'builder', 'leader'] as const;
export type FeaturedPlan = (typeof FEATURED_PLANS)[number];

export const PLAN_BULLETS: Record<FeaturedPlan, string[]> = {
  explorer: ['Your Circle and weekly meetings', 'Learn pathways and Sage · AI coach', 'Circle mentorship on foundations'],
  builder: ['Everything in Seeker', 'Industry mentorship with a view of the global tech ecosystem', 'Remote internships and work experience', 'Opportunities for business owners'],
  // From the prototypes (Plan screen and facilitator invite). Nothing else is promised for Leader until it is specified.
  leader: ['For members who facilitate a Circle', 'The Facilitators’ room, with other Leaders'],
};

/** True when moving from `from` to `to` is an upgrade. */
export function isUpgrade(from: string | null | undefined, to: string): boolean {
  return (PLAN_RANK[normalisePlan(to)] ?? 0) > (PLAN_RANK[normalisePlan(from)] ?? 0);
}
