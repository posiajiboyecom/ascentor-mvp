// lib/billing/rules.ts
// ─────────────────────────────────────────────────────────────────────────────
// Billing v2 RULES. PURE: no I/O, no Date.now() (callers pass `now`), fully unit
// tested in scripts/billing-tests/rules.test.ts. Every number here comes from the
// Payments Developer Handoff; change a rule here and nowhere else.
//
// Exports
//   Time:       TRIAL_DAYS, addDays, addMonths, nextPeriodEnd, trialEndsAt, firstChargeAt
//   States:     SubState, isActiveState, accessLevel, stateAfterChargeSuccess
//   Group:      GROUP_MIN, GROUP_MAX, GROUP_REPLACE_DAYS, GROUP_WARN_DAYS,
//               countActiveMembers, isGroupComplete, decideFirstChargePrice,
//               resolveRenewalPriceType, groupWarningDue
//   Failures:   RETRY_OFFSET_DAYS, GRACE_DAYS, graceEndsAt, nextRetryAfterFailure, graceExpired
//   Credit:     CREDIT_RATE, CREDIT_VALID_MONTHS, creditPerReferralKobo, computeCreditLots,
//               availableCreditKobo, applyCredit, expiredLots
//   Quorum:     quorumNeeded, offersMerge
//   Fees:       estimatePaystackFeeKobo
//   Refs:       chargeReference
// ─────────────────────────────────────────────────────────────────────────────

import type { Cycle, PriceType } from './catalog';

const DAY = 86_400_000;

// ── Time ─────────────────────────────────────────────────────────────────────

export const TRIAL_DAYS = 7;

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
}

/** Calendar month add in UTC; a 31st that does not exist clamps to the last day of the month. */
export function addMonths(d: Date, n: number): Date {
  const out = new Date(d.getTime());
  const day = out.getUTCDate();
  out.setUTCDate(1);
  out.setUTCMonth(out.getUTCMonth() + n);
  const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(day, last));
  return out;
}

/** End of the period a charge made at `from` pays for. */
export function nextPeriodEnd(from: Date, cycle: Cycle): Date {
  return addMonths(from, cycle === 'yearly' ? 12 : 1);
}

/** Trial ends 7 days after it starts. */
export function trialEndsAt(start: Date): Date {
  return addDays(start, TRIAL_DAYS);
}

/** The first charge is on day 8, which is the moment the trial ends. */
export function firstChargeAt(start: Date): Date {
  return trialEndsAt(start);
}

// ── Subscription states ──────────────────────────────────────────────────────

export type SubState = 'trial' | 'active' | 'grace' | 'lapsed' | 'cancelled';

/** "Active member" per the handoff: on a trial, paying, or inside the 7-day grace period. */
export function isActiveState(state: SubState): boolean {
  return state === 'trial' || state === 'active' || state === 'grace';
}

/**
 * full  = everything the tier includes
 * light = Today, own growth record, open house, direct messages (see docs/billing-v2-design.md)
 * A cancelled member keeps full access until the end of the period they paid for.
 */
export function accessLevel(sub: { state: SubState; periodEnd?: Date | null; trialEndsAt?: Date | null }, now: Date): 'full' | 'light' {
  if (isActiveState(sub.state)) return 'full';
  if (sub.state === 'cancelled') {
    const end = sub.periodEnd ?? null;
    return end && end.getTime() > now.getTime() ? 'full' : 'light';
  }
  return 'light';
}

/** A successful charge always lands on 'active', from trial, active, grace or lapsed (reactivation). */
export function stateAfterChargeSuccess(): SubState {
  return 'active';
}

// ── Groups ───────────────────────────────────────────────────────────────────

export const GROUP_MIN = 3;
export const GROUP_MAX = 10;
export const GROUP_REPLACE_DAYS = 14;
export const GROUP_WARN_DAYS = 7;
export const FIRST_CHARGE_EXTENSION_DAYS = 6; // day 8 -> day 14

export interface GroupMemberState {
  state: SubState;
  /** Free Leaders do not count toward the 3. */
  leaderFree?: boolean;
}

/** Active members only; free Leaders excluded; every tier and cycle (yearly included) counts. */
export function countActiveMembers(members: GroupMemberState[]): number {
  return members.filter((m) => isActiveState(m.state) && !m.leaderFree).length;
}

export function isGroupComplete(activeCount: number): boolean {
  return activeCount >= GROUP_MIN;
}

export type FirstChargeDecision =
  | { action: 'charge'; priceType: PriceType }
  | { action: 'extend'; nextChargeAt: Date };

/**
 * Day 8. In a complete group everyone pays the group price. An incomplete group gets ONE extension to day 14
 * (the charge moves to day 14); after the extension the member is charged the solo price.
 * A member who is not in a group is simply charged solo.
 */
