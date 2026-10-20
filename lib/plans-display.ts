// lib/plans-display.ts
// The one place that maps database plan ids to the names members see, and the one place that holds the
// placeholder price. Database ids (profiles.subscription_plan) are NOT renamed: explorer / builder / climber.
//
//   explorer -> Seeker      builder -> Builder      climber -> Climber (kept working, not featured in the plan UI)
//
// PRICES: the new plan screens render PRICE_PLACEHOLDER until the real amounts are decided. When they are,
// change the one constant below (or swap the helper for a formatter). What /api/pay/start charges lives in
// lib/pricing.ts and is untouched by this file.

import { normalisePlan, PLAN_RANK, type PlanTier } from '@/lib/planTier';

export const PRICE_PLACEHOLDER = '₦[PRICE]';

export const PLAN_DISPLAY_NAME: Record<PlanTier, string> = {
  free: 'Free',
  explorer: 'Seeker',
  builder: 'Builder',
  climber: 'Climber',
};

/** Member-facing name for any stored plan value, including legacy ones (basic, standard, premium). */
export function planDisplayName(raw: string | null | undefined): string {
  return PLAN_DISPLAY_NAME[normalisePlan(raw)] ?? 'Free';
}

/** Plans shown as cards in the plan screen, in order. Climber is intentionally not listed. */
export const FEATURED_PLANS = ['explorer', 'builder'] as const;
export type FeaturedPlan = (typeof FEATURED_PLANS)[number];

export const PLAN_BULLETS: Record<FeaturedPlan, string[]> = {
  explorer: ['Your Circle and weekly meetings', 'Learn pathways and Sage · AI coach', 'Circle mentorship on foundations'],
  builder: ['Everything in Seeker', 'Industry mentorship with a view of the global tech ecosystem', 'Remote internships and work experience', 'Opportunities for business owners'],
};

export const LEADER_BULLETS = ['For members who facilitate a Circle', 'Given automatically when you meet the Leader criteria, or through a facilitator invite'];

/** True when moving from `from` to `to` is an upgrade. */
export function isUpgrade(from: string | null | undefined, to: string): boolean {
  return (PLAN_RANK[normalisePlan(to)] ?? 0) > (PLAN_RANK[normalisePlan(from)] ?? 0);
}
