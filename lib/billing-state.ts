// lib/billing-state.ts
// Turns the real profile fields into the billing state the plan screen shows.
//   active       paying, renews on subscription_end
//   trialEnding  subscription_status = trialing
//   failed       subscription_status = past_due (the last payment was declined)
//   cancelled    cancelled, still inside the paid period
//   lapsed       had a paid plan, no longer covered: "light access"
//   none         never subscribed

import type { PlanTier } from '@/lib/planTier';
import { planDisplayName, planKey } from '@/lib/plans-display';

export type BillState = 'active' | 'trialEnding' | 'failed' | 'cancelled' | 'lapsed' | 'none';

export interface BillingProfile {
  subscription_plan?: string | null;
  subscription_status?: string | null;
  subscription_end?: string | null;
}

export interface BillingView {
  state: BillState;
  plan: PlanTier | 'leader';
  planName: string;
  daysLeft: number | null;
  tag: { label: string; cls: string };
  line: string;
  /** "6 Nov" and "6 Nov 2026" for the paid-until date, when there is one. */
  untilShort: string;
  untilLong: string;
}

const fmt = (d: Date, tz: string, withYear: boolean) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' as const } : {}), timeZone: tz });

/**
 * `priceLabel` is what the member actually pays, already formatted by the server (for example "₦25,000 a month").
 * It is optional: without it the price is simply left out of the line.
 */
export function deriveBilling(p: BillingProfile | null | undefined, tz = 'Africa/Lagos', now = new Date(), priceLabel = ''): BillingView {
  const plan = planKey(p?.subscription_plan);
  const planName = planDisplayName(p?.subscription_plan);
  const status = p?.subscription_status ?? '';
  const end = p?.subscription_end ? new Date(p.subscription_end) : null;
  const future = !end || end > now;
  const daysLeft = end ? Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000)) : null;
  const untilShort = end ? fmt(end, tz, false) : '';
  const untilLong = end ? fmt(end, tz, true) : '';

  let state: BillState;
  if (status === 'past_due') state = 'failed';
  else if (status === 'trialing' && future) state = 'trialEnding';
  else if (status === 'active' && future) state = 'active';
  else if (status === 'cancelled' && end && end > now) state = 'cancelled';
  else if (plan !== 'free') state = 'lapsed';
  else state = 'none';

  const days = daysLeft ?? 0;
  const dayWord = days === 1 ? 'day' : 'days';
  const tag = {
    active: { label: 'Active', cls: 'rx-tag rust' },
    trialEnding: { label: `First period · ${days} ${dayWord} left`, cls: 'rx-tag goldt' },
    failed: { label: 'Payment failed', cls: 'rx-tag rust' },
    lapsed: { label: 'Light access', cls: 'rx-tag' },
    cancelled: { label: 'Cancelled', cls: 'rx-tag' },
    none: { label: 'Free', cls: 'rx-tag' },
  }[state];
  const line = {
    active: `${priceLabel}${untilLong ? `${priceLabel ? ' · ' : ''}paid until ${untilLong}` : ''}`,
    trialEnding: `Includes 7 extra days · first period ends in ${days} ${dayWord}`,
    failed: `${priceLabel ? `${priceLabel} · ` : ''}last payment failed`,
    lapsed: 'Paused · reactivate any time',
    cancelled: `Cancelled · you keep ${planName} until ${untilLong}`,
    none: 'Choose a plan to get full access.',
  }[state];

  return { state, plan, planName: state === 'none' ? 'No plan yet' : planName, daysLeft, tag, line, untilShort, untilLong };
}
