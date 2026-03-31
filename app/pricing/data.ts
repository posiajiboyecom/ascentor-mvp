// app/pricing/data.ts — v3
// Plan display names updated: Starter→Free, Builder→Explorer, Pro→Builder, Elite→Climber
// Backend IDs (id field) are UNCHANGED — they map to subscription_plan in Supabase.
// Currency is auto-detected server-side via x-currency header (NG→ngn, rest→usd).

export type Currency = 'ngn' | 'usd'
export type BillingCycle = 'monthly' | 'annual'

export interface PlanFeature {
  enabled: boolean
  text: string
}

export interface B2CTier {
  id: string
  name: string
  label: string
  priceMonthly: { ngn: number | null; usd: number | null }
  annualTotal: { ngn: number | null; usd: number | null }
  annualSavings: { ngn: number | null; usd: number | null }
  hot: boolean
  badge: string
  ctaLabel: string
  ctaVariant: 'primary' | 'secondary'
  // Paystack plan codes (NGN)
  paystackPlanCode: {
    monthly: string
    annual: string
  }
  // Lemonsqueezy variant IDs (USD) — get from LS dashboard → Products → Variants
  lemonVariantId: {
    monthly: string
    annual: string
  }
  features: PlanFeature[]
}


// ─────────────────────────────────────────────────────────────────────────────
// B2C TIERS
export const B2C_TIERS: B2CTier[] = [
  {
    id: 'free',
    name: 'Free',         // display name
    label: 'Starter',
    priceMonthly: { ngn: 0, usd: 0 },
    annualTotal: { ngn: null, usd: null },
    annualSavings: { ngn: null, usd: null },
    hot: false,
    badge: '',
    ctaLabel: 'Get started',
    ctaVariant: 'secondary',
    paystackPlanCode: { monthly: '', annual: '' },
    lemonVariantId: { monthly: '', annual: '' },
    features: [
      { enabled: true,  text: '5 AI coaching sessions/month' },
      { enabled: true,  text: 'Community feed access' },
      { enabled: true,  text: '1 free course' },
      { enabled: false, text: 'Personal brand agent' },
      { enabled: false, text: 'Expert sessions' },
      { enabled: false, text: 'Cohort access' },
    ],
  },
  {
    id: 'builder',       // ← Supabase subscription_plan value — do NOT change
    name: 'Explorer',    // ← display name
    label: 'Popular',
    priceMonthly: { ngn: 12000, usd: 19 },
    annualTotal: { ngn: 115200, usd: 180 },
    annualSavings: { ngn: 28800, usd: 48 },
    hot: false,
    badge: '',
    ctaLabel: 'Start 7-day trial',
    ctaVariant: 'secondary',
    // ↓ paste output from seed script
    paystackPlanCode: { monthly: '', annual: '' },
    // ↓ paste from Lemonsqueezy dashboard
    lemonVariantId: { monthly: '', annual: '' },
    features: [
      { enabled: true,  text: 'Unlimited AI coaching' },
      { enabled: true,  text: 'Full community + cohorts' },
      { enabled: true,  text: 'All courses' },
      { enabled: false, text: 'Personal brand agent' },
      { enabled: false, text: 'Expert sessions' },
      { enabled: false, text: 'Priority support' },
    ],
  },
  {
    id: 'pro',           // ← Supabase subscription_plan value — do NOT change
    name: 'Builder',     // ← display name
    label: 'Recommended',
    priceMonthly: { ngn: 25000, usd: 39 },
    annualTotal: { ngn: 240000, usd: 372 },
    annualSavings: { ngn: 60000, usd: 96 },
    hot: true,
    badge: 'Most value',
    ctaLabel: 'Start 7-day trial',
    ctaVariant: 'primary',
    paystackPlanCode: { monthly: '', annual: '' },
    lemonVariantId: { monthly: '', annual: '' },
    features: [
      { enabled: true,  text: 'Everything in Explorer' },
      { enabled: true,  text: 'AI writes your content 3×/week' },
      { enabled: true,  text: 'Personal brand agent' },
      { enabled: true,  text: '1 expert session/month' },
      { enabled: true,  text: 'Priority coaching' },
      { enabled: false, text: 'Dedicated success manager' },
    ],
  },
  {
    id: 'elite',         // ← Supabase subscription_plan value — do NOT change
    name: 'Climber',     // ← display name
    label: 'High-touch',
    priceMonthly: { ngn: 60000, usd: 99 },
    annualTotal: { ngn: 576000, usd: 948 },
    annualSavings: { ngn: 144000, usd: 240 },
    hot: false,
    badge: '',
    ctaLabel: 'Book a call',
    ctaVariant: 'secondary',
    paystackPlanCode: { monthly: '', annual: '' },
    lemonVariantId: { monthly: '', annual: '' },
    features: [
      { enabled: true, text: 'Everything in Builder' },
      { enabled: true, text: '2 expert sessions/month' },
      { enabled: true, text: 'Weekly human check-in' },
      { enabled: true, text: 'CV + LinkedIn audit' },
      { enabled: true, text: 'Custom learning path' },
      { enabled: true, text: 'Dedicated success manager' },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
export function formatPrice(amount: number | null, currency: Currency): string {
  if (amount === null) return 'Custom'
  if (amount === 0) return currency === 'ngn' ? '₦0' : '$0'
  if (currency === 'ngn') return `₦${amount.toLocaleString('en-NG')}`
  return `$${amount}`
}

export function getAnnualLabel(tier: B2CTier, currency: Currency): string {
  const total = tier.annualTotal[currency]
  const save = tier.annualSavings[currency]
  if (!total || !save) return ''
  return `${formatPrice(total, currency)}/yr · save ${formatPrice(save, currency)}`
}

/** Returns which payment provider to use based on currency */
export function getProvider(currency: Currency): 'paystack' | 'lemonsqueezy' {
  return currency === 'ngn' ? 'paystack' : 'lemonsqueezy'
}
