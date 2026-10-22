// lib/billing/preview.ts
// ─────────────────────────────────────────────────────────────────────────────
// What the member SEES about their next charge and their state, in plain words. PURE: no I/O, no Date.now().
// This is a display preview. The renewal engine decides the real charge at charge time (engine.ts + subscriptions.ts), using the
// same rules from rules.ts; prices come only from catalog.ts.
//
// Exports
//   previewNextCharge(i)    -> { tier, cycle, priceType, grossKobo, creditKobo, payKobo, groupKobo, soloKobo }
//   stateWords(i, fmt)      -> { label, tone, headline, detail }
//   checkoutSummary(i, fmt) -> the trial summary lines shown before the member starts their trial
// ─────────────────────────────────────────────────────────────────────────────

import { formatNaira, priceFor, tierLabel, type Cycle, type PriceType, type Tier } from './catalog';
import { addDays, firstChargeAt, GROUP_MIN, TRIAL_DAYS, type SubState } from './rules';

export interface NextChargePreview {
  tier: Tier; cycle: Cycle; priceType: PriceType;
  grossKobo: number; creditKobo: number; payKobo: number;
  /** Both prices for the same tier and cycle, so the screen can say "₦2,000 once 3 friends join, ₦3,000 until then". */
  groupKobo: number; soloKobo: number;
}

export function previewNextCharge(i: {
  tier: Tier; cycle: Cycle;
  currentPriceType: PriceType;
  lockedGroupPriceUntil?: Date | null;
  inGroup: boolean;
  groupComplete: boolean;
  /** A flagged group does not get the group price until an admin clears it. */
  groupFlagged?: boolean;
  scheduled?: { tier: Tier; cycle: Cycle } | null;
  creditBalanceKobo: number;
  now: Date;
}): NextChargePreview {
  const tier = i.scheduled?.tier ?? i.tier;
  const cycle = i.scheduled?.cycle ?? i.cycle;
  const locked = i.currentPriceType === 'group' && !!i.lockedGroupPriceUntil && i.lockedGroupPriceUntil.getTime() > i.now.getTime();
  const priceType: PriceType = locked || (i.inGroup && i.groupComplete && !i.groupFlagged) ? 'group' : 'solo';
  const grossKobo = priceFor(tier, priceType, cycle);
  const creditKobo = Math.max(0, Math.min(i.creditBalanceKobo, grossKobo));
  return {
    tier, cycle, priceType, grossKobo, creditKobo, payKobo: grossKobo - creditKobo,
    groupKobo: priceFor(tier, 'group', cycle), soloKobo: priceFor(tier, 'solo', cycle),
  };
}

export type Tone = 'rust' | 'gold' | 'plain';

export interface StateWords { label: string; tone: Tone; headline: string; detail: string }

export function stateWords(i: {
  state: SubState;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  nextChargeAt: string | null;
  periodEnd: string | null;
  graceEndsAt: string | null;
  /** What the next charge will be, already formatted ("₦3,000"), or null. */
  amountLabel: string | null;
  now: Date;
}, fmt: (iso: string | null) => string): StateWords {
  const amount = i.amountLabel;
  switch (i.state) {
    case 'trial':
      return {
        label: 'Free trial', tone: 'rust',
        headline: `Your free trial ends on ${fmt(i.trialEndsAt)}`,
        detail: `Your first charge${amount ? ` of ${amount}` : ''} is on ${fmt(i.nextChargeAt ?? i.trialEndsAt)}. Cancel any time before then and you will not be charged.`,
      };
    case 'active':
      if (i.cancelAtPeriodEnd) {
        return {
          label: 'Cancelled', tone: 'plain',
          headline: `Your plan ends on ${fmt(i.periodEnd)}`,
          detail: 'You keep full access until then and you will not be charged again. You can resume any time before that date.',
        };
      }
      return {
        label: 'Active', tone: 'rust',
        headline: `Your plan renews on ${fmt(i.nextChargeAt)}`,
        detail: amount ? `We will charge ${amount} to your default card.` : 'We will charge your default card.',
      };
    case 'grace':
      return {
        label: 'Payment due', tone: 'gold',
        headline: 'We could not take your last payment',
        detail: `You keep full access until ${fmt(i.graceEndsAt)}. Check your card below so we can try again. Nothing else is needed.`,
      };
    case 'lapsed':
      return {
        label: 'Paused', tone: 'plain',
        headline: 'Your plan is paused',
        detail: 'You still have Today, your growth record, the open house group and direct messages. Sage, Circle chat, advanced Learn and mentor sessions are paused until you pay again.',
      };
    case 'cancelled': {
      const stillPaid = !!i.periodEnd && new Date(i.periodEnd).getTime() > i.now.getTime();
      return stillPaid
        ? { label: 'Cancelled', tone: 'plain', headline: `Your plan ends on ${fmt(i.periodEnd)}`, detail: 'You keep full access until then and you will not be charged again. You can resume any time before that date.' }
        : { label: 'Cancelled', tone: 'plain', headline: 'Your plan is cancelled', detail: 'You still have Today, your growth record, the open house group and direct messages. You can subscribe again whenever you like.' };
    }
  }
}

export interface CheckoutSummary {
  trialLine: string;
  chargeLine: string;
  cancelLine: string;
  /** Extra line when a group is chosen and the group price may or may not apply on day 8. */
  groupLine: string | null;
}

/** The three plain lines of the checkout summary: free for 7 days, first charge on day 8 (exact date and amount), cancel before to pay nothing. */
export function checkoutSummary(i: {
  tier: Tier; cycle: Cycle; withGroup: boolean; start: Date;
}, fmt: (d: Date) => string): CheckoutSummary {
  const day8 = firstChargeAt(i.start);
  const solo = priceFor(i.tier, 'solo', i.cycle);
  const group = priceFor(i.tier, 'group', i.cycle);
  const per = i.cycle === 'yearly' ? 'a year' : 'a month';
  return {
    trialLine: `Free for ${TRIAL_DAYS} days, from today until ${fmt(addDays(i.start, TRIAL_DAYS))}.`,
    chargeLine: `Your first charge is on day 8, ${fmt(day8)}: ${formatNaira(solo)} ${per}${i.withGroup ? ' (or the group price below)' : ''} for ${tierLabel(i.tier)}.`,
    cancelLine: 'Cancel any time before then and you will not be charged.',
    groupLine: i.withGroup
      ? `With ${GROUP_MIN} active members in your group the price is ${formatNaira(group)} ${per}. If your group is not complete on day 8, we wait until day 14 once, then charge ${formatNaira(solo)}.`
      : null,
  };
}
