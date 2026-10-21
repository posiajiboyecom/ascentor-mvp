// lib/plans-config.ts
// THE ONE PLACE plan prices are decided. Server only.
//
//   PLAN_SEEKER_PRICE_NGN    monthly price of Seeker  (plan id "explorer"), whole naira, default 15000
//   PLAN_BUILDER_PRICE_NGN   monthly price of Builder (plan id "builder"),  whole naira, default 25000
//   PLAN_LEADER_PRICE_NGN    monthly price of Leader  (plan id "leader"),   whole naira, default 40000
//
// Annual billing is 12 months less 20% (see lib/pricing.ts).
// Checkout (/api/pay/start), settlement (lib/paymentSettlement.ts), the plan screens, the payment result page and
// analytics all read from here. Client components never import this file: they receive prices as props from the
// server, so what is shown and what Paystack charges can never disagree.
//
// A bad value (not a positive whole number) throws on first use instead of silently charging the wrong amount.
// After changing a variable in Vercel, redeploy: environment variables are read when the server starts.

import 'server-only';
import { buildPlanPricing, formatNaira, LEGACY_CLIMBER_MONTHLY_NGN, type PlanPricing } from '@/lib/pricing';

export const PLAN_PRICE_DEFAULTS = { seeker: 15000, builder: 25000, leader: 40000 } as const;

/** Parses one price variable. Exported for tests. */
export function parsePlanPrice(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const v = raw.trim();
  if (!/^[1-9]\d*$/.test(v)) {
    throw new Error(`${name} must be a positive whole number of naira (for example ${fallback}), got "${v}".`);
  }
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n > 100_000_000) throw new Error(`${name} is out of range: "${v}".`);
  return n;
}

export function readPlanPrices(env: Record<string, string | undefined> = process.env) {
  return {
    seeker:  parsePlanPrice('PLAN_SEEKER_PRICE_NGN',  env.PLAN_SEEKER_PRICE_NGN,  PLAN_PRICE_DEFAULTS.seeker),
    builder: parsePlanPrice('PLAN_BUILDER_PRICE_NGN', env.PLAN_BUILDER_PRICE_NGN, PLAN_PRICE_DEFAULTS.builder),
    leader:  parsePlanPrice('PLAN_LEADER_PRICE_NGN',  env.PLAN_LEADER_PRICE_NGN,  PLAN_PRICE_DEFAULTS.leader),
  };
}

let cached: PlanPricing[] | null = null;

/** Seeker, Builder, Leader, then legacy Climber (kept so existing Climber members can still be charged and settled). */
export function getPlanPricing(): PlanPricing[] {
  if (!cached) {
    const p = readPlanPrices();
    cached = [
      buildPlanPricing('explorer', 'Seeker', p.seeker),
      buildPlanPricing('builder', 'Builder', p.builder),
      buildPlanPricing('leader', 'Leader', p.leader),
      buildPlanPricing('climber', 'Climber', LEGACY_CLIMBER_MONTHLY_NGN),
    ];
  }
  return cached;
}

export function getPlanPricingMap(): Record<string, PlanPricing> {
  return Object.fromEntries(getPlanPricing().map((p) => [p.id, p]));
}

/** The three plans sold today, for client props. */
export function getFeaturedPricing(): { explorer: PlanPricing; builder: PlanPricing; leader: PlanPricing } {
  const m = getPlanPricingMap();
  return { explorer: m.explorer, builder: m.builder, leader: m.leader };
}

/**
 * "₦25,000 a month" for a member's plan. `paidNgn` (the last amount they actually paid) wins over the current list
 * price, so legacy members see what they really pay and a price change never rewrites what we tell them.
 */
export function planPriceLabel(planId: string | null | undefined, billing: string | null | undefined, paidNgn?: number | null): string {
  const yearly = billing === 'annual' || billing === 'yearly';
  const plan = planId ? getPlanPricingMap()[planId] : undefined;
  const amount = paidNgn && paidNgn > 0 ? paidNgn : plan ? (yearly ? plan.yearlyPrice : plan.monthlyPrice) : null;
  return amount == null ? '' : `${formatNaira(amount)} a ${yearly ? 'year' : 'month'}`;
}
