// lib/plans-config.ts
// Plan prices for screens that show the two plans side by side (admin Plans, analytics, marketing pages).
// Ascentor sells exactly three plans, Seeker (stored as 'explorer'), Builder and Pinnacle, through Billing v2.
// The prices are NOT decided here: they come from lib/billing/catalog.ts (solo prices), the one place prices live,
// so nothing can show a price that checkout does not charge.

import 'server-only';
import { priceFor, type Tier } from '@/lib/billing/catalog';
import { formatNaira, type PlanPricing } from '@/lib/pricing';

function fromCatalog(id: Tier, name: string): PlanPricing {
  const monthlyPrice = priceFor(id, 'solo', 'monthly') / 100;
  const yearlyPrice = priceFor(id, 'solo', 'yearly') / 100;
  const full = monthlyPrice * 12;
  return {
    id,
    name,
    monthlyPrice,
    yearlyPrice,
    yearlyPerMonth: Math.round(yearlyPrice / 12),
    yearlyDiscount: full > 0 ? Math.round(((full - yearlyPrice) / full) * 100) : 0,
    yearlySavings: Math.max(0, full - yearlyPrice),
  };
}

/** Seeker, then Builder (solo prices; group prices live in the catalog and the checkout). */
export function getPlanPricing(): PlanPricing[] {
  return [fromCatalog('explorer', 'Seeker'), fromCatalog('builder', 'Builder'), fromCatalog('pinnacle', 'Pinnacle')];
}

export function getPlanPricingMap(): Record<string, PlanPricing> {
  return Object.fromEntries(getPlanPricing().map((p) => [p.id, p]));
}

export function getFeaturedPricing(): { explorer: PlanPricing; builder: PlanPricing } {
  const m = getPlanPricingMap();
  return { explorer: m.explorer, builder: m.builder };
}

/** "₦7,000 a month" for a plan, from the catalog's solo price. */
export function planPriceLabel(planId: string | null | undefined, billing: string | null | undefined): string {
  const yearly = billing === 'annual' || billing === 'yearly';
  const plan = planId ? getPlanPricingMap()[planId] : undefined;
  return plan ? `${formatNaira(yearly ? plan.yearlyPrice : plan.monthlyPrice)} a ${yearly ? 'year' : 'month'}` : '';
}
