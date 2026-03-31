// lib/pricing.ts
// ─────────────────────────────────────────────────────────────
// Single source of truth for all plan prices and discounts.
// To change pricing: edit ONLY this file.
//
// Plan ID mapping (Supabase subscription_plan → display name):
//   builder → Explorer  (₦12,000/mo)
//   pro     → Builder   (₦25,000/mo)
//   elite   → Climber   (₦60,000/mo)
//
// Imported by:
//   - app/checkout/page.tsx
//   - app/pricing/page.tsx
//   - app/who-its-for/page.tsx
//   - app/page.tsx (homepage pricing section)
// ─────────────────────────────────────────────────────────────

export interface PlanPricing {
  id:             string;  // Supabase subscription_plan value
  name:           string;  // Display name shown to users
  monthlyPrice:   number;  // NGN/month billed monthly
  yearlyPrice:    number;  // NGN total billed annually
  yearlyPerMonth: number;  // yearlyPrice / 12 for display
  yearlyDiscount: number;  // percentage saved vs monthly × 12
  yearlySavings:  number;  // absolute NGN saved per year
}

export const PLAN_PRICING: PlanPricing[] = [
  {
    id:             'builder',      // Supabase ID
    name:           'Explorer',     // display name
    monthlyPrice:   12000,
    yearlyPrice:    115200,         // ₦9,600/mo — 20% off
    yearlyPerMonth: 9600,
    yearlyDiscount: 20,
    yearlySavings:  28800,          // 12000×12 - 115200
  },
  {
    id:             'pro',          // Supabase ID
    name:           'Builder',      // display name
    monthlyPrice:   25000,
    yearlyPrice:    240000,         // ₦20,000/mo — 20% off
    yearlyPerMonth: 20000,
    yearlyDiscount: 20,
    yearlySavings:  60000,          // 25000×12 - 240000
  },
  {
    id:             'elite',        // Supabase ID
    name:           'Climber',      // display name
    monthlyPrice:   60000,
    yearlyPrice:    576000,         // ₦48,000/mo — 20% off
    yearlyPerMonth: 48000,
    yearlyDiscount: 20,
    yearlySavings:  144000,         // 60000×12 - 576000
  },
];

/** Fast lookup by Supabase plan id */
export const PLAN_PRICING_MAP: Record<string, PlanPricing> = Object.fromEntries(
  PLAN_PRICING.map((p) => [p.id, p])
);

/** Maximum yearly savings across all plans (for the toggle nudge copy) */
export const MAX_YEARLY_SAVINGS = Math.max(...PLAN_PRICING.map((p) => p.yearlySavings));