export function decideFirstChargePrice(i: {
  inGroup: boolean;
  activeCount: number;
  extensionUsed: boolean;
  trialStart: Date;
}): FirstChargeDecision {
  if (!i.inGroup) return { action: 'charge', priceType: 'solo' };
  if (isGroupComplete(i.activeCount)) return { action: 'charge', priceType: 'group' };
  if (!i.extensionUsed) {
    return { action: 'extend', nextChargeAt: addDays(firstChargeAt(i.trialStart), FIRST_CHARGE_EXTENSION_DAYS) };
  }
  return { action: 'charge', priceType: 'solo' };
}

/**
 * Price type at a RENEWAL (not the first charge).
 *  - Yearly group price is locked for the 12 months already paid.
 *  - A complete group pays the group price (a solo member who joined a complete group gets it from this billing date).
 *  - A group that was paying the group price and fell below 3 keeps it for 14 days (`belowSince` + 14d) to replace the
 *    member; if still below 3 at the renewal after that, the member moves to solo.
 */
export function resolveRenewalPriceType(i: {
  inGroup: boolean;
  activeCount: number;
  currentPriceType: PriceType;
  lockedGroupPriceUntil?: Date | null;
  /** When the group was first seen below 3 (null = not recorded yet, treated as just now). */
  belowSince?: Date | null;
  now: Date;
}): PriceType {
  if (i.currentPriceType === 'group' && i.lockedGroupPriceUntil && i.lockedGroupPriceUntil.getTime() > i.now.getTime()) return 'group';
  if (!i.inGroup) return 'solo';
  if (isGroupComplete(i.activeCount)) return 'group';
  if (i.currentPriceType !== 'group') return 'solo';
  if (!i.belowSince) return 'group';
  return i.now.getTime() >= addDays(i.belowSince, GROUP_REPLACE_DAYS).getTime() ? 'solo' : 'group';
}

/** True when the member should be warned: the group is below 3, protection will have run out by the renewal, and the renewal is within 7 days. */
export function groupWarningDue(i: {
  currentPriceType: PriceType;
  activeCount: number;
  lockedGroupPriceUntil?: Date | null;
  belowSince?: Date | null;
  nextChargeAt: Date;
  now: Date;
}): boolean {
  if (i.currentPriceType !== 'group' || isGroupComplete(i.activeCount)) return false;
  if (i.lockedGroupPriceUntil && i.lockedGroupPriceUntil.getTime() > i.nextChargeAt.getTime()) return false;
  if (!i.belowSince) return false;
  const solo = addDays(i.belowSince, GROUP_REPLACE_DAYS).getTime() <= i.nextChargeAt.getTime();
  const within = i.now.getTime() >= addDays(i.nextChargeAt, -GROUP_WARN_DAYS).getTime() && i.now.getTime() < i.nextChargeAt.getTime();
  return solo && within;
}

// ── Failed payments, retries, grace ──────────────────────────────────────────

/** Retries happen this many days after the FIRST failure: +1, +3, +5 (all inside the 7-day grace window). */
export const RETRY_OFFSET_DAYS = [1, 3, 5] as const;
export const GRACE_DAYS = 7;

export function graceEndsAt(firstFailureAt: Date): Date {
  return addDays(firstFailureAt, GRACE_DAYS);
}

/**
 * When to try again after the `failedCount`-th consecutive failure (1 = the original charge).
 * Returns the grace end when the retries are used up (the engine then lapses the member at that moment).
 */
export function nextRetryAfterFailure(firstFailureAt: Date, failedCount: number): { at: Date; final: boolean } {
  const idx = failedCount - 1;
  if (idx >= 0 && idx < RETRY_OFFSET_DAYS.length) return { at: addDays(firstFailureAt, RETRY_OFFSET_DAYS[idx]), final: false };
  return { at: graceEndsAt(firstFailureAt), final: true };
}

/** After grace the member lapses (light access) and the Circle seat is released. */
export function graceExpired(graceEnds: Date | null | undefined, now: Date): boolean {
  return !!graceEnds && now.getTime() >= graceEnds.getTime();
}

// ── Referral credit ──────────────────────────────────────────────────────────

export const CREDIT_RATE_PERCENT = 20;
export const CREDIT_VALID_MONTHS = 12;
export const CREDIT_HOLD_DAYS = 14; // refund window before credit is earned

/** 20% of the inviter's OWN monthly price, in kobo (yearly members pass the monthly price of their plan type). */
export function creditPerReferralKobo(inviterMonthlyKobo: number): number {
  return Math.round((inviterMonthlyKobo * CREDIT_RATE_PERCENT) / 100);
}

export interface LedgerRow {
  id: string;
  amountKobo: number;
  reason: 'referral_earned' | 'used' | 'expired' | 'cancelled';
  createdAt: Date;
  expiresAt?: Date | null;
}

