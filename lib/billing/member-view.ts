// lib/billing/member-view.ts
// Server-only loader for the member Billing screen. Reads the member's OWN rows (id from the session, passed in by the page).
// Read-only: it never charges, never changes a row, and never exposes authorization codes or other members.
//
// Exports
//   loadBillingView(userId, now?) -> BillingViewData

import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { formatNaira, tierLabel, type Cycle, type PriceType, type Tier } from './catalog';
import { listCards, VERIFY_AMOUNT_KOBO, type SafeCard } from './cards';
import { creditBalanceKobo, getSubscription, scheduledChange } from './subscriptions';
import { getGroupStatus, type GroupStatusView } from './groups';
import { accessLevel, type SubState } from './rules';
import { previewNextCharge, type NextChargePreview } from './preview';

export interface HistoryRow { id: string; dateIso: string; desc: string; amountLabel: string; credit: string | null }

export interface BillingViewData {
  leaderFree: boolean;
  referralCode: string | null;
  sub: null | {
    state: SubState; tier: Tier; cycle: Cycle; priceType: PriceType; planName: string;
    trialEndsAt: string | null; nextChargeAt: string | null; periodEnd: string | null; graceEndsAt: string | null;
    cancelAtPeriodEnd: boolean; failedCount: number; access: 'full' | 'light';
  };
  next: NextChargePreview | null;
  creditBalanceKobo: number;
  cards: SafeCard[];
  group: GroupStatusView;
  history: HistoryRow[];
  verifyAmountLabel: string;
}

export async function loadBillingView(userId: string, now = new Date()): Promise<BillingViewData> {
  const [sub, credit, cards, group, prof, pays] = await Promise.all([
    getSubscription(userId),
    creditBalanceKobo(userId, now),
    listCards(userId),
    getGroupStatus(userId),
    supabaseAdmin.from('profiles').select('leader_free, referral_code, subscription_plan, subscription_status').eq('id', userId).maybeSingle(),
    supabaseAdmin.from('payments').select('id, plan_id, billing, amount, status, paid_at, created_at, metadata').eq('user_id', userId).eq('status', 'success').order('created_at', { ascending: false }).limit(12),
  ]);
  const p = prof.data as { leader_free?: boolean; referral_code?: string | null; subscription_plan?: string | null; subscription_status?: string | null } | null;

  let next: NextChargePreview | null = null;
  let subView: BillingViewData['sub'] = null;
  if (sub) {
    const change = await scheduledChange(userId, sub);
    next = previewNextCharge({
      tier: sub.tier, cycle: sub.cycle, currentPriceType: sub.priceType, lockedGroupPriceUntil: sub.lockedGroupPriceUntil,
      inGroup: group.inGroup, groupComplete: group.activeCount >= 3, groupFlagged: group.underReview,
      scheduled: change, creditBalanceKobo: credit, now,
    });
    const iso = (d: Date | null) => (d ? d.toISOString() : null);
    subView = {
      state: sub.state, tier: sub.tier, cycle: sub.cycle, priceType: sub.priceType,
      planName: `${tierLabel(sub.tier)}, ${sub.cycle === 'yearly' ? 'yearly' : 'monthly'}`,
      trialEndsAt: iso(sub.trialEndsAt), nextChargeAt: iso(sub.nextChargeAt), periodEnd: iso(sub.periodEnd), graceEndsAt: iso(sub.graceEndsAt),
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd, failedCount: sub.failedCount,
      access: accessLevel({ state: sub.state, periodEnd: sub.periodEnd }, now),
    };
  }

  type PayRow = { id: string; plan_id: string | null; billing: string | null; amount: number | null; paid_at: string | null; created_at: string; metadata: { credit_applied_kobo?: number; price_type?: string } | null };
  const history: HistoryRow[] = ((pays.data ?? []) as PayRow[]).map((x) => {
    const tier = x.plan_id === 'builder' ? 'Builder' : x.plan_id === 'explorer' ? 'Seeker' : x.plan_id === 'leader' ? 'Leader' : 'Plan';
    const credit = x.metadata?.credit_applied_kobo ?? 0;
    return {
      id: x.id, dateIso: x.paid_at ?? x.created_at,
      desc: `${tier}, ${x.billing === 'annual' || x.billing === 'yearly' ? 'yearly' : 'monthly'}${x.metadata?.price_type === 'group' ? ', group price' : ''}`,
      amountLabel: formatNaira(Math.round(Number(x.amount ?? 0) * 100)),
      credit: credit > 0 ? `${formatNaira(credit)} credit applied` : null,
    };
  });

  return {
    leaderFree: !!p?.leader_free,
    referralCode: p?.referral_code ?? null, sub: subView, next, creditBalanceKobo: credit,
    cards, group, history, verifyAmountLabel: formatNaira(VERIFY_AMOUNT_KOBO),
  };
}
