// lib/admin/billing-admin.ts
// Pure helpers for the Billing v2 admin pages (Subscriptions, Groups, Credits). No I/O, safe to import anywhere and to unit test.
//   stateLabel(state)            -> Trial | Active | Grace | Lapsed | Cancelled
//   mrrKobo(subs)                -> naira monthly recurring revenue estimate from the catalog (active and grace, not leaving)
//   mrrByCurrency(subs)          -> { NGN, USD } in minor units;  moneyTotals({NGN, USD}) -> "₦9,000 · $15"
//   koboToNaira(minor, currency?) -> money label in that currency (default NGN)
//   groupStatusLabel(status)     -> Forming | Active | Broken
//   groupNotice(activeCount)     -> the visual notice for a group, or null
//   creditKindLabel(reason)      -> Earned | Used | Expired | Cancelled
//   chargingNote(mode, v2On)     -> the banner wording for BILLING_V2_CHARGING
//   canRetryCharge(mode, state)  -> whether 'Retry charge now' may be offered
//   csvText                      -> CSV with a formula-injection guard

import { isPaidTier, getPlan, perMonthKobo, tierLabel, formatMoney, isCurrency, type Currency } from '@/lib/billing/catalog';

export type ChargingModeKey = 'off' | 'dry' | 'live';

const STATE_LABEL: Record<string, string> = { trial: 'Trial', active: 'Active', grace: 'Grace', lapsed: 'Lapsed', cancelled: 'Cancelled' };
export const SUB_STATE_ORDER = ['Trial', 'Active', 'Grace', 'Lapsed', 'Cancelled'] as const;

export function stateLabel(state: string): string {
  return STATE_LABEL[state] ?? '-';
}

export interface MrrInput { planCode: string; state: string; cancelAtPeriodEnd?: boolean; currency?: string | null }

/** Monthly-equivalent minor units of every paying subscription, per currency: active or grace, not set to end. Trials never count. */
export function mrrByCurrency(subs: MrrInput[]): Record<Currency, number> {
  const total: Record<Currency, number> = { NGN: 0, USD: 0 };
  for (const s of subs) {
    if (s.state !== 'active' && s.state !== 'grace') continue;
    if (s.cancelAtPeriodEnd) continue;
    const plan = getPlan(s.planCode);
    const currency: Currency = isCurrency(s.currency) ? s.currency : 'NGN';
    if (plan) total[currency] += perMonthKobo(plan, currency);
  }
  return total;
}

/** Naira-only MRR (kept for older callers and tests). */
export function mrrKobo(subs: MrrInput[]): number {
  return mrrByCurrency(subs.filter((s) => !s.currency || s.currency === 'NGN')).NGN;
}

/** "₦9,000", or "₦9,000 · $15" once there is US dollar money. Naira and dollars are never added together. */
export function moneyTotals(t: Record<Currency, number>): string {
  return t.USD > 0 ? `${formatMoney(t.NGN, 'NGN')} · ${formatMoney(t.USD, 'USD')}` : formatMoney(t.NGN, 'NGN');
}

export function planLabel(tier: string | null | undefined): string {
  return isPaidTier(tier) ? tierLabel(tier) : '-';
}

export const priceTypeLabel = (t: string | null | undefined) => (t === 'group' ? 'Group' : t === 'solo' ? 'Solo' : '-');
export const cycleLabel = (c: string | null | undefined) => (c === 'yearly' ? 'Yearly' : c === 'monthly' ? 'Monthly' : '-');

export function koboToNaira(kobo: number | null | undefined, currency: Currency = 'NGN'): string {
  return kobo == null || !Number.isFinite(kobo) ? '-' : formatMoney(kobo, currency);
}

const GROUP_LABEL: Record<string, string> = { forming: 'Forming', active: 'Active', broken: 'Broken' };
export function groupStatusLabel(status: string | null | undefined): string {
  return GROUP_LABEL[String(status)] ?? '-';
}

/** A group with exactly 3 active members has no spare seat: one more departure drops it below the group price. */
export function groupNotice(activeCount: number): string | null {
  return activeCount === 3 ? 'Exactly 3 active members. Replacements may be needed.' : null;
}

const CREDIT_LABEL: Record<string, string> = { referral_earned: 'Earned', used: 'Used', expired: 'Expired', cancelled: 'Cancelled' };
export const creditKindLabel = (reason: string) => CREDIT_LABEL[reason] ?? '-';

export function chargingNote(mode: ChargingModeKey, v2On: boolean): { tone: 'bad' | 'warn' | 'good'; title: string; body: string } {
  const sw = v2On ? 'Billing v2 is on.' : 'Billing v2 is off for members.';
  if (mode === 'live') return { tone: 'bad', title: 'Charging is LIVE', body: `${sw} The renewal engine charges real cards.` };
  if (mode === 'dry') return { tone: 'warn', title: 'Charging is in dry run', body: `${sw} The engine only records what it would charge. No card is charged.` };
  return { tone: 'good', title: 'Charging is off', body: `${sw} The renewal engine does nothing and no card is charged.` };
}

/** Retry is for a failed renewal (grace) and only while charging is live. */
export function canRetryCharge(mode: ChargingModeKey, state: string): boolean {
  return mode === 'live' && state === 'grace';
}

export function extendedDate(from: Date | null, days: number): Date | null {
  if (!from) return null;
  return new Date(from.getTime() + days * 86_400_000);
}

const csvCell = (v: string) => `"${String(v ?? '').replace(/"/g, '""').replace(/^([=+\-@\t\r])/, "'$1")}"`;
export const csvLine = (cells: string[]) => cells.map(csvCell).join(',');
export const csvText = (head: string[], rows: string[][]) => [csvLine(head), ...rows.map(csvLine)].join('\r\n');

const TZ = 'Africa/Lagos';
export function dayLabel(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });
}
export function dayTimeLabel(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ });
}

export function eventLabel(type: string): string {
  const t: Record<string, string> = {
    trial_started: 'Trial started', first_charge: 'First charge', renewal_succeeded: 'Renewal paid', renewal_failed: 'Renewal failed', grace_started: 'Grace started',
    lapsed: 'Lapsed', reactivated: 'Reactivated', group_joined: 'Joined a group', group_left: 'Left a group', group_price_applied: 'Group price applied',
    group_price_removed: 'Group price removed', credit_earned: 'Credit earned', credit_used: 'Credit used', credit_expired: 'Credit expired',
    credit_cancelled: 'Credit cancelled', card_added: 'Card added', card_removed: 'Card removed', card_default_changed: 'Default card changed',
    would_charge: 'Dry run: would charge', charge_retry: 'Charge retried', subscription_cancelled: 'Cancelled', subscription_resumed: 'Resumed',
    trial_extended: 'Trial extended by an admin',
  };
  return t[type] ?? type.replace(/_/g, ' ');
}
