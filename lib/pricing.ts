// lib/pricing.ts
// ─────────────────────────────────────────────────────────────
// Pure plan-pricing types and maths. NO prices live here.
//
// The amounts come from lib/plans-config.ts (server only, reads PLAN_SEEKER_PRICE_NGN and
// PLAN_BUILDER_PRICE_NGN). Change a price there / in the environment, never in this file.
//
// Plan ID convention (matches profiles.subscription_plan; ids are NOT renamed):
//   explorer → shown to members as "Seeker"
//   builder  → "Builder"
//   climber  → "Climber" (legacy: kept working for the members who hold it, not sold in the new plan UI)
//   leader   → "Leader" (paid, for members who facilitate a Circle; priced like the others from lib/plans-config.ts)
//
// Billing: members pay monthly or annually. The annual price is 12 months less 20%.
// Old ids used in earlier code (pro / elite) remain valid via PLAN_ID_ALIASES.
// ─────────────────────────────────────────────────────────────

export interface PlanPricing {
  id:             string   // profiles.subscription_plan value
  name:           string   // display name shown to users
  monthlyPrice:   number   // NGN per month, billed monthly
  yearlyPrice:    number   // NGN total, billed annually
  yearlyPerMonth: number   // yearlyPrice / 12, for display
  yearlyDiscount: number   // percentage saved vs monthly × 12
  yearlySavings:  number   // absolute NGN saved per year
}

export const YEARLY_DISCOUNT_PCT = 20

/** Price of the legacy Climber plan. Fixed: it is not configurable and not sold in the new plan UI. */
export const LEGACY_CLIMBER_MONTHLY_NGN = 60000

/** Builds one plan's pricing from its monthly naira price. */
export function buildPlanPricing(id: string, name: string, monthlyPrice: number): PlanPricing {
  const yearlyPrice = Math.round(monthlyPrice * 12 * (100 - YEARLY_DISCOUNT_PCT) / 100)
  return {
    id,
    name,
    monthlyPrice,
    yearlyPrice,
    yearlyPerMonth: Math.round(yearlyPrice / 12),
    yearlyDiscount: YEARLY_DISCOUNT_PCT,
    yearlySavings:  monthlyPrice * 12 - yearlyPrice,
  }
}

/** 25000 -> "₦25,000" (whole naira, en-NG grouping). */
export const formatNaira = (n: number) => '₦' + Math.round(n).toLocaleString('en-NG')

/** Maximum yearly savings across the given plans. */
export const maxYearlySavings = (plans: PlanPricing[]) => Math.max(0, ...plans.map((p) => p.yearlySavings))

/** Also map old plan IDs for backwards compatibility */
export const PLAN_ID_ALIASES: Record<string, string> = {
  // old id → new id
  builder: 'explorer',  // old 'builder' Supabase ID → Explorer tier
  pro:     'builder',   // old 'pro' Supabase ID → Builder tier
  elite:   'climber',   // old 'elite' Supabase ID → Climber tier
}
