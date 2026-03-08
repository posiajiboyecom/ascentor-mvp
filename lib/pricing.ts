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
  id:           string;
  name:         string;
  monthlyPrice: number;  // USD/month billed monthly
  yearlyPrice:  number;  // USD total billed annually
  yearlyPerMonth: number; // yearlyPrice / 12 for display
  yearlyDiscount: number; // percentage saved vs monthly × 12
  yearlySavings:  number; // absolute USD saved per year
}

// ── Prices ────────────────────────────────────────────────────
// Monthly: Explorer $12 · Builder $24 · Climber $39
// Yearly:  Explorer $86 (40% off) · Builder $173 (40% off) · Climber $281 (40% off)
// Yearly prices rounded to psychologically clean numbers.
export const PLAN_PRICING: PlanPricing[] = [
  {
    id:             'explorer',
    name:           'Explorer',
    monthlyPrice:   12,
    yearlyPrice:    86,   // $7.17/mo — 40% off
    yearlyPerMonth: 7,
    yearlyDiscount: 40,
    yearlySavings:  58,   // 12×12 - 86
  },
  {
    id:             'builder',
    name:           'Builder',
    monthlyPrice:   24,
    yearlyPrice:    173,  // $14.42/mo — 40% off
    yearlyPerMonth: 14,
    yearlyDiscount: 40,
    yearlySavings:  115,  // 24×12 - 173
  },
  {
    id:             'climber',
    name:           'Climber',
    monthlyPrice:   39,
    yearlyPrice:    281,  // $23.42/mo — 40% off
    yearlyPerMonth: 23,
    yearlyDiscount: 40,
    yearlySavings:  187,  // 39×12 - 281
  },
];

/** Fast lookup by plan id */
export const PLAN_PRICING_MAP: Record<string, PlanPricing> = Object.fromEntries(
  PLAN_PRICING.map((p) => [p.id, p])
);

/** Maximum yearly savings across all plans (for the toggle nudge copy) */
export const MAX_YEARLY_SAVINGS = Math.max(...PLAN_PRICING.map((p) => p.yearlySavings));
