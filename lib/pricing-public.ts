// lib/pricing-public.ts
// The public pricing section's data, in the visitor's currency. Pure: the caller passes the currency
// (lib/geo.ts visitorCurrency(), on the server). Every number comes from lib/billing/catalog.ts.

import { PAID_TIERS, formatMoney, groupDiscountApplies, priceFor, tierLabel, type Currency, type Tier } from '@/lib/billing/catalog';
import { PLAN_BLURBS, PLAN_BULLETS } from '@/lib/plans-display';
import { GROUP_MIN } from '@/lib/billing/rules';

export interface PublicPlan {
  tier: Tier;
  name: string;
  blurb: string;
  bullets: string[];
  monthly: string;
  yearly: string;
  /** Yearly price as a monthly figure, e.g. "₦2,500 a month". */
  yearlyPerMonth: string;
  /** "₦2,000 a month each in a group of 3", only where group prices exist (naira). */
  group: string | null;
}

export interface PublicPricing {
  currency: Currency;
  /** "naira" | "US dollars" */
  currencyName: string;
  plans: PublicPlan[];
  groupMin: number;
}

export function publicPricing(currency: Currency): PublicPricing {
  const money = (minor: number) => formatMoney(minor, currency);
  const group = groupDiscountApplies(currency);
  return {
    currency,
    currencyName: currency === 'USD' ? 'US dollars' : 'naira',
    groupMin: GROUP_MIN,
    plans: PAID_TIERS.map((t) => ({
      tier: t,
      name: tierLabel(t),
      blurb: PLAN_BLURBS[t],
      bullets: PLAN_BULLETS[t],
      monthly: money(priceFor(t, 'solo', 'monthly', currency)),
      yearly: money(priceFor(t, 'solo', 'yearly', currency)),
      yearlyPerMonth: money(Math.round(priceFor(t, 'solo', 'yearly', currency) / 12)),
      group: group ? `${money(priceFor(t, 'group', 'monthly', currency))} a month each in a group of ${GROUP_MIN}` : null,
    })),
  };
}
