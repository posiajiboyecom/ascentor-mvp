// lib/plans-display.ts
// The one place that maps database plan ids to the names members see.
// Ascentor sells three plans (Billing v2, lib/billing/catalog.ts): Seeker (stored as 'explorer'), Builder and Pinnacle.
// Any other stored value is from the retired billing system and is shown as Free (see lib/planTier.ts).
//
// Leader is not a plan. Invited facilitators are flagged with profiles.leader_free and lead for free; where a
// facilitator's status needs a name, it is "Leader".

import { normalisePlan, PLAN_RANK, type PlanTier } from '@/lib/planTier';

export const PLAN_DISPLAY_NAME: Record<PlanTier, string> = {
  free: 'Free',
  explorer: 'Seeker',
  builder: 'Builder',
  pinnacle: 'Pinnacle',
};

/** Member-facing name for any stored plan value. Retired values show as Free. */
export function planDisplayName(raw: string | null | undefined): string {
  if (raw === 'leader') return 'Leader';
  return PLAN_DISPLAY_NAME[normalisePlan(raw)];
}

/** The plans members can buy, in order. */
export const FEATURED_PLANS = ['explorer', 'builder', 'pinnacle'] as const;
export type FeaturedPlan = (typeof FEATURED_PLANS)[number];

/** One line on who each plan is for. Shown at checkout, in Billing and on the public pricing section. */
export const PLAN_BLURBS: Record<FeaturedPlan, string> = {
  explorer: 'For people finding their direction.',
  builder: 'For people building a career or a business.',
  pinnacle: 'For people who want one-to-one guidance.',
};

/** What each plan includes. The single list used at checkout, in Billing and on the public pricing section. */
export const PLAN_BULLETS: Record<FeaturedPlan, string[]> = {
  explorer: ['Your Circle, with a weekly call', 'Circle mentorship', 'Core Learn pathways', 'Sage · AI coach, 25 messages a day', 'One live expert session a month', 'Community and direct messages'],
  builder: ['Everything in Seeker', 'Advanced Learn pathways', 'Sage · AI coach, 75 messages a day', 'Two live expert sessions a month', 'Industry mentorship', 'Remote internships and work experience', 'Opportunities for business owners'],
  pinnacle: ['Everything in Builder', 'A private 20-minute mentor session every month', 'Unlimited Sage · AI coach', 'Four live expert sessions a month, with seats held for you', 'Priority support'],
};

/** True when moving from `from` to `to` is an upgrade. */
export function isUpgrade(from: string | null | undefined, to: string): boolean {
  return PLAN_RANK[normalisePlan(to)] > PLAN_RANK[normalisePlan(from)];
}
