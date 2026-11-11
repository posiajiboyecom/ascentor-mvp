// lib/plans-display.ts
// The one place that maps database plan ids to the names members see.
// Ascentor sells two plans (Billing v2, lib/billing/catalog.ts): Seeker (stored as 'explorer') and Builder.
// Any other stored value is from the retired billing system and is shown as Free (see lib/planTier.ts).
//
// Leader is not a plan. Invited facilitators are flagged with profiles.leader_free and lead for free; where a
// facilitator's status needs a name, it is "Leader".

import { normalisePlan, PLAN_RANK, type PlanTier } from '@/lib/planTier';

export const PLAN_DISPLAY_NAME: Record<PlanTier, string> = {
  free: 'Free',
  explorer: 'Seeker',
  builder: 'Builder',
};

/** Member-facing name for any stored plan value. Retired values show as Free. */
export function planDisplayName(raw: string | null | undefined): string {
  if (raw === 'leader') return 'Leader';
  return PLAN_DISPLAY_NAME[normalisePlan(raw)];
}

/** The two plans members can buy, in order. */
export const FEATURED_PLANS = ['explorer', 'builder'] as const;
export type FeaturedPlan = (typeof FEATURED_PLANS)[number];

export const PLAN_BULLETS: Record<FeaturedPlan, string[]> = {
  explorer: ['Your Circle and weekly meetings', 'Learn pathways and Sage · AI coach', 'Circle mentorship on foundations'],
  builder: ['Everything in Seeker', 'Industry mentorship with a view of the global tech ecosystem', 'Remote internships and work experience', 'Opportunities for business owners'],
};

/** True when moving from `from` to `to` is an upgrade. */
export function isUpgrade(from: string | null | undefined, to: string): boolean {
  return PLAN_RANK[normalisePlan(to)] > PLAN_RANK[normalisePlan(from)];
}
