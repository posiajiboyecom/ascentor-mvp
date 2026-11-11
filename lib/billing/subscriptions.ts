// lib/billing/subscriptions.ts
// ─────────────────────────────────────────────────────────────────────────────
// Member subscription service (table member_subscriptions). Server-only.
// Only rows in member_subscriptions are ever touched by billing v2: legacy members
// (profiles.subscription_* only) keep their access until they subscribe through v2.
//
// Exports
//   Subscription                              camelCase row
//   getSubscription(userId)                   -> Subscription | null
//   startTrial(userId, {tier, cycle, currency})  default card in that currency required; state 'trial', trial_ends_at = now + 7d,
//                                             next_charge_at = trial end. The currency stays with the subscription for good.
//   cancel(userId)                            trial: cancelled at once, never charged; paid: cancel_at_period_end
//   resume(userId)                            undo a pending cancel (or a cancelled-but-still-paid period / trial)
//   changePlan(userId, {tier?, cycle?, priceType?})   paid: scheduled for the next billing date; trial: applied now
//   scheduledChange(userId, sub)              -> {tier, cycle} | null   (read by the engine at charge time)
//   reactivate(userId)                        lapsed/cancelled member pays again now (charges the default card)
//   getGroupContext(userId)                   -> { inGroup, groupId, activeCount, belowSince }
//   resolveChargePlan(sub, now)               -> group price decision via rules.ts (extension, protection, lock)
//   getCreditLedger(userId, currency?) / creditBalanceKobo(userId, now?, currency?)   credit from credit_ledger via rules.ts
//                                             (credit is earned and spent in one currency; default NGN)
//   syncProfile(userId)                       mirror v2 state into profiles (see mapping below)
//
// Profile mirror (kept inside the EXISTING vocabulary read by lib/planTier.ts effectivePlan and lib/billing-state.ts):
//   trial     -> plan=tier, status 'trialing', end = trial_ends_at
//   active    -> plan=tier, status 'active',   end = period_end  (cancel_at_period_end -> status 'cancelled', same end)
//   grace     -> plan=tier, status 'active',   end = grace_ends_at   (NOT 'past_due': effectivePlan() treats past_due as no access,
//                                                                     and grace must keep FULL access)
//   lapsed    -> plan=tier, status 'free'      (light access; billing-state shows "Light access")
//   cancelled -> plan=tier, status 'cancelled', end = period_end (past = light access)
// Leaders (profiles.leader_free) are never rewritten.
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isPaidTier, planCodeFor, getPlan, priceFor, planAmount, groupDiscountApplies, isCurrency, type Tier, type Cycle, type PriceType, type Currency } from './catalog';
import {
  addDays, trialEndsAt as trialEnd, firstChargeAt, isActiveState, countActiveMembers, decideFirstChargePrice, resolveRenewalPriceType,
  computeCreditLots, availableCreditKobo, type SubState, type LedgerRow, type FirstChargeDecision,
} from './rules';
import { logBillingEvent } from './events';
import { notifyTrialStarted } from './notify';
import { formatPlanName } from './labels';

export interface Subscription {
  userId: string;
  planCode: string;
  tier: Tier;
  priceType: PriceType;
  cycle: Cycle;
  /** NGN or USD. Set when the trial starts and never changed. */
  currency: Currency;
  state: SubState;
  trialEndsAt: Date | null;
  nextChargeAt: Date | null;
  periodEnd: Date | null;
  paymentMethodId: string | null;
  failedCount: number;
  lastFailedAt: Date | null;
  graceEndsAt: Date | null;
  extensionUsed: boolean;
  cancelAtPeriodEnd: boolean;
  startedAt: Date;
  lastChargeAt: Date | null;
  lastChargeRef: string | null;
  lockedGroupPriceUntil: Date | null;
}

type Row = Record<string, unknown>;
const dt = (v: unknown): Date | null => (typeof v === 'string' && v ? new Date(v) : null);

