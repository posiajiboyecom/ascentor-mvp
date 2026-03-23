// lib/pricing.ts
// ─────────────────────────────────────────────────────────────
// Single source of truth for all plan prices and discounts.
// To change pricing: edit ONLY this file.
//
// Imported by:
//   - app/checkout/page.tsx
//   - app/pricing/page.tsx
//   - app/who-its-for/page.tsx
//   - app/page.tsx (homepage pricing section)
// ─────────────────────────────────────────────────────────────

export interface PlanPricing {
  id:             string;
  name:           string;
  monthlyPrice:   number;  // NGN/month billed monthly
  yearlyPrice:    number;  // NGN total billed annually
  yearlyPerMonth: number;  // yearlyPrice / 12 for display
  yearlyDiscount: number;  // percentage saved vs monthly × 12
  yearlySavings:  number;  // absolute NGN saved per year
}

// ── Prices ────────────────────────────────────────────────────
// Monthly: Explorer ₦5,000 · Builder ₦10,000 · Climber ₦15,000
// Yearly:  Explorer ₦48,000 (20% off) · Builder ₦96,000 (20% off) · Climber ₦144,000 (20% off)
export const PLAN_PRICING: PlanPricing[] = [
  {
    id:             'explorer',
    name:           'Explorer',
    monthlyPrice:   5000,
    yearlyPrice:    48000,   // ₦4,000/mo — 20% off
    yearlyPerMonth: 4000,
    yearlyDiscount: 20,
    yearlySavings:  12000,   // 5000×12 - 48000
  },
  {
    id:             'builder',
    name:           'Builder',
    monthlyPrice:   10000,
    yearlyPrice:    96000,   // ₦8,000/mo — 20% off
    yearlyPerMonth: 8000,
    yearlyDiscount: 20,
    yearlySavings:  24000,   // 10000×12 - 96000
  },
  {
    id:             'climber',
    name:           'Climber',
    monthlyPrice:   15000,
    yearlyPrice:    144000,  // ₦12,000/mo — 20% off
    yearlyPerMonth: 12000,
    yearlyDiscount: 20,
    yearlySavings:  36000,   // 15000×12 - 144000
  },
];

/** Fast lookup by plan id */
export const PLAN_PRICING_MAP: Record<string, PlanPricing> = Object.fromEntries(
  PLAN_PRICING.map((p) => [p.id, p])
);

/** Maximum yearly savings across all plans (for the toggle nudge copy) */
export const MAX_YEARLY_SAVINGS = Math.max(...PLAN_PRICING.map((p) => p.yearlySavings));
