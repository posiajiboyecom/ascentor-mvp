// app/pricing/data.ts
// Plan display names: Free | Explorer | Builder | Climber
// Supabase IDs (DO NOT CHANGE): free | builder | pro | elite
// Currency auto-detected server-side via x-currency header (NG→ngn, rest→usd)

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
  paystackPlanCode: { monthly: string; annual: string }
  lemonVariantId: { monthly: string; annual: string }
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
  lemonVariantId: { monthly: string; annual: string }
  features: PlanFeature[]
}

// ─────────────────────────────────────────────────────────────────────────────
// B2C TIERS
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
      { enabled: true,  text: 'Community feed access (1 cohort)' },
      { enabled: true,  text: '1 free preview course' },
      { enabled: false, text: 'Expert sessions' },
      { enabled: false, text: 'Full course library' },
      { enabled: false, text: 'Cohort access (3+)' },
    ],
  },
  {
    id: 'builder',        // Supabase ID — do NOT change
    name: 'Explorer',     // display name
    label: 'Popular',
    priceMonthly: { ngn: 12000, usd: 19 },
    annualTotal: { ngn: 115200, usd: 180 },
    annualSavings: { ngn: 28800, usd: 48 },
    hot: false,
    badge: '',
    ctaLabel: 'Start 7-day trial',
    ctaVariant: 'secondary',
    paystackPlanCode: { monthly: '', annual: '' },
    lemonVariantId: { monthly: '', annual: '' },
    features: [
      { enabled: true,  text: '30 AI coaching sessions/month' },
      { enabled: true,  text: 'Up to 3 community cohorts' },
      { enabled: true,  text: 'Full course library' },
      { enabled: true,  text: '1 expert session/month' },
      { enabled: false, text: 'Unlimited coaching' },
      { enabled: false, text: 'Priority coaching' },
    ],
  },
  {
    id: 'pro',            // Supabase ID — do NOT change
    name: 'Builder',      // display name
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
      { enabled: true,  text: 'Unlimited AI coaching' },
      { enabled: true,  text: 'Unlimited community cohorts' },
      { enabled: true,  text: '2 expert sessions/month' },
      { enabled: true,  text: 'Priority coaching' },
      { enabled: false, text: 'Dedicated success manager' },
    ],
  },
  {
    id: 'elite',          // Supabase ID — do NOT change
    name: 'Climber',      // display name
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
      { enabled: true, text: 'Unlimited expert sessions' },
      { enabled: true, text: '2 expert sessions/month' },
      { enabled: true, text: 'Weekly human check-in' },
      { enabled: true, text: 'Custom learning path' },
      { enabled: true, text: 'Dedicated success manager' },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// B2B TIERS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export interface RevenueRow {
  label: string
  b2cMRR: string
  b2bMRR: string
  totalMRR: string
  arr: string
}

export const REVENUE_ROWS: RevenueRow[] = [
  { label: 'Month 6',  b2cMRR: '$1,618',  b2bMRR: '$1,617',  totalMRR: '$3,235',   arr: '$38,820'   },
  { label: 'Month 9',  b2cMRR: '$3,800',  b2bMRR: '$5,200',  totalMRR: '$9,000',   arr: '$108,000'  },
  { label: 'Month 12', b2cMRR: '$6,675',  b2bMRR: '$10,990', totalMRR: '$17,665',  arr: '$211,980'  },
  { label: 'Month 18', b2cMRR: '$13,000', b2bMRR: '$24,000', totalMRR: '$37,000',  arr: '$444,000'  },
  { label: 'Month 24', b2cMRR: '$22,250', b2bMRR: '$41,725', totalMRR: '$63,975',  arr: '$767,700'  },
]

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

export function getProvider(currency: Currency): 'paystack' | 'lemonsqueezy' {
  return currency === 'ngn' ? 'paystack' : 'lemonsqueezy'
}