export function toSubscription(r: Row): Subscription {
  return {
    userId: r.user_id as string,
    planCode: r.plan_code as string,
    tier: r.tier as Tier,
    priceType: r.price_type as PriceType,
    cycle: r.cycle as Cycle,
    currency: isCurrency(r.currency) ? r.currency : 'NGN',
    state: r.state as SubState,
    trialEndsAt: dt(r.trial_ends_at),
    nextChargeAt: dt(r.next_charge_at),
    periodEnd: dt(r.period_end),
    paymentMethodId: (r.payment_method_id as string | null) ?? null,
    failedCount: Number(r.failed_count ?? 0),
    lastFailedAt: dt(r.last_failed_at),
    graceEndsAt: dt(r.grace_ends_at),
    extensionUsed: !!r.extension_used,
    cancelAtPeriodEnd: !!r.cancel_at_period_end,
    startedAt: dt(r.started_at) ?? new Date(),
    lastChargeAt: dt(r.last_charge_at),
    lastChargeRef: (r.last_charge_ref as string | null) ?? null,
    lockedGroupPriceUntil: dt(r.locked_group_price_until),
  };
}

export async function getSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabaseAdmin.from('member_subscriptions').select('*').eq('user_id', userId).maybeSingle();
  if (error) { console.error('[billing/subscriptions] read failed:', error.message); return null; }
  return data ? toSubscription(data as Row) : null;
}

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// ── Groups and credit ────────────────────────────────────────────────────────

export interface GroupContext {
  inGroup: boolean;
  groupId: string | null;
  activeCount: number;
  /** When the group was first seen below 3 members (null when complete or not in a group). */
  belowSince: Date | null;
}

/** Active-member count of the member's group (free Leaders excluded, every tier and cycle counted) and when it dipped below 3. */
export async function getGroupContext(userId: string): Promise<GroupContext> {
  const { data: mine } = await supabaseAdmin
    .from('billing_group_members').select('group_id').eq('user_id', userId).is('left_at', null).maybeSingle();
  const groupId = (mine as { group_id: string } | null)?.group_id ?? null;
  if (!groupId) return { inGroup: false, groupId: null, activeCount: 0, belowSince: null };

  const { data: members } = await supabaseAdmin.from('billing_group_members').select('user_id').eq('group_id', groupId).is('left_at', null);
  const ids = ((members ?? []) as { user_id: string }[]).map((m) => m.user_id);
  const [{ data: subs }, { data: profs }] = await Promise.all([
    supabaseAdmin.from('member_subscriptions').select('user_id, state').in('user_id', ids),
    supabaseAdmin.from('profiles').select('id, leader_free').in('id', ids),
  ]);
  const free = new Set(((profs ?? []) as { id: string; leader_free: boolean }[]).filter((p) => p.leader_free).map((p) => p.id));
  const activeCount = countActiveMembers(
    ((subs ?? []) as { user_id: string; state: SubState }[]).map((s) => ({ state: s.state, leaderFree: free.has(s.user_id) })),
  );
  const belowSince = await trackGroupHealth(userId, groupId, activeCount);
  return { inGroup: true, groupId, activeCount, belowSince };
}

/** Records when a group first dipped below 3 (event group_below_min) and when it recovered (group_restored). */
async function trackGroupHealth(userId: string, groupId: string, activeCount: number): Promise<Date | null> {
  const { data } = await supabaseAdmin
    .from('billing_events').select('type, created_at').eq('user_id', userId).in('type', ['group_below_min', 'group_restored'])
    .contains('data', { group_id: groupId }).order('created_at', { ascending: false }).limit(1);
  const last = (data ?? [])[0] as { type: string; created_at: string } | undefined;
  if (activeCount >= 3) {
    if (last?.type === 'group_below_min') await logBillingEvent(userId, 'group_restored', { group_id: groupId, active_count: activeCount });
    return null;
  }
  if (last?.type === 'group_below_min') return new Date(last.created_at);
  await logBillingEvent(userId, 'group_below_min', { group_id: groupId, active_count: activeCount });
  return new Date();
}

