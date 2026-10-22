// lib/billing/engine.ts
// ─────────────────────────────────────────────────────────────────────────────
// The renewal engine. Server-only. Runs hourly from /api/cron/billing and ONLY touches
// rows in member_subscriptions (legacy members are never read, charged or changed).
//
// BILLING_V2_CHARGING (read at call time, never from a client):
//   off  (default)  return immediately, nothing is read or written
//   dry             compute what would be charged and write billing_events 'would_charge'; NO Paystack call,
//                   no state change, no member emails
//   live            charge the default card (chargeAuthorization, idempotent reference sub_<userId>_<yyyymmddHH>), settle,
//                   retry, grace, lapse, reminders, referral credit
//
// Exports
//   chargingMode()                               -> 'off' | 'dry' | 'live'
//   runBillingCycle(now?)                        -> summary (the cron entry point)
//   chargeSubscriptionNow(userId, {reactivation}) -> member-initiated charge (live mode only)
//   settleSubscriptionChargeReference(reference)  -> webhook: verify + settle (or fail) one subscription_charge, idempotent
//   recordChargeFailure(userId, reference, reason) -> the single failure path (engine and webhook share it)
//   cancelCreditForPayment(reference)            -> a refunded / charged-back payment cancels the credit it earned
//
// Failure schedule (rules.ts): first failure starts a 7 day grace that KEEPS full access; retries +1, +3, +5 days after the
// first failure; at the end of grace the member lapses and (live only) the Circle seat is released (lib/billing/seats.ts);
// a reactivation re-seats them if the seat is still free, else they wait for a Circle.
//
// Also in each cycle (dry logs would_* events, live acts): free Leaders whose 90 day cycle with no Circle ended move to the
// Builder price (runLeaderCycles), admins are alerted when a group falls to exactly 3 (runGroupAlerts), and members of a group
// below 3 are warned 7 days before the renewal (sendReminders).
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { chargeAuthorization, verifyTransaction, type PaystackTx } from './paystack';
import { getChargeableCard } from './cards';
import { logBillingEvent } from './events';
import {
  getSubscription, toSubscription, resolveChargePlan, getCreditLedger, getGroupContext, syncProfile,
  type Subscription,
} from './subscriptions';
import {
  addDays, nextPeriodEnd, chargeReference, graceEndsAt, graceExpired, nextRetryAfterFailure, computeCreditLots, applyCredit,
  expiredLots, creditPerReferralKobo, addMonths, CREDIT_VALID_MONTHS, CREDIT_HOLD_DAYS, groupWarningDue, GRACE_DAYS,
  leaderCycleEnded, LEADER_CYCLE_DAYS, groupAlertDue, GROUP_MIN, GROUP_REPLACE_DAYS, countActiveMembers, type SubState,
} from './rules';
import { releaseSeats, restoreSeats, seatsToRelease } from './seats';
import { priceFor, getPlan, type Tier, type Cycle, type PriceType } from './catalog';
import { formatPlanName } from './labels';
import {
  notifyPaymentSucceeded, notifyPaymentFailed, notifyLapsed, notifyReactivated, notifyTrialEnding, notifyGroupWarning, notifyCreditEarned,
  notifyLeaderCycleEnded, notifyAdminsGroupAtMinimum,
} from './notify';

export type ChargingMode = 'off' | 'dry' | 'live';

export function chargingMode(): ChargingMode {
  const v = (process.env.BILLING_V2_CHARGING ?? 'off').trim().toLowerCase();
  return v === 'dry' || v === 'live' ? v : 'off';
}

const BATCH = 200;

export interface CycleSummary {
  mode: ChargingMode;
  due: number;
  charged: number;
  wouldCharge: number;
  skippedForCredit: number;
  extended: number;
  failed: number;
  lapsed: number;
  cancelledAtPeriodEnd: number;
  reminders: number;
  groupWarnings: number;
  leaderCycles: number;
  groupAlerts: number;
  creditEarned: number;
  creditExpired: number;
  errors: number;
}

