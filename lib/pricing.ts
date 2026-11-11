// lib/pricing.ts
// Pure plan-pricing types and helpers. NO prices live here: they come from lib/billing/catalog.ts via
// lib/plans-config.ts. Ascentor sells three plans, Seeker (stored as 'explorer'), Builder and Pinnacle.

export interface PlanPricing {
  id:             string   // profiles.subscription_plan value
  name:           string   // display name shown to users
  monthlyPrice:   number   // NGN per month, billed monthly
  yearlyPrice:    number   // NGN total, billed annually
  yearlyPerMonth: number   // yearlyPrice / 12, for display
  yearlyDiscount: number   // percentage saved vs monthly × 12
  yearlySavings:  number   // absolute NGN saved per year
}

/** 25000 -> "₦25,000" (whole naira, en-NG grouping). */
export const formatNaira = (n: number) => '₦' + Math.round(n).toLocaleString('en-NG')

/** Maximum yearly savings across the given plans. */
export const maxYearlySavings = (plans: PlanPricing[]) => Math.max(0, ...plans.map((p) => p.yearlySavings))