export type ChargePlan =
  | { action: 'extend'; nextChargeAt: Date }
  | { action: 'charge'; priceType: PriceType; tier: Tier; cycle: Cycle; planCode: string; amountKobo: number; currency: Currency };

/**
 * Decides what a due charge looks like: the scheduled plan change (if any) is applied, then the group rules from rules.ts pick
 * solo or group price. First charge (never charged before) may be extended once to day 14 for an incomplete group.
 */
export async function resolveChargePlan(sub: Subscription, now: Date, opts: { noExtension?: boolean } = {}): Promise<ChargePlan> {
  const ctx = await getGroupContext(sub.userId);
  const change = await scheduledChange(sub.userId, sub);
  const tier = change?.tier ?? sub.tier;
  const cycle = change?.cycle ?? sub.cycle;

  const firstCharge = !sub.lastChargeAt;
  let priceType: PriceType;
  if (firstCharge) {
    const d: FirstChargeDecision = decideFirstChargePrice({
      inGroup: ctx.inGroup, activeCount: ctx.activeCount, extensionUsed: sub.extensionUsed || !!opts.noExtension, trialStart: sub.startedAt,
    });
    if (d.action === 'extend') return { action: 'extend', nextChargeAt: d.nextChargeAt };
    priceType = d.priceType;
  } else {
    priceType = resolveRenewalPriceType({
      inGroup: ctx.inGroup, activeCount: ctx.activeCount, currentPriceType: sub.priceType,
      lockedGroupPriceUntil: sub.lockedGroupPriceUntil, belowSince: ctx.belowSince, now,
    });
  }
  // USD has no group discount: a USD member in a group is charged (and recorded as) the solo price.
  if (!groupDiscountApplies(sub.currency)) priceType = 'solo';
  const planCode = planCodeFor(tier, priceType, cycle);
  return { action: 'charge', priceType, tier, cycle, planCode, amountKobo: priceFor(tier, priceType, cycle, sub.currency), currency: sub.currency };
}

export async function getCreditLedger(userId: string, currency: Currency = 'NGN'): Promise<LedgerRow[]> {
  const { data, error } = await supabaseAdmin
    .from('credit_ledger').select('id, amount_kobo, reason, created_at, expires_at').eq('user_id', userId).eq('currency', currency)
    .order('created_at', { ascending: true });
  if (error) { console.error('[billing/subscriptions] ledger read failed:', error.message); return []; }
  return ((data ?? []) as { id: string; amount_kobo: number; reason: LedgerRow['reason']; created_at: string; expires_at: string | null }[]).map((r) => ({
    id: r.id, amountKobo: r.amount_kobo, reason: r.reason, createdAt: new Date(r.created_at), expiresAt: r.expires_at ? new Date(r.expires_at) : null,
  }));
}

export async function creditBalanceKobo(userId: string, now = new Date(), currency: Currency = 'NGN'): Promise<number> {
  return availableCreditKobo(await getCreditLedger(userId, currency), now);
}

export { computeCreditLots };

// ── Scheduled plan changes (no extra columns: stored as billing_events) ──────

/** The latest change scheduled AFTER the last charge, or null. A newer charge supersedes (applies) it. */
export async function scheduledChange(userId: string, sub: Subscription): Promise<{ tier: Tier; cycle: Cycle } | null> {
  const since = (sub.lastChargeAt ?? sub.startedAt).toISOString();
  const { data } = await supabaseAdmin
    .from('billing_events').select('data').eq('user_id', userId).eq('type', 'plan_change_scheduled').gt('created_at', since)
    .order('created_at', { ascending: false }).limit(1);
  const d = ((data ?? [])[0] as { data: { tier?: Tier | null; cycle?: Cycle | null } } | undefined)?.data;
  if (!d || (!d.tier && !d.cycle)) return null;
  return { tier: d.tier ?? sub.tier, cycle: d.cycle ?? sub.cycle };
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

/** The default card's id, only when it was saved in `currency` (a card is never charged in another currency). */
async function defaultCardId(userId: string, currency?: Currency): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('payment_methods').select('id, currency').eq('user_id', userId).eq('is_default', true).is('removed_at', null).maybeSingle();
  const row = data as { id: string; currency: string | null } | null;
  if (!row) return null;
  if (currency && (row.currency ?? 'NGN') !== currency) return null;
  return row.id;
}

