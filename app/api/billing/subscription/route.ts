// GET /api/billing/subscription
// The signed-in member's v2 subscription (null when they have none: legacy members have no row), plus credit balance.
// { subscription: { state, tier, cycle, priceType, planCode, amountKobo, trialEndsAt, nextChargeAt, periodEnd, graceEndsAt,
//                   failedCount, cancelAtPeriodEnd, access: 'full'|'light' } | null, creditBalanceKobo }
// amountKobo is the price of the stored plan; the exact amount of the next charge is decided at charge time (group rules, credit).
import { NextResponse } from 'next/server';
import { requireBillingMember } from '@/lib/billing/api';
import { getSubscription, creditBalanceKobo } from '@/lib/billing/subscriptions';
import { getPlan } from '@/lib/billing/catalog';
import { accessLevel } from '@/lib/billing/rules';

export const dynamic = 'force-dynamic';

export async function GET() {
  const g = await requireBillingMember();
  if (!g.ok) return g.response;
  const [sub, credit] = await Promise.all([getSubscription(g.userId), creditBalanceKobo(g.userId)]);
  if (!sub) return NextResponse.json({ subscription: null, creditBalanceKobo: credit });
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return NextResponse.json({
    subscription: {
      state: sub.state, tier: sub.tier, cycle: sub.cycle, priceType: sub.priceType, planCode: sub.planCode,
      amountKobo: getPlan(sub.planCode)?.amountKobo ?? null,
      trialEndsAt: iso(sub.trialEndsAt), nextChargeAt: iso(sub.nextChargeAt), periodEnd: iso(sub.periodEnd), graceEndsAt: iso(sub.graceEndsAt),
      failedCount: sub.failedCount, cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      access: accessLevel({ state: sub.state, periodEnd: sub.periodEnd }, new Date()),
    },
    creditBalanceKobo: credit,
  });
}