const emptySummary = (mode: ChargingMode): CycleSummary => ({
  mode, due: 0, charged: 0, wouldCharge: 0, skippedForCredit: 0, extended: 0, failed: 0, lapsed: 0, cancelledAtPeriodEnd: 0,
  reminders: 0, groupWarnings: 0, leaderCycles: 0, groupAlerts: 0, creditEarned: 0, creditExpired: 0, errors: 0,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function emailOf(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

async function eventExists(userId: string, type: string, contains: Record<string, unknown>): Promise<boolean> {
  const { data } = await supabaseAdmin.from('billing_events').select('id').eq('user_id', userId).eq('type', type).contains('data', contains).limit(1);
  return !!(data && data.length);
}

interface Intent {
  sub: Subscription;
  tier: Tier;
  cycle: Cycle;
  priceType: PriceType;
  planCode: string;
  grossKobo: number;
  creditKobo: number;
  chargeKobo: number;
  skipCharge: boolean;
  kind: 'first_charge' | 'renewal' | 'reactivation';
}

async function buildIntent(sub: Subscription, now: Date, reactivation = false): Promise<Intent | { extend: Date }> {
  const plan = await resolveChargePlan(sub, now, { noExtension: reactivation });
  if (plan.action === 'extend') return { extend: plan.nextChargeAt };
  const lots = computeCreditLots(await getCreditLedger(sub.userId), now);
  const app = applyCredit(plan.amountKobo, lots);
  return {
    sub, tier: plan.tier, cycle: plan.cycle, priceType: plan.priceType, planCode: plan.planCode,
    grossKobo: plan.amountKobo, creditKobo: app.appliedKobo, chargeKobo: app.chargeKobo, skipCharge: app.skipCharge,
    kind: reactivation ? 'reactivation' : !sub.lastChargeAt ? 'first_charge' : 'renewal',
  };
}

// ── Settlement ───────────────────────────────────────────────────────────────

/**
 * Marks one charge as paid. Idempotent: a conditional update on last_charge_ref claims the reference, so the engine, the
 * webhook and a repeated cron run settle it exactly once. `tx` is null for a credit-only cycle (nothing was charged).
 */
async function settleSuccess(i: Intent, reference: string, tx: PaystackTx | null, now: Date): Promise<boolean> {
  const sub = i.sub;
  const wasLapsedOrEnded = sub.state === 'lapsed' || sub.state === 'cancelled';
  const base = sub.state === 'active' && sub.nextChargeAt && sub.nextChargeAt.getTime() <= now.getTime() ? sub.nextChargeAt : now;
  const periodEnd = nextPeriodEnd(base, i.cycle);
  const lock = i.priceType === 'group' && i.cycle === 'yearly' ? periodEnd.toISOString() : null;

  const { data: claimed, error } = await supabaseAdmin.from('member_subscriptions').update({
    state: 'active', tier: i.tier, cycle: i.cycle, price_type: i.priceType, plan_code: i.planCode,
    failed_count: 0, last_failed_at: null, grace_ends_at: null, cancel_at_period_end: false,
    last_charge_at: now.toISOString(), last_charge_ref: reference,
    period_end: periodEnd.toISOString(), next_charge_at: periodEnd.toISOString(), locked_group_price_until: lock,
    updated_at: now.toISOString(),
  }).eq('user_id', sub.userId).or(`last_charge_ref.is.null,last_charge_ref.neq.${reference}`).select('user_id');
  if (error) throw new Error(`subscription settle failed: ${error.message}`);
  if (!claimed || claimed.length === 0) return false; // somebody else already settled this reference

  if (tx) {
    const { error: payErr } = await supabaseAdmin.from('payments').insert({
      user_id: sub.userId, reference, provider_reference: reference, amount_cents: tx.amount, amount: tx.amount / 100,
      currency: tx.currency || 'NGN', plan_id: i.tier, billing: i.cycle === 'yearly' ? 'annual' : 'monthly',
      provider: 'paystack', status: 'success', paid_at: tx.paid_at || now.toISOString(),
      metadata: { purpose: 'subscription_charge', plan_code: i.planCode, price_type: i.priceType, credit_applied_kobo: i.creditKobo, gross_kobo: i.grossKobo, kind: i.kind },
    });
    if (payErr && payErr.code !== '23505') console.error('[billing/engine] payments insert failed:', payErr.message);
  }

  if (i.creditKobo > 0) {
    const lots = computeCreditLots(await getCreditLedger(sub.userId), now);
    const app = applyCredit(i.creditKobo, lots);
    if (app.draws.length) {
      await supabaseAdmin.from('credit_ledger').insert(app.draws.map((d) => ({
        user_id: sub.userId, amount_kobo: -d.kobo, reason: 'used', source_payment_ref: reference,
      })));
    }
    await logBillingEvent(sub.userId, 'credit_used', { reference, credit_kobo: app.appliedKobo });
  }

  const eventType = wasLapsedOrEnded ? 'reactivated' : i.kind === 'first_charge' ? 'first_charge' : 'renewal_succeeded';
  await logBillingEvent(sub.userId, eventType, {
    reference, plan_code: i.planCode, price_type: i.priceType, gross_kobo: i.grossKobo, credit_kobo: i.creditKobo, charged_kobo: i.chargeKobo,
  });
  if (i.priceType !== sub.priceType) await logBillingEvent(sub.userId, i.priceType === 'group' ? 'group_price_applied' : 'group_price_removed', { plan_code: i.planCode });
  if (i.skipCharge) await logBillingEvent(sub.userId, 'charge_skipped_credit', { reference, credit_kobo: i.creditKobo, plan_code: i.planCode });

  await syncProfile(sub.userId, now);

  const card = tx?.authorization ?? null;
  const common = {
    brand: card?.brand ?? card?.card_type ?? null, last4: card?.last4 ?? null,
    planName: formatPlanName(i.tier, i.cycle), amountKobo: i.chargeKobo, nextChargeAt: periodEnd,
  };
  if (wasLapsedOrEnded) await notifyReactivated(sub.userId, common);
  else await notifyPaymentSucceeded(sub.userId, common);
  if (wasLapsedOrEnded) {
    // Access and quorum count return at once (state is 'active' above). Give the Circle seat back if it is still free, else the
    // member waits for a Circle. A no-op for anyone whose seat was never released.
    try { await restoreSeats(sub.userId); } catch (e) { console.error('[billing/engine] seat restore failed:', e instanceof Error ? e.message : 'unknown'); }
  }
  return true;
}

/** The single failure path. Idempotent per reference (engine and webhook may both report the same failure). */
export async function recordChargeFailure(userId: string, reference: string, reason: string | null, now = new Date()): Promise<{ counted: boolean }> {
  if (await eventExists(userId, 'renewal_failed', { reference })) return { counted: false };
  const sub = await getSubscription(userId);
  if (!sub || !['trial', 'active', 'grace'].includes(sub.state)) return { counted: false };
  if (sub.lastChargeRef === reference) return { counted: false }; // that reference already succeeded

  const first = sub.state !== 'grace' || !sub.graceEndsAt;
  const graceEnd = first ? graceEndsAt(now) : (sub.graceEndsAt as Date);
  const firstFailureAt = addDays(graceEnd, -GRACE_DAYS);
  const failedCount = sub.failedCount + 1;
  const next = nextRetryAfterFailure(firstFailureAt, failedCount);

  const { error } = await supabaseAdmin.from('member_subscriptions').update({
    state: 'grace', failed_count: failedCount, last_failed_at: now.toISOString(), grace_ends_at: graceEnd.toISOString(),
    next_charge_at: next.at.toISOString(), updated_at: now.toISOString(),
  }).eq('user_id', userId).in('state', ['trial', 'active', 'grace']);
  if (error) throw new Error(`failure update failed: ${error.message}`);

  await logBillingEvent(userId, 'renewal_failed', { reference, reason, failed_count: failedCount, next_attempt_at: next.at.toISOString(), final: next.final });
  if (first) await logBillingEvent(userId, 'grace_started', { grace_ends_at: graceEnd.toISOString() });
  if (!next.final) await logBillingEvent(userId, 'charge_retry', { scheduled_for: next.at.toISOString(), attempt: failedCount + 1 });
  await syncProfile(userId, now);

  const card = await getChargeableCard(userId);
  // One message per failure. The first one already names the grace end, so grace_started does not send a second email.
  await notifyPaymentFailed(userId, {
    brand: card?.brand, last4: card?.last4, reason, graceEndsAt: graceEnd, amountKobo: undefined,
    planName: formatPlanName(sub.tier, sub.cycle),
  });
  return { counted: true };
}

async function lapse(sub: Subscription, now: Date): Promise<void> {
  const { data, error } = await supabaseAdmin.from('member_subscriptions').update({
    state: 'lapsed', next_charge_at: null, updated_at: now.toISOString(),
  }).eq('user_id', sub.userId).eq('state', 'grace').select('user_id');
  if (error) throw new Error(`lapse failed: ${error.message}`);
  if (!data || !data.length) return;
  await logBillingEvent(sub.userId, 'lapsed', { failed_count: sub.failedCount });
  // The handoff (Proposed) releases the member's Circle seat when grace ends and keeps their record. Live only: lapse() is
  // never reached in dry mode, and the explicit check keeps it that way. If the release fails, the pending event is the work queue.
  if (chargingMode() === 'live') {
    try { await releaseSeats(sub.userId); } catch (e) {
      console.error('[billing/engine] seat release failed:', e instanceof Error ? e.message : 'unknown');
      await logBillingEvent(sub.userId, 'seat_release_pending', { reason: 'grace_ended', error: 'release_failed' });
    }
  }
  await syncProfile(sub.userId, now);
  await notifyLapsed(sub.userId, {});
}

// ── Charging one subscription ────────────────────────────────────────────────

type Outcome = 'charged' | 'would_charge' | 'skipped_credit' | 'extended' | 'failed' | 'lapsed' | 'cancelled' | 'pending' | 'noop';

/** Charges the default card (live) or logs what would happen (dry). */
async function processSubscription(sub: Subscription, mode: 'dry' | 'live', now: Date, opts: { reactivation?: boolean } = {}): Promise<Outcome> {
  const dueAt = sub.nextChargeAt?.toISOString() ?? now.toISOString();

  if (sub.state === 'grace' && graceExpired(sub.graceEndsAt, now)) {
    if (mode === 'dry') {
      // Nothing changes in dry mode: only say what the lapse would do to the Circle seat.
      const graceIso = sub.graceEndsAt?.toISOString() ?? null;
      if (!(await eventExists(sub.userId, 'would_release_seat', { grace_ends_at: graceIso }))) {
        const seats = await seatsToRelease(sub.userId);
        await logBillingEvent(sub.userId, 'would_release_seat', { grace_ends_at: graceIso, circle_ids: seats.map((x) => x.circle_id) });
      }
      return 'noop';
    }
    await lapse(sub, now);
    return 'lapsed';
  }
  if (sub.state === 'active' && sub.cancelAtPeriodEnd && !opts.reactivation) {
    if (mode === 'dry') return 'noop';
    await supabaseAdmin.from('member_subscriptions').update({ state: 'cancelled', next_charge_at: null, updated_at: now.toISOString() }).eq('user_id', sub.userId).eq('state', 'active');
    await logBillingEvent(sub.userId, 'subscription_cancelled', { during: 'period_end' });
    await syncProfile(sub.userId, now);
    return 'cancelled';
  }

  const built = await buildIntent(sub, now, !!opts.reactivation);
  if ('extend' in built) {
    if (mode === 'dry') {
      if (!(await eventExists(sub.userId, 'would_charge', { due_at: dueAt }))) await logBillingEvent(sub.userId, 'would_charge', { due_at: dueAt, extend_to: built.extend.toISOString(), reason: 'group_incomplete_extension' });
      return 'extended';
    }
    await supabaseAdmin.from('member_subscriptions').update({
      next_charge_at: built.extend.toISOString(), extension_used: true, updated_at: now.toISOString(),
    }).eq('user_id', sub.userId).eq('state', sub.state);
    await logBillingEvent(sub.userId, 'first_charge_extended', { next_charge_at: built.extend.toISOString() });
    return 'extended';
  }
  const intent = built;

  if (mode === 'dry') {
    if (!(await eventExists(sub.userId, 'would_charge', { due_at: dueAt }))) {
      await logBillingEvent(sub.userId, 'would_charge', {
        due_at: dueAt, plan_code: intent.planCode, price_type: intent.priceType, gross_kobo: intent.grossKobo,
        credit_kobo: intent.creditKobo, amount_kobo: intent.chargeKobo, skip_for_credit: intent.skipCharge, kind: intent.kind,
      });
    }
    return 'would_charge';
  }

  // live ---------------------------------------------------------------------
  const reference = chargeReference(sub.userId, now);

  // A charge from an earlier run that Paystack had not finished yet: settle that one first, never start a second.
  const pending = await pendingReference(sub.userId, now);
  if (pending) {
    const settled = await settleSubscriptionChargeReference(pending.reference, now);
    if (settled === 'pending') return 'pending';
    if (settled === 'settled') return 'charged';
    // failed: recordChargeFailure already ran, which moved next_charge_at; stop here for this run
    return 'failed';
  }

  if (intent.skipCharge) {
    await settleSuccess(intent, `credit_${sub.userId}_${dueAt.slice(0, 10).replace(/-/g, '')}`, null, now);
    return 'skipped_credit';
  }

  const card = await getChargeableCard(sub.userId);
  const email = await emailOf(sub.userId);
  if (!card || !email) {
    await recordChargeFailure(sub.userId, reference, 'No usable card on file', now);
    return 'failed';
  }

  const r = await chargeAuthorization({
    email, amountKobo: intent.chargeKobo, authorizationCode: card.authorizationCode, reference,
    metadata: {
      user_id: sub.userId, plan_code: intent.planCode, tier: intent.tier, cycle: intent.cycle, price_type: intent.priceType,
      credit_kobo: intent.creditKobo, gross_kobo: intent.grossKobo, kind: intent.kind,
    },
  });
  if (!r.ok) {
    if (r.transient) {
      // Paystack unreachable: do not count it against the member. Try again on the next hourly run (same hour = same reference).
      console.error('[billing/engine] transient charge error for', sub.userId.slice(0, 8), r.error);
      return 'pending';
    }
    await recordChargeFailure(sub.userId, reference, r.error, now);
    return 'failed';
  }
  const tx = r.data;
  if (tx.status === 'success') {
    await settleSuccess(intent, reference, tx, now);
    return 'charged';
  }
  if (tx.status === 'failed' || tx.status === 'abandoned' || tx.status === 'reversed') {
    await recordChargeFailure(sub.userId, reference, tx.gateway_response ?? tx.message ?? tx.status, now);
    return 'failed';
  }
  // ongoing / pending / processing: Paystack is still working. Remember the reference; the webhook or the next run settles it.
  await logBillingEvent(sub.userId, 'charge_retry', { reference, pending: true, status: tx.status });
  return 'pending';
}

async function pendingReference(userId: string, now: Date): Promise<{ reference: string } | null> {
  const since = addDays(now, -2).toISOString();
  const { data } = await supabaseAdmin.from('billing_events').select('data, created_at').eq('user_id', userId).eq('type', 'charge_retry')
    .contains('data', { pending: true }).gt('created_at', since).order('created_at', { ascending: false }).limit(1);
  const row = (data ?? [])[0] as { data: { reference?: string }; created_at: string } | undefined;
  if (!row?.data.reference) return null;
  if (await eventExists(userId, 'renewal_failed', { reference: row.data.reference })) return null;
  const sub = await getSubscription(userId);
  if (sub?.lastChargeRef === row.data.reference) return null;
  return { reference: row.data.reference };
}

/**
 * Webhook / recheck entry. Verifies the reference with Paystack (the body of a webhook is never trusted for money), then
 * settles a success or records a failure. Safe to call any number of times.
 */
export async function settleSubscriptionChargeReference(reference: string, now = new Date()): Promise<'settled' | 'failed' | 'pending' | 'ignored'> {
  const v = await verifyTransaction(reference);
  if (!v.ok) return v.transient ? 'pending' : 'ignored';
  const tx = v.data;
  const meta = (typeof tx.metadata === 'string' ? safeJson(tx.metadata) : tx.metadata ?? {}) as Record<string, unknown>;
  const userId = typeof meta.user_id === 'string' ? meta.user_id : null;
  if (!userId || meta.purpose !== 'subscription_charge') return 'ignored';
  const sub = await getSubscription(userId);
  if (!sub) return 'ignored';

  if (tx.status === 'success') {
    const planCode = String(meta.plan_code ?? '');
    const plan = getPlan(planCode);
    if (!plan) return 'ignored';
    const credit = Number(meta.credit_kobo ?? 0);
    const gross = Number(meta.gross_kobo ?? plan.amountKobo);
    // The amount Paystack actually took must equal what we asked for, else do not grant anything.
    if (tx.amount !== gross - credit || tx.currency !== 'NGN') {
      console.error('[billing/engine] amount mismatch on', reference, 'expected', gross - credit, 'got', tx.amount);
      return 'ignored';
    }
    const intent: Intent = {
      sub, tier: plan.tier, cycle: plan.cycle, priceType: plan.priceType, planCode: plan.code,
      grossKobo: gross, creditKobo: credit, chargeKobo: tx.amount, skipCharge: false,
      kind: meta.kind === 'reactivation' ? 'reactivation' : meta.kind === 'first_charge' ? 'first_charge' : 'renewal',
    };
    const done = await settleSuccess(intent, reference, tx, now);
    void done;
    return 'settled';
  }
  if (tx.status === 'failed' || tx.status === 'abandoned' || tx.status === 'reversed') {
    await recordChargeFailure(userId, reference, tx.gateway_response ?? tx.message ?? tx.status, now);
    return 'failed';
  }
  return 'pending';
}

function safeJson(s: string): Record<string, unknown> {
  try { return JSON.parse(s) as Record<string, unknown>; } catch { return {}; }
}

/** Member-initiated charge (reactivation). Live mode only: with charging off or dry nothing is ever charged. */
export async function chargeSubscriptionNow(userId: string, opts: { reactivation?: boolean } = {}, now = new Date()): Promise<{ ok: true; charged: boolean } | { ok: false; error: string }> {
  if (chargingMode() !== 'live') return { ok: false, error: 'Payments are not switched on yet.' };
  const sub = await getSubscription(userId);
  if (!sub) return { ok: false, error: 'No subscription.' };
  const out = await processSubscription(sub, 'live', now, opts);
  if (out === 'charged' || out === 'skipped_credit') return { ok: true, charged: true };
  if (out === 'failed') return { ok: false, error: 'The payment did not go through. Please try another card.' };
  return { ok: false, error: 'The payment is still processing. Please check again in a minute.' };
}

// ── Referral credit ──────────────────────────────────────────────────────────

async function identityOf(userId: string): Promise<{ email: string; phone: string }> {
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  return { email: (data?.user?.email ?? '').toLowerCase(), phone: (data?.user?.phone ?? '').replace(/\D/g, '') };
}

async function cardSignatures(userId: string): Promise<Set<string>> {
  const { data } = await supabaseAdmin.from('payment_methods').select('signature').eq('user_id', userId).not('signature', 'is', null);
  return new Set(((data ?? []) as { signature: string }[]).map((r) => r.signature));
}

/** Monthly price of the inviter's own plan (a yearly member uses the monthly price of the same price type). Leaders earn at Builder solo. */
async function inviterMonthlyKobo(inviterId: string): Promise<number | null> {
  const sub = await getSubscription(inviterId);
  if (sub) return priceFor(sub.tier, sub.priceType, 'monthly');
  const { data } = await supabaseAdmin.from('profiles').select('leader_free').eq('id', inviterId).maybeSingle();
  if ((data as { leader_free?: boolean } | null)?.leader_free) return priceFor('builder', 'solo', 'monthly');
  return null;
}

async function earnReferralCredit(now: Date): Promise<number> {
  const cutoff = addDays(now, -CREDIT_HOLD_DAYS).toISOString();
  const { data: firsts } = await supabaseAdmin.from('billing_events').select('user_id, data, created_at').eq('type', 'first_charge').lte('created_at', cutoff).limit(BATCH);
  let earned = 0;
  for (const ev of (firsts ?? []) as { user_id: string; data: { reference?: string; charged_kobo?: number }; created_at: string }[]) {
    try {
      const referredId = ev.user_id;
      const { data: refRow } = await supabaseAdmin.from('referrals').select('id, referrer_id, referred_id, flagged_at, credit_earned_at').eq('referred_id', referredId).maybeSingle();
      const ref = refRow as { id: string; referrer_id: string; referred_id: string; flagged_at: string | null; credit_earned_at: string | null } | null;
      if (!ref || ref.credit_earned_at || ref.flagged_at || ref.referrer_id === ref.referred_id) continue;
      const reference = ev.data.reference ?? '';
      // Only a payment that really cleared and is still standing earns credit. A free (credit-only) first cycle does not.
      const { data: pay } = await supabaseAdmin.from('payments').select('status, amount_cents').eq('reference', reference).maybeSingle();
      const p = pay as { status: string; amount_cents: number } | null;
      if (!p || p.status !== 'success' || !(p.amount_cents > 0)) continue;

      const [a, b, sa, sb] = await Promise.all([identityOf(ref.referrer_id), identityOf(ref.referred_id), cardSignatures(ref.referrer_id), cardSignatures(ref.referred_id)]);
      const sameIdentity = (a.email && a.email === b.email) || (a.phone && a.phone === b.phone) || [...sb].some((s) => sa.has(s));
      if (sameIdentity) {
        await supabaseAdmin.from('referrals').update({ flagged_at: now.toISOString() }).eq('id', ref.id).is('flagged_at', null);
        continue;
      }
      const monthly = await inviterMonthlyKobo(ref.referrer_id);
      if (monthly == null) continue; // inviter has no plan yet: leave it, it is earned once they do

      const { data: claimed } = await supabaseAdmin.from('referrals').update({ credit_earned_at: now.toISOString() }).eq('id', ref.id).is('credit_earned_at', null).select('id');
      if (!claimed || !claimed.length) continue;
      const amount = creditPerReferralKobo(monthly);
      await supabaseAdmin.from('credit_ledger').insert({
        user_id: ref.referrer_id, amount_kobo: amount, reason: 'referral_earned', source_referral_id: ref.id, source_payment_ref: reference,
        expires_at: addMonths(now, CREDIT_VALID_MONTHS).toISOString(),
      });
      await logBillingEvent(ref.referrer_id, 'credit_earned', { referral_id: ref.id, amount_kobo: amount, source_payment_ref: reference });
      const balance = computeCreditLots(await getCreditLedger(ref.referrer_id), now).reduce((s, l) => s + l.remainingKobo, 0);
      await notifyCreditEarned(ref.referrer_id, { creditKobo: amount, balanceKobo: balance });
      earned++;
    } catch (e) {
      console.error('[billing/engine] credit earn failed:', e instanceof Error ? e.message : 'unknown');
    }
  }
  return earned;
}

/** Writes the 'expired' audit rows for lots whose 12 months ran out. */
async function expireCredit(now: Date): Promise<number> {
  const { data } = await supabaseAdmin.from('credit_ledger').select('user_id').eq('reason', 'referral_earned').lte('expires_at', now.toISOString()).limit(BATCH);
  const users = [...new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id))];
  let n = 0;
  for (const userId of users) {
    const rows = await getCreditLedger(userId);
    for (const lot of expiredLots(rows, now)) {
      const tag = `lot:${lot.id}`;
      const { data: dup } = await supabaseAdmin.from('credit_ledger').select('id').eq('user_id', userId).eq('reason', 'expired').eq('source_payment_ref', tag).limit(1);
      if (dup && dup.length) continue;
      await supabaseAdmin.from('credit_ledger').insert({ user_id: userId, amount_kobo: -lot.remainingKobo, reason: 'expired', source_payment_ref: tag });
      await logBillingEvent(userId, 'credit_expired', { lot_id: lot.id, amount_kobo: lot.remainingKobo });
      n++;
    }
  }
  return n;
}

/**
 * A refunded or charged-back payment cancels the credit it earned (the referrer's credit for that payment) and, when the credit
 * was not earned yet, blocks it for good by flagging the referral. Idempotent.
 */
export async function cancelCreditForPayment(reference: string, now = new Date()): Promise<{ cancelledKobo: number }> {
  if (!reference) return { cancelledKobo: 0 };
  let total = 0;
  const { data: earned } = await supabaseAdmin.from('credit_ledger').select('id, user_id, amount_kobo, source_referral_id')
    .eq('reason', 'referral_earned').eq('source_payment_ref', reference);
  for (const row of (earned ?? []) as { id: string; user_id: string; amount_kobo: number; source_referral_id: string | null }[]) {
    const tag = `cancel:${row.id}`;
    const { data: dup } = await supabaseAdmin.from('credit_ledger').select('id').eq('user_id', row.user_id).eq('reason', 'cancelled').eq('source_payment_ref', tag).limit(1);
    if (dup && dup.length) continue;
    await supabaseAdmin.from('credit_ledger').insert({
      user_id: row.user_id, amount_kobo: -row.amount_kobo, reason: 'cancelled', source_referral_id: row.source_referral_id, source_payment_ref: tag,
    });
    await logBillingEvent(row.user_id, 'credit_cancelled', { source_payment_ref: reference, amount_kobo: row.amount_kobo });
    total += row.amount_kobo;
  }
  const { data: pay } = await supabaseAdmin.from('payments').select('user_id').eq('reference', reference).maybeSingle();
  const payer = (pay as { user_id: string } | null)?.user_id;
  if (payer) await supabaseAdmin.from('referrals').update({ flagged_at: now.toISOString() }).eq('referred_id', payer).is('credit_earned_at', null).is('flagged_at', null);
  return { cancelledKobo: total };
}

// ── Reminders ────────────────────────────────────────────────────────────────

async function sendReminders(now: Date, mode: 'dry' | 'live'): Promise<{ reminders: number; groupWarnings: number }> {
  let reminders = 0;
  let groupWarnings = 0;
  const soon = addDays(now, 1).toISOString();
  const { data: trials } = await supabaseAdmin.from('member_subscriptions').select('*').eq('state', 'trial').gt('trial_ends_at', now.toISOString()).lte('trial_ends_at', soon).limit(BATCH);
  // Trial reminders email the member: live only.
  for (const row of (mode === 'live' ? (trials ?? []) : []) as Record<string, unknown>[]) {
    const sub = toSubscription(row);
    try {
      if (await eventExists(sub.userId, 'trial_ending_sent', { trial_ends_at: sub.trialEndsAt?.toISOString() })) continue;
      await logBillingEvent(sub.userId, 'trial_ending_sent', { trial_ends_at: sub.trialEndsAt?.toISOString() });
      const plan = await resolveChargePlan(sub, now).catch(() => null);
      const amount = plan && plan.action === 'charge' ? plan.amountKobo : priceFor(sub.tier, 'solo', sub.cycle);
      const card = await getChargeableCard(sub.userId);
      await notifyTrialEnding(sub.userId, {
        brand: card?.brand, last4: card?.last4, planName: formatPlanName(sub.tier, sub.cycle), amountKobo: amount, trialEndsAt: sub.trialEndsAt,
      });
      reminders++;
    } catch (e) { console.error('[billing/engine] reminder failed:', e instanceof Error ? e.message : 'unknown'); }
  }

  const week = addDays(now, 7).toISOString();
  const { data: groups } = await supabaseAdmin.from('member_subscriptions').select('*').eq('state', 'active').eq('price_type', 'group').gt('next_charge_at', now.toISOString()).lte('next_charge_at', week).limit(BATCH);
  for (const row of (groups ?? []) as Record<string, unknown>[]) {
    const sub = toSubscription(row);
    try {
      if (!sub.nextChargeAt) continue;
      const ctx = await getGroupContext(sub.userId);
      if (!groupWarningDue({ currentPriceType: sub.priceType, activeCount: ctx.activeCount, lockedGroupPriceUntil: sub.lockedGroupPriceUntil, belowSince: ctx.belowSince, nextChargeAt: sub.nextChargeAt, now })) continue;
      if (await eventExists(sub.userId, mode === 'dry' ? 'would_warn_group' : 'group_warning_sent', { next_charge_at: sub.nextChargeAt.toISOString() })) continue;
      if (mode === 'dry') {
        // Dry mode never messages a member: it only records that the warning is due.
        await logBillingEvent(sub.userId, 'would_warn_group', { next_charge_at: sub.nextChargeAt.toISOString(), active_count: ctx.activeCount });
        groupWarnings++;
        continue;
      }
      await logBillingEvent(sub.userId, 'group_warning_sent', { next_charge_at: sub.nextChargeAt.toISOString(), active_count: ctx.activeCount });
      await notifyGroupWarning(sub.userId, { activeCount: ctx.activeCount, renewalDate: sub.nextChargeAt, soloPriceKobo: priceFor(sub.tier, 'solo', sub.cycle) });
      groupWarnings++;
    } catch (e) { console.error('[billing/engine] group warning failed:', e instanceof Error ? e.message : 'unknown'); }
  }
  return { reminders, groupWarnings };
}

// ── Free Leaders, group alerts ───────────────────────────────────────────────

async function recentEvent(userId: string | null, type: string, days: number, now: Date, contains?: Record<string, unknown>): Promise<boolean> {
  let q = supabaseAdmin.from('billing_events').select('id').eq('type', type).gte('created_at', addDays(now, -days).toISOString());
  q = userId ? q.eq('user_id', userId) : q.is('user_id', null);
  if (contains) q = q.contains('data', contains);
  const { data } = await q.limit(1);
  return !!(data && data.length);
}

/** Facilitator state of a free Leader: are they facilitating a Circle now, and when did they last do so? */
async function leaderSnapshot(userId: string): Promise<{ facilitatingNow: boolean; lastFacilitatedAt: Date | null }> {
  const [{ data: byCircle }, { data: seats }, { data: invite }] = await Promise.all([
    supabaseAdmin.from('circles').select('id, status, cycle_start, created_at').eq('facilitator_id', userId),
    supabaseAdmin.from('circle_seats').select('circle_id').eq('user_id', userId).eq('role', 'facilitator'),
    supabaseAdmin.from('leader_invites').select('used_at').eq('used_by', userId).order('used_at', { ascending: false }).limit(1),
  ]);
  type C = { id: string; status: string; cycle_start: string | null; created_at: string };
  const circles = new Map<string, C>(((byCircle ?? []) as C[]).map((c) => [c.id, c]));
  const seatIds = ((seats ?? []) as { circle_id: string }[]).map((s) => s.circle_id).filter((id) => !circles.has(id));
  if (seatIds.length) {
    const { data: more } = await supabaseAdmin.from('circles').select('id, status, cycle_start, created_at').in('id', seatIds);
    for (const c of (more ?? []) as C[]) circles.set(c.id, c);
  }
  let facilitatingNow = false;
  let last: Date | null = null;
  const bump = (d: Date | null) => { if (d && !Number.isNaN(d.getTime()) && (!last || d.getTime() > last.getTime())) last = d; };
  for (const c of circles.values()) {
    if (c.status !== 'completed') { facilitatingNow = true; continue; }
    // A Circle runs a 90 day cycle from its start; that is when they last facilitated.
    bump(c.cycle_start ? addDays(new Date(c.cycle_start), LEADER_CYCLE_DAYS) : new Date(c.created_at));
  }
  // They have been a free Leader at least since the invite was accepted: never count a cycle from before that.
  const usedAt = ((invite ?? [])[0] as { used_at: string | null } | undefined)?.used_at;
  if (usedAt) bump(new Date(usedAt));
  return { facilitatingNow, lastFacilitatedAt: last };
}

/**
 * A free Leader who has gone a 90 day cycle with no Circle moves to the Builder price. Marks the member with a
 * 'leader_cycle_ended' event, turns leader_free off and tells them (in-app and email) that they need a card to continue on
 * Builder. NOTHING is charged and no subscription is created: a card has to be added first. Dry mode only logs
 * 'would_end_leader_cycle'. Returns how many Leaders were (or would be) moved.
 */
export async function runLeaderCycles(now: Date, mode: 'dry' | 'live'): Promise<number> {
  const { data, error } = await supabaseAdmin.from('profiles').select('id').eq('leader_free', true).limit(BATCH);
  if (error) { console.error('[billing/engine] leader query failed:', error.message); return 0; }
  let moved = 0;
  for (const p of (data ?? []) as { id: string }[]) {
    try {
      const snap = await leaderSnapshot(p.id);
      if (!leaderCycleEnded({ ...snap, now })) continue;
      const lastIso = snap.lastFacilitatedAt?.toISOString() ?? null;
      if (mode === 'dry') {
        if (!(await recentEvent(p.id, 'would_end_leader_cycle', 30, now))) await logBillingEvent(p.id, 'would_end_leader_cycle', { last_facilitated_at: lastIso, next_tier: 'builder' });
        moved++;
        continue;
      }
      const { data: claimed } = await supabaseAdmin.from('profiles').update({ leader_free: false, updated_at: now.toISOString() }).eq('id', p.id).eq('leader_free', true).select('id');
      if (!claimed || !claimed.length) continue;
      await logBillingEvent(p.id, 'leader_cycle_ended', {
        last_facilitated_at: lastIso, needs_card: true, tier: 'builder',
        solo_price_kobo: priceFor('builder', 'solo', 'monthly'), group_price_kobo: priceFor('builder', 'group', 'monthly'),
      });
      await notifyLeaderCycleEnded(p.id, { soloPriceKobo: priceFor('builder', 'solo', 'monthly'), groupPriceKobo: priceFor('builder', 'group', 'monthly') });
      moved++;
    } catch (e) { console.error('[billing/engine] leader cycle failed:', e instanceof Error ? e.message : 'unknown'); }
  }
  return moved;
}

/**
 * Admin alert (handoff): a group whose active count FALLS to exactly 3 (it has had at least 4 members) gets an in-app notice to
 * every admin and an email, so replacements can be invited. One alert per group per 14 days. Dry mode logs 'would_alert_group'.
 */
export async function runGroupAlerts(now: Date, mode: 'dry' | 'live'): Promise<number> {
  const { data: groups, error } = await supabaseAdmin.from('billing_groups').select('id, code, status').in('status', ['forming', 'active']).limit(BATCH);
  if (error) { console.error('[billing/engine] group query failed:', error.message); return 0; }
  let alerts = 0;
  for (const g of (groups ?? []) as { id: string; code: string }[]) {
    try {
      const { data: members } = await supabaseAdmin.from('billing_group_members').select('user_id, left_at').eq('group_id', g.id);
      const rows = (members ?? []) as { user_id: string; left_at: string | null }[];
      const ever = new Set(rows.map((r) => r.user_id)).size;
      const ids = rows.filter((r) => !r.left_at).map((r) => r.user_id);
      if (ids.length === 0 || ever < GROUP_MIN + 1) continue; // it must have FALLEN to 3, not formed at 3
      const [{ data: subs }, { data: profs }] = await Promise.all([
        supabaseAdmin.from('member_subscriptions').select('user_id, state').in('user_id', ids),
        supabaseAdmin.from('profiles').select('id, leader_free').in('id', ids),
      ]);
      const free = new Set(((profs ?? []) as { id: string; leader_free: boolean }[]).filter((p) => p.leader_free).map((p) => p.id));
      const active = countActiveMembers(((subs ?? []) as { user_id: string; state: SubState }[]).map((s) => ({ state: s.state, leaderFree: free.has(s.user_id) })));
      if (!groupAlertDue(active)) continue;
      const type = mode === 'dry' ? 'would_alert_group' : 'group_admin_alert_sent';
      if (await recentEvent(null, type, GROUP_REPLACE_DAYS, now, { group_id: g.id })) continue;
      await logBillingEvent(null, type, { group_id: g.id, code: g.code, active_count: active });
      if (mode === 'live') await notifyAdminsGroupAtMinimum({ groupCode: g.code, activeCount: active });
      alerts++;
    } catch (e) { console.error('[billing/engine] group alert failed:', e instanceof Error ? e.message : 'unknown'); }
  }
  return alerts;
}

// ── The cycle ────────────────────────────────────────────────────────────────

export async function runBillingCycle(now = new Date()): Promise<CycleSummary> {
  const mode = chargingMode();
  const s = emptySummary(mode);
  if (mode === 'off') return s;

  const { data, error } = await supabaseAdmin.from('member_subscriptions').select('*')
    .in('state', ['trial', 'active', 'grace']).lte('next_charge_at', now.toISOString()).order('next_charge_at', { ascending: true }).limit(BATCH);
  if (error) { console.error('[billing/engine] due query failed:', error.message); s.errors++; return s; }

  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const sub = toSubscription(row);
    s.due++;
    try {
      const out = await processSubscription(sub, mode, now);
      if (out === 'charged') s.charged++;
      else if (out === 'would_charge') s.wouldCharge++;
      else if (out === 'skipped_credit') s.skippedForCredit++;
      else if (out === 'extended') s.extended++;
      else if (out === 'failed') s.failed++;
      else if (out === 'lapsed') s.lapsed++;
      else if (out === 'cancelled') s.cancelledAtPeriodEnd++;
    } catch (e) {
      s.errors++;
      console.error('[billing/engine] subscription failed:', sub.userId.slice(0, 8), e instanceof Error ? e.message : 'unknown');
    }
  }

  // Both modes: dry only logs would_* events, live acts. Group warnings and trial reminders are inside sendReminders.
  try { Object.assign(s, await sendReminders(now, mode)); } catch (e) { s.errors++; console.error('[billing/engine] reminders failed:', e instanceof Error ? e.message : 'unknown'); }
  try { s.leaderCycles = await runLeaderCycles(now, mode); } catch (e) { s.errors++; console.error('[billing/engine] leader step failed:', e instanceof Error ? e.message : 'unknown'); }
  try { s.groupAlerts = await runGroupAlerts(now, mode); } catch (e) { s.errors++; console.error('[billing/engine] group alert step failed:', e instanceof Error ? e.message : 'unknown'); }

  if (mode === 'live') {
    try { s.creditEarned = await earnReferralCredit(now); } catch (e) { s.errors++; console.error('[billing/engine] credit earn step failed:', e instanceof Error ? e.message : 'unknown'); }
    try { s.creditExpired = await expireCredit(now); } catch (e) { s.errors++; console.error('[billing/engine] credit expiry step failed:', e instanceof Error ? e.message : 'unknown'); }
  }
  return s;
}