const currencyName = (c: Currency) => (c === 'USD' ? 'US dollars' : 'naira');

export async function startTrial(userId: string, input: { tier: Tier; cycle: Cycle; currency?: Currency }, now = new Date()): Promise<Result<{ subscription: Subscription }>> {
  if (!isPaidTier(input.tier)) return { ok: false, error: 'Choose Seeker, Builder or Pinnacle.' };
  if (input.cycle !== 'monthly' && input.cycle !== 'yearly') return { ok: false, error: 'Choose monthly or yearly.' };
  const currency: Currency = input.currency ?? 'NGN';
  const card = await defaultCardId(userId, currency);
  if (!card) {
    return { ok: false, error: (await defaultCardId(userId))
      ? `Plans where you are are billed in ${currencyName(currency)}. Add a card in ${currencyName(currency)} to start your trial.`
      : 'Add a card to start your trial.' };
  }

  const existing = await getSubscription(userId);
  if (existing) {
    if (isActiveState(existing.state)) return { ok: false, error: 'You already have a subscription.' };
    return { ok: false, error: 'Your trial has already been used. Reactivate to subscribe again.' };
  }

  const end = trialEnd(now);
  const plan = getPlan(planCodeFor(input.tier, 'solo', input.cycle))!;
  const { data, error } = await supabaseAdmin.from('member_subscriptions').insert({
    user_id: userId, plan_code: plan.code, tier: input.tier, price_type: 'solo', cycle: input.cycle, currency, state: 'trial',
    trial_ends_at: end.toISOString(), next_charge_at: firstChargeAt(now).toISOString(), period_end: end.toISOString(),
    payment_method_id: card, started_at: now.toISOString(),
  }).select('*').single();
  if (error || !data) {
    if (error?.code === '23505') return { ok: false, error: 'You already have a subscription.' };
    console.error('[billing/subscriptions] startTrial failed:', error?.message);
    return { ok: false, error: 'We could not start your trial. Please try again.' };
  }
  const sub = toSubscription(data as Row);
  await logBillingEvent(userId, 'trial_started', { plan_code: plan.code, currency, trial_ends_at: end.toISOString() });
  await syncProfile(userId);
  const { data: c } = await supabaseAdmin.from('payment_methods').select('brand, last4').eq('id', card).maybeSingle();
  await notifyTrialStarted(userId, {
    brand: (c as { brand?: string } | null)?.brand, last4: (c as { last4?: string } | null)?.last4,
    planName: formatPlanName(input.tier, input.cycle), amountKobo: planAmount(plan, currency), currency, trialEndsAt: end,
  });
  return { ok: true, subscription: sub };
}

