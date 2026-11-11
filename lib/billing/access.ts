// lib/billing/access.ts
// ─────────────────────────────────────────────────────────────────────────────
// Billing v2 ACCESS rules. PURE: no I/O, `now` is passed in. Tested in scripts/billing-tests/access.test.ts.
// Applies ONLY to members that have a member_subscriptions row (v2). A member with no row is "legacy" and keeps
// today's behaviour exactly (callers fall back to lib/planTier.ts effectivePlan).
//
// Exports
//   Features, featuresFor(level, tier)           what a member may use
//   accessFromSubscription(sub, leaderFree, now) -> MemberAccess
//   LEGACY_ACCESS                                 what a member without a v2 row gets from this module (callers still apply the old rules)
//   planForAccess(access)                         the plan id the gating code understands ('free' | 'explorer' | 'builder' | 'pinnacle')
//
// Handoff tables:
//   full  (trial, active, grace, cancelled until period end): everything the tier includes
//   light (lapsed after grace, cancelled after period end): Today, daily practices, own growth record, open house,
//         direct messages. Sage, Circle chat, advanced Learn and mentor sessions are off.
//   Direct messages are ON for every tier and every state (owner answer: Seekers get direct messages).
//   Pinnacle (full only) adds: a private mentor session each month, unlimited Sage, priority support.
//   SAGE_DAILY_MESSAGES caps Sage messages a day by tier (null = no cap).
// ─────────────────────────────────────────────────────────────────────────────

import { accessLevel, type SubState } from './rules';
import type { Tier } from './catalog';

export interface Features {
  today: boolean;
  growthRecord: boolean;
  openHouse: boolean;
  directMessages: boolean;
  sage: boolean;
  circleChat: boolean;
  mentorSessions: boolean;
  /** Core Learn tracks (every paid tier). */
  coreLearn: boolean;
  /** Advanced Learn tracks (Builder and Leader). */
  advancedLearn: boolean;
  facilitatorMaterial: boolean;
  /** One private 20-minute mentor session a month (Pinnacle). */
  privateMentor: boolean;
  /** Help and contact requests go to the top of the admin inbox (Pinnacle). */
  prioritySupport: boolean;
}

/** Sage messages a member may send in 24 hours, by tier. null = no daily cap (the short-burst rate limit still applies). */
export const SAGE_DAILY_MESSAGES: Record<MemberTier, number | null> = { explorer: 25, builder: 75, pinnacle: null, leader: 75 };

export type Level = 'full' | 'light';
export type MemberTier = Tier | 'leader';

export function featuresFor(level: Level, tier: MemberTier | null): Features {
  const base = { today: true, growthRecord: true, openHouse: true, directMessages: true };
  if (level === 'light') {
    return { ...base, sage: false, circleChat: false, mentorSessions: false, coreLearn: false, advancedLearn: false, facilitatorMaterial: false, privateMentor: false, prioritySupport: false };
  }
  return {
    ...base, sage: true, circleChat: true, mentorSessions: true, coreLearn: true,
    advancedLearn: tier === 'builder' || tier === 'pinnacle' || tier === 'leader',
    facilitatorMaterial: tier === 'leader',
    privateMentor: tier === 'pinnacle',
    prioritySupport: tier === 'pinnacle',
  };
}

export interface AccessSub {
  state: SubState;
  tier: Tier;
  periodEnd?: Date | null;
  trialEndsAt?: Date | null;
}

export interface MemberAccess {
  /** True when the member has a member_subscriptions row (billing v2). */
  v2: boolean;
  level: Level;
  state: SubState | null;
  tier: MemberTier | null;
  features: Features;
}

export const LEGACY_ACCESS: MemberAccess = { v2: false, level: 'full', state: null, tier: null, features: featuresFor('full', 'leader') };

export function accessFromSubscription(sub: AccessSub | null | undefined, leaderFree: boolean, now: Date): MemberAccess {
  if (!sub) return LEGACY_ACCESS;
  // A free Leader is never light: they do not pay, so a payment state cannot take their access away.
  const level: Level = leaderFree ? 'full' : accessLevel(sub, now);
  const tier: MemberTier = leaderFree ? 'leader' : sub.tier;
  return { v2: true, level, state: sub.state, tier, features: featuresFor(level, tier) };
}

/** The plan id the existing gating code (canAccess, requireSubscription) understands. Light access is 'free'. */
export function planForAccess(a: MemberAccess): 'free' | 'explorer' | 'builder' | 'pinnacle' | null {
  if (!a.v2) return null;
  if (a.level === 'light') return 'free';
  if (a.tier === 'leader') return 'builder'; // invited Leaders lead for free with Builder-level access
  return a.tier === 'pinnacle' ? 'pinnacle' : a.tier === 'builder' ? 'builder' : 'explorer';
}
