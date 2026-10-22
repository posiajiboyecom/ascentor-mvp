import 'server-only';
// lib/access.ts
// ─────────────────────────────────────────────────────────────────────────────
// Server-side member access for billing v2. One cheap read of member_subscriptions per request (React cache), then the pure
// rules in lib/billing/access.ts decide. A member WITHOUT a row is a legacy member: v2 is false and every caller keeps its
// existing behaviour (profiles.subscription_* through lib/planTier.ts).
//
// Exports
//   getMemberAccess(userId)                    -> MemberAccess (v2 flag, level, features)
//   effectivePlanForUser(userId, profile)      -> PlanTier: v2 members from member_subscriptions, everyone else exactly effectivePlan(profile)
//   getBillingV2Input(userId)                  -> the subscription row shaped for deriveBilling(), or null (legacy)
//   featureBlock(userId, feature)              -> null when allowed, else a short member-facing message (legacy members are never blocked)
// ─────────────────────────────────────────────────────────────────────────────

import { cache } from 'react';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { effectivePlan, normalisePlan, type PlanTier } from '@/lib/planTier';
import { accessFromSubscription, planForAccess, LEGACY_ACCESS, type Features, type MemberAccess } from '@/lib/billing/access';
import type { SubState } from '@/lib/billing/rules';
import type { BillingV2Input } from '@/lib/billing-state';
import type { Tier } from '@/lib/billing/catalog';

type Row = { state: SubState; tier: Tier; period_end: string | null; trial_ends_at: string | null };

async function load(userId: string): Promise<MemberAccess> {
  try {
    const { data, error } = await supabaseAdmin.from('member_subscriptions').select('state, tier, period_end, trial_ends_at').eq('user_id', userId).maybeSingle();
    if (error) { console.error('[access] member_subscriptions read failed:', error.message); return LEGACY_ACCESS; }
    const row = data as Row | null;
    if (!row) return LEGACY_ACCESS;
    const { data: prof } = await supabaseAdmin.from('profiles').select('leader_free').eq('id', userId).maybeSingle();
    return accessFromSubscription(
      { state: row.state, tier: row.tier, periodEnd: row.period_end ? new Date(row.period_end) : null, trialEndsAt: row.trial_ends_at ? new Date(row.trial_ends_at) : null },
      !!(prof as { leader_free?: boolean } | null)?.leader_free,
      new Date(),
    );
  } catch (e) {
    // Never lock anybody out because of a read problem: fall back to the legacy rules.
    console.error('[access] failed:', e instanceof Error ? e.message : 'unknown');
    return LEGACY_ACCESS;
  }
}

const cached = cache(load);

export async function getMemberAccess(userId: string): Promise<MemberAccess> {
  return cached(userId);
}

/** Same result as effectivePlan(profile) for legacy members; v2 members get what their subscription row says. */
export async function effectivePlanForUser(
  userId: string,
  profile: { subscription_plan?: string | null; subscription_status?: string | null; subscription_end?: string | null } | null | undefined,
): Promise<PlanTier> {
  const a = await getMemberAccess(userId);
  const plan = planForAccess(a);
  return plan ? normalisePlan(plan) : effectivePlan(profile);
}

const MESSAGES: Partial<Record<keyof Features, string>> = {
  sage: 'Sage is paused while your plan is paused. Reactivate in Billing and it opens straight away.',
  circleChat: 'Your Circle chat is paused while your plan is paused. Reactivate in Billing and you are back at once.',
  mentorSessions: 'Mentor sessions are paused while your plan is paused. Reactivate in Billing and you are back at once.',
  advancedLearn: 'Advanced Learn tracks are paused while your plan is paused. Reactivate in Billing to open them.',
};

/** null = allowed. Legacy members (no v2 row) are never blocked here. */
export async function featureBlock(userId: string, feature: keyof Features): Promise<string | null> {
  const a = await getMemberAccess(userId);
  if (!a.v2) return null;
  if (a.features[feature]) return null;
  return MESSAGES[feature] ?? 'This is paused while your plan is paused. Reactivate in Billing to open it.';
}

/** The member's v2 subscription as deriveBilling() wants it, or null for a legacy member. */
export async function getBillingV2Input(userId: string): Promise<BillingV2Input | null> {
  try {
    const { data } = await supabaseAdmin.from('member_subscriptions')
      .select('state, period_end, trial_ends_at, grace_ends_at, cancel_at_period_end').eq('user_id', userId).maybeSingle();
    if (!data) return null;
    const r = data as { state: BillingV2Input['state']; period_end: string | null; trial_ends_at: string | null; grace_ends_at: string | null; cancel_at_period_end: boolean | null };
    return { state: r.state, periodEnd: r.period_end, trialEndsAt: r.trial_ends_at, graceEndsAt: r.grace_ends_at, cancelAtPeriodEnd: !!r.cancel_at_period_end };
  } catch { return null; }
}