export async function cancel(userId: string, now = new Date()): Promise<Result<{ state: SubState; accessUntil: Date | null }>> {
  const sub = await getSubscription(userId);
  if (!sub) return { ok: false, error: 'You do not have a subscription.' };
  const stamp = now.toISOString();

  if (sub.state === 'trial') {
    // Never charged: cancelled at once. Full access ends now (the trial was free, nothing was paid for).
    const { error } = await supabaseAdmin.from('member_subscriptions')
      .update({ state: 'cancelled', next_charge_at: null, cancel_at_period_end: false, period_end: stamp, updated_at: stamp })
      .eq('user_id', userId).eq('state', 'trial');
    if (error) return { ok: false, error: 'We could not cancel. Please try again.' };
    await logBillingEvent(userId, 'subscription_cancelled', { during: 'trial' });
    await syncProfile(userId);
    return { ok: true, state: 'cancelled', accessUntil: now };
  }
  if (sub.state === 'active') {
    const { error } = await supabaseAdmin.from('member_subscriptions')
      .update({ cancel_at_period_end: true, updated_at: stamp }).eq('user_id', userId).eq('state', 'active');
    if (error) return { ok: false, error: 'We could not cancel. Please try again.' };
    await logBillingEvent(userId, 'subscription_cancelled', { during: 'active', access_until: sub.periodEnd?.toISOString() ?? null });
    await syncProfile(userId);
    return { ok: true, state: 'active', accessUntil: sub.periodEnd };
  }
  if (sub.state === 'grace') {
    // Owes nothing more: stop retrying, keep the access that grace already promised until it ends.
    const { error } = await supabaseAdmin.from('member_subscriptions')
      .update({ state: 'cancelled', next_charge_at: null, period_end: sub.graceEndsAt?.toISOString() ?? stamp, updated_at: stamp })
      .eq('user_id', userId).eq('state', 'grace');
    if (error) return { ok: false, error: 'We could not cancel. Please try again.' };
    await logBillingEvent(userId, 'subscription_cancelled', { during: 'grace' });
    await syncProfile(userId);
    return { ok: true, state: 'cancelled', accessUntil: sub.graceEndsAt };
  }
  return { ok: true, state: sub.state, accessUntil: sub.periodEnd }; // already cancelled or lapsed: nothing to do
}

export async function resume(userId: string, now = new Date()): Promise<Result<{ state: SubState }>> {
  const sub = await getSubscription(userId);
  if (!sub) return { ok: false, error: 'You do not have a subscription.' };
  const stamp = now.toISOString();

  if (sub.state === 'active' && sub.cancelAtPeriodEnd) {
    await supabaseAdmin.from('member_subscriptions').update({ cancel_at_period_end: false, updated_at: stamp }).eq('user_id', userId);
    await logBillingEvent(userId, 'subscription_resumed', {});
    await syncProfile(userId);
    return { ok: true, state: 'active' };
  }
  if (sub.state === 'cancelled') {
    if (!(await defaultCardId(userId, sub.currency))) return { ok: false, error: `Add a card in ${currencyName(sub.currency)} first.` };
    if (!sub.lastChargeAt && sub.trialEndsAt && sub.trialEndsAt.getTime() > now.getTime()) {
      await supabaseAdmin.from('member_subscriptions').update({
        state: 'trial', next_charge_at: sub.trialEndsAt.toISOString(), period_end: sub.trialEndsAt.toISOString(), updated_at: stamp,
      }).eq('user_id', userId).eq('state', 'cancelled');
    } else if (sub.lastChargeAt && sub.periodEnd && sub.periodEnd.getTime() > now.getTime()) {
      await supabaseAdmin.from('member_subscriptions').update({
        state: 'active', cancel_at_period_end: false, next_charge_at: sub.periodEnd.toISOString(), updated_at: stamp,
      }).eq('user_id', userId).eq('state', 'cancelled');
    } else {
      return { ok: false, error: 'Your plan has ended. Reactivate to subscribe again.' };
    }
    await logBillingEvent(userId, 'subscription_resumed', {});
    await syncProfile(userId);
    const s = await getSubscription(userId);
    return { ok: true, state: s?.state ?? 'active' };
  }
  return { ok: false, error: 'There is nothing to resume.' };
}

