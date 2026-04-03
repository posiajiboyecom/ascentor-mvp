// lib/pricing.ts  — PAYMENT SYSTEM v3
// ─────────────────────────────────────────────────────────────
// Single source of truth for all plan prices.
// To change pricing: edit ONLY this file.
//
// Plan ID convention (matches profiles.subscription_plan):
//   explorer → Explorer tier  (₦12,000/mo)
//   builder  → Builder tier   (₦25,000/mo)
//   climber  → Climber tier   (₦60,000/mo)
//
// NOTE: Previous code used builder/pro/elite as plan IDs.
// v3 uses explorer/builder/climber to match the display names.
// Existing DB rows with old IDs (builder/pro/elite) remain valid —
// the subscription_plan column accepts any text value.
// ─────────────────────────────────────────────────────────────

export interface PlanPricing {
  id:             string   // profiles.subscription_plan value
  name:           string   // display name shown to users
  monthlyPrice:   number   // NGN/month billed monthly
  yearlyPrice:    number   // NGN total billed annually
  yearlyPerMonth: number   // yearlyPrice / 12 for display
  yearlyDiscount: number   // percentage saved vs monthly × 12
  yearlySavings:  number   // absolute NGN saved per year
}

export const PLAN_PRICING: PlanPricing[] = [
  {
    id:             'explorer',
    name:           'Explorer',
    monthlyPrice:   12000,
    yearlyPrice:    115200,         // ₦9,600/mo — 20% off
    yearlyPerMonth: 9600,
    yearlyDiscount: 20,
    yearlySavings:  28800,
  },
  {
    id:             'builder',
    name:           'Builder',
    monthlyPrice:   25000,
    yearlyPrice:    240000,         // ₦20,000/mo — 20% off
    yearlyPerMonth: 20000,
    yearlyDiscount: 20,
    yearlySavings:  60000,
  },
  {
    id:             'climber',
    name:           'Climber',
    monthlyPrice:   60000,
    yearlyPrice:    576000,         // ₦48,000/mo — 20% off
    yearlyPerMonth: 48000,
    yearlyDiscount: 20,
    yearlySavings:  144000,
  },
]

/** Fast lookup by plan id */
export const PLAN_PRICING_MAP: Record<string, PlanPricing> = Object.fromEntries(
  PLAN_PRICING.map((p) => [p.id, p])
)

/** Also map old plan IDs for backwards compatibility */
export const PLAN_ID_ALIASES: Record<string, string> = {
  // old id → new id
  builder: 'explorer',  // old 'builder' Supabase ID → Explorer tier
  pro:     'builder',   // old 'pro' Supabase ID → Builder tier
  elite:   'climber',   // old 'elite' Supabase ID → Climber tier
}

/** Maximum yearly savings across all plans */
export const MAX_YEARLY_SAVINGS = Math.max(...PLAN_PRICING.map((p) => p.yearlySavings))