export interface CreditLot {
  id: string;
  remainingKobo: number;
  expiresAt: Date;
}

function replayLedger(rows: LedgerRow[]): CreditLot[] {
  const sorted = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const lots: CreditLot[] = [];
  for (const r of sorted) {
    if (r.reason === 'referral_earned' && r.amountKobo > 0) {
      lots.push({ id: r.id, remainingKobo: r.amountKobo, expiresAt: r.expiresAt ?? addMonths(r.createdAt, CREDIT_VALID_MONTHS) });
    } else if (r.reason === 'used' || r.reason === 'cancelled') {
      let need = Math.abs(r.amountKobo);
      for (const lot of lots) {
        if (need <= 0) break;
        if (lot.remainingKobo <= 0 || lot.expiresAt.getTime() <= r.createdAt.getTime()) continue;
        const take = Math.min(lot.remainingKobo, need);
        lot.remainingKobo -= take;
        need -= take;
      }
    }
  }
  return lots;
}

/**
 * Replays the ledger in time order into the lots that still hold credit at `now`.
 * 'referral_earned' opens a lot (expires 12 months later unless a date is stored); 'used' and 'cancelled' draw the oldest
 * lot that had not yet expired at that moment first; 'expired' rows are an audit mirror and are ignored here (expiry is
 * decided by date). Lots that have expired at `now` are dropped. Oldest first.
 */
export function computeCreditLots(rows: LedgerRow[], now: Date): CreditLot[] {
  return replayLedger(rows).filter((l) => l.remainingKobo > 0 && l.expiresAt.getTime() > now.getTime());
}

/** Lots that expired on or before `now` and still had credit in them (for the expiry step to write 'expired' rows). */
export function expiredLots(rows: LedgerRow[], now: Date): CreditLot[] {
  return replayLedger(rows).filter((l) => l.remainingKobo > 0 && l.expiresAt.getTime() <= now.getTime());
}

export function availableCreditKobo(rows: LedgerRow[], now: Date): number {
  return computeCreditLots(rows, now).reduce((s, l) => s + l.remainingKobo, 0);
}

export interface CreditApplication {
  /** Credit used against this charge. */
  appliedKobo: number;
  /** What the card is charged (0 = skip the charge, the member stays active). */
  chargeKobo: number;
  /** Per lot draw, oldest first. */
  draws: { lotId: string; kobo: number }[];
  /** True when credit covers the whole charge: no card charge, the member still counts as active. */
  skipCharge: boolean;
}

/** Applies up to 100% of the charge from the oldest lots; any remainder stays in the ledger (carries forward). */
export function applyCredit(chargeKobo: number, lots: CreditLot[]): CreditApplication {
  let left = Math.max(0, chargeKobo);
  const draws: { lotId: string; kobo: number }[] = [];
  for (const lot of lots) {
    if (left <= 0) break;
    const take = Math.min(lot.remainingKobo, left);
    if (take > 0) { draws.push({ lotId: lot.id, kobo: take }); left -= take; }
  }
  const applied = Math.max(0, chargeKobo) - left;
  return { appliedKobo: applied, chargeKobo: left, draws, skipCharge: chargeKobo > 0 && left === 0 };
}

// ── Call quorum ──────────────────────────────────────────────────────────────

export const QUORUM_PERCENT = 60;
export const QUORUM_MIN = 3;

/** 60% of active members rounded up, never fewer than 3. */
export function quorumNeeded(activeMembers: number): number {
  const sixty = Math.floor((Math.max(0, activeMembers) * QUORUM_PERCENT + 99) / 100);
  return Math.max(QUORUM_MIN, sixty);
}

/** A Circle with 4 or fewer active members is offered a merge. */
export function offersMerge(activeMembers: number): boolean {
  return activeMembers <= 4;
}

// ── Paystack fee estimate ────────────────────────────────────────────────────

/**
 * Local cards: 1.5% + NGN 100 (the 100 is waived under NGN 2,500), capped at NGN 2,000.
 * International cards: 3.9% + NGN 100. Returned in kobo, rounded up. An estimate for display and margin checks only.
 */
export function estimatePaystackFeeKobo(amountKobo: number, international = false): number {
  const flat = international || amountKobo >= 250_000 ? 10_000 : 0;
  const pct = Math.ceil((amountKobo * (international ? 39 : 15)) / 1000);
  const fee = pct + flat;
  return international ? fee : Math.min(fee, 200_000);
}

// ── Charge references ────────────────────────────────────────────────────────

/** Idempotent Paystack reference for a charge attempt: sub_<userId>_<yyyymmddHH> in UTC. */
export function chargeReference(userId: string, at: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `sub_${userId}_${at.getUTCFullYear()}${p(at.getUTCMonth() + 1)}${p(at.getUTCDate())}${p(at.getUTCHours())}`;
}