export async function changePlan(userId: string, change: { tier?: Tier; cycle?: Cycle; priceType?: PriceType }, now = new Date()): Promise<Result<{ effective: 'now' | 'next_billing_date'; effectiveAt: Date | null }>> {
  const sub = await getSubscription(userId);
  if (!sub) return { ok: false, error: 'You do not have a subscription.' };
  if (!isActiveState(sub.state)) return { ok: false, error: 'Reactivate your subscription first.' };
  const tier = change.tier ?? sub.tier;
  const cycle = change.cycle ?? sub.cycle;
  if (!isPaidTier(tier) || (cycle !== 'monthly' && cycle !== 'yearly')) return { ok: false, error: 'That plan does not exist.' };

  if (sub.state === 'trial') {
    // Nothing has been paid yet, so the choice applies straight away.
    await supabaseAdmin.from('member_subscriptions').update({
      tier, cycle, plan_code: planCodeFor(tier, 'solo', cycle), updated_at: now.toISOString(),
    }).eq('user_id', userId);
    await logBillingEvent(userId, 'plan_change_scheduled', { tier, cycle, applied: 'now', during: 'trial' });
    await syncProfile(userId);
    return { ok: true, effective: 'now', effectiveAt: now };
  }
  // Paid: the plan they paid for stays until the next billing date. The engine reads this at charge time.
  await logBillingEvent(userId, 'plan_change_scheduled', { tier, cycle, price_type: change.priceType ?? null, effective_at: sub.nextChargeAt?.toISOString() ?? null });
  return { ok: true, effective: 'next_billing_date', effectiveAt: sub.nextChargeAt };
}

/** A lapsed (or fully ended) member pays again: charges the default card now. Access returns the moment the charge clears. */
export async function reactivate(userId: string): Promise<Result<{ charged: boolean; error2?: string }>> {
  const sub = await getSubscription(userId);
  if (!sub) return { ok: false, error: 'You do not have a subscription. Start a trial instead.' };
  if (isActiveState(sub.state) && !sub.cancelAtPeriodEnd) return { ok: false, error: 'Your subscription is already active.' };
  if (!(await defaultCardId(userId, sub.currency))) return { ok: false, error: `Add a card in ${currencyName(sub.currency)} first.` };
  const { chargeSubscriptionNow } = await import('./engine');
  const r = await chargeSubscriptionNow(userId, { reactivation: true });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, charged: r.charged };
}

// ── Profile mirror ───────────────────────────────────────────────────────────

export async function syncProfile(userId: string, now = new Date()): Promise<void> {
  try {
    const sub = await getSubscription(userId);
    if (!sub) return;
    const { data: prof } = await supabaseAdmin.from('profiles').select('leader_free, subscription_plan').eq('id', userId).maybeSingle();
    const p = prof as { leader_free?: boolean; subscription_plan?: string } | null;
    if (!p || p.leader_free || p.subscription_plan === 'leader') return;

    let status: string;
    let end: Date | null;
    switch (sub.state) {
      case 'trial': status = 'trialing'; end = sub.trialEndsAt; break;
      case 'active': status = sub.cancelAtPeriodEnd ? 'cancelled' : 'active'; end = sub.periodEnd; break;
      case 'grace': status = 'active'; end = sub.graceEndsAt; break;
      case 'lapsed': status = 'free'; end = sub.periodEnd; break;
      default: status = 'cancelled'; end = sub.periodEnd ?? now; break;
    }
    const patch: Record<string, unknown> = {
      subscription_plan: sub.tier, subscription_status: status, subscription_end: end ? end.toISOString() : null,
      subscription_start: sub.startedAt.toISOString(), updated_at: now.toISOString(),
    };
    let { error } = await supabaseAdmin.from('profiles').update({ ...patch, billing_cycle: sub.cycle === 'yearly' ? 'annual' : 'monthly' }).eq('id', userId);
    if (error && /billing_cycle/i.test(error.message)) ({ error } = await supabaseAdmin.from('profiles').update(patch).eq('id', userId));
    if (error) console.error('[billing/subscriptions] profile sync failed:', error.message);
  } catch (e) {
    console.error('[billing/subscriptions] profile sync threw:', e instanceof Error ? e.message : 'unknown');
  }
}

export { addDays };
