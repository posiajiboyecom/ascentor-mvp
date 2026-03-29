// app/pricing/data.ts — v2
// Paystack handles NGN. Lemonsqueezy handles USD.
// After running scripts/seed-paystack-plans.ts, paste the printed codes below.

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

export interface B2BTier {
  id: string
  name: string
  label: string
  flatMonthly: number | null
  seatPrice: number | null
  maxSeats: string
  annualText: string
  hot: boolean
  badge: string
  ctaLabel: string
  ctaVariant: 'primary' | 'secondary'
  paystackPlanCode: { monthly: string; annual: string }
  lemonVariantId: { monthly: string; annual: string }
  features: PlanFeature[]
}

// ─────────────────────────────────────────────────────────────────────────────
// B2C TIERS
// After running seed-paystack-plans.ts, paste codes into paystackPlanCode.
// After creating LS products, paste variant IDs into lemonVariantId.
// ─────────────────────────────────────────────────────────────────────────────
export const B2C_TIERS: B2CTier[] = [
  {
    id: 'free',
    name: 'Free',
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
    id: 'builder',
    name: 'Builder',
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
    id: 'pro',
    name: 'Pro',
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
      { enabled: true,  text: 'Everything in Builder' },
      { enabled: true,  text: 'AI writes your content 3×/week' },
      { enabled: true,  text: 'Personal brand agent' },
      { enabled: true,  text: '1 expert session/month' },
      { enabled: true,  text: 'Priority coaching' },
      { enabled: false, text: 'Dedicated success manager' },
    ],
  },
  {
    id: 'elite',
    name: 'Elite',
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
      { enabled: true, text: 'Everything in Pro' },
      { enabled: true, text: '2 expert sessions/month' },
      { enabled: true, text: 'Weekly human check-in' },
      { enabled: true, text: 'CV + LinkedIn audit' },
      { enabled: true, text: 'Custom learning path' },
      { enabled: true, text: 'Dedicated success manager' },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// B2B TIERS
// ─────────────────────────────────────────────────────────────────────────────
export const B2B_TIERS: B2BTier[] = [
  {
    id: 'studio',
    name: 'Studio',
    label: 'Solo coaches',
    flatMonthly: 149,
    seatPrice: 4,
    maxSeats: 'Up to 100 members',
    annualText: '$1,520/yr · save $268',
    hot: false,
    badge: '',
    ctaLabel: 'Start 14-day trial',
    ctaVariant: 'secondary',
    paystackPlanCode: { monthly: '', annual: '' },
    lemonVariantId: { monthly: '', annual: '' },
    features: [
      { enabled: true,  text: '1 branded subdomain' },
      { enabled: true,  text: 'Up to 100 member seats' },
      { enabled: true,  text: 'Community + courses' },
      { enabled: true,  text: 'Payment collection' },
      { enabled: true,  text: 'Basic admin dashboard' },
      { enabled: false, text: 'AI agents' },
      { enabled: false, text: 'Custom domain' },
      { enabled: false, text: 'API access' },
    ],
  },
  {
    id: 'academy',
    name: 'Academy',
    label: 'Growing orgs',
    flatMonthly: 499,
    seatPrice: 3,
    maxSeats: 'Up to 500 members',
    annualText: '$5,090/yr · save $898',
    hot: true,
    badge: 'Most popular',
    ctaLabel: 'Start 14-day trial',
    ctaVariant: 'primary',
    paystackPlanCode: { monthly: '', annual: '' },
    lemonVariantId: { monthly: '', annual: '' },
    features: [
      { enabled: true,  text: '3 branded subdomains' },
      { enabled: true,  text: 'Up to 500 member seats' },
      { enabled: true,  text: 'Full AI agent suite' },
      { enabled: true,  text: 'Content + intel agents' },
      { enabled: true,  text: 'Personal brand agent' },
      { enabled: true,  text: 'Custom domain support' },
      { enabled: true,  text: 'Priority support' },
      { enabled: false, text: 'Dedicated CSM' },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    label: 'Large institutions',
    flatMonthly: null,
    seatPrice: null,
    maxSeats: '500+ members',
    annualText: 'Annual contract',
    hot: false,
    badge: '',
    ctaLabel: 'Book a call',
    ctaVariant: 'secondary',
    paystackPlanCode: { monthly: '', annual: '' },
    lemonVariantId: { monthly: '', annual: '' },
    features: [
      { enabled: true, text: 'Unlimited subdomains' },
      { enabled: true, text: '500+ seats, volume pricing' },
      { enabled: true, text: 'All AI agents + custom agents' },
      { enabled: true, text: 'SLA + uptime guarantee' },
      { enabled: true, text: 'Dedicated CSM' },
      { enabled: true, text: 'API access' },
      { enabled: true, text: 'SSO / SAML integration' },
      { enabled: true, text: 'Custom contract + invoicing' },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// REVENUE MODEL
// ─────────────────────────────────────────────────────────────────────────────
export interface RevenueRow {
  label: string
  b2cMRR: string
  b2bMRR: string
  totalMRR: string
  arr: string
}

export const REVENUE_ROWS: RevenueRow[] = [
  { label: 'Month 6',  b2cMRR: '$1,618',  b2bMRR: '$1,617',  totalMRR: '$3,235',  arr: '~$38k' },
  { label: 'Month 12', b2cMRR: '$6,675',  b2bMRR: '$10,990', totalMRR: '$17,665', arr: '~$212k' },
  { label: 'Month 24', b2cMRR: '$22,250', b2bMRR: '$41,725', totalMRR: '$63,975', arr: '~$768k' },
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
