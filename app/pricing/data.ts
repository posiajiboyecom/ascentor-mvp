// app/pricing/data.ts — v4
// Plan display names updated: Starter→Free, Builder→Explorer, Pro→Builder, Elite→Climber
// Backend IDs (id field) are UNCHANGED — they map to subscription_plan in Supabase.
// Currency is auto-detected server-side via x-currency header (NG→ngn, rest→usd).

export type Currency = 'ngn' | 'usd'
export type BillingCycle = 'monthly' | 'annual'

export interface PlanFeature {
  enabled: boolean
  text: string
}

// ─────────────────────────────────────────────────────────────────────────────
// B2C TYPES
// ─────────────────────────────────────────────────────────────────────────────
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
// B2B TYPES
// ─────────────────────────────────────────────────────────────────────────────
export interface B2BTier {
  id: string
  name: string
  label: string
  flatMonthly: number | null        // null = custom/enterprise pricing
  seatPrice: number | null          // per active member on top of flat fee
  maxSeats: string                  // e.g. "Up to 50 members"
  annualText: string                // e.g. "Save $200/yr billed annually"
  hot: boolean
  badge: string
  ctaLabel: string
  ctaVariant: 'primary' | 'secondary'
  // Lemonsqueezy variant IDs (USD) — paste from LS dashboard
  lemonVariantId: {
    monthly: string
    annual: string
  }
  features: PlanFeature[]
}

// ─────────────────────────────────────────────────────────────────────────────
// B2C TIERS
// ─────────────────────────────────────────────────────────────────────────────
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
// B2B TIERS
// ─────────────────────────────────────────────────────────────────────────────
export const B2B_TIERS: B2BTier[] = [
  {
    id: 'partner_starter',
    name: 'Starter Partner',
    label: 'For small communities',
    flatMonthly: 199,
    seatPrice: 5,
    maxSeats: 'Up to 50 active members',
    annualText: 'Save $398/yr billed annually',
    hot: false,
    badge: '',
    ctaLabel: 'Get started',
    ctaVariant: 'secondary',
    // ↓ paste from Lemonsqueezy dashboard
    lemonVariantId: { monthly: '', annual: '' },
    features: [
      { enabled: true,  text: 'Branded AI coaching (Sage)' },
      { enabled: true,  text: 'Community dashboard' },
      { enabled: true,  text: 'Up to 50 members' },
      { enabled: true,  text: 'Basic analytics' },
      { enabled: false, text: 'White-label mobile app' },
      { enabled: false, text: 'Dedicated success manager' },
    ],
  },
  {
    id: 'partner_growth',
    name: 'Growth Partner',
    label: 'For scaling communities',
    flatMonthly: 499,
    seatPrice: 4,
    maxSeats: 'Up to 200 active members',
    annualText: 'Save $998/yr billed annually',
    hot: true,
    badge: 'Most popular',
    ctaLabel: 'Start 14-day trial',
    ctaVariant: 'primary',
    // ↓ paste from Lemonsqueezy dashboard
    lemonVariantId: { monthly: '', annual: '' },
    features: [
      { enabled: true,  text: 'Everything in Starter' },
      { enabled: true,  text: 'Up to 200 members' },
      { enabled: true,  text: 'Advanced analytics + cohort tracking' },
      { enabled: true,  text: 'Custom learning paths' },
      { enabled: true,  text: 'White-label mobile app' },
      { enabled: false, text: 'Dedicated success manager' },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    label: 'For large organisations',
    flatMonthly: null,
    seatPrice: null,
    maxSeats: 'Unlimited members',
    annualText: 'Custom pricing — contact us',
    hot: false,
    badge: '',
    ctaLabel: 'Contact us',
    ctaVariant: 'secondary',
    lemonVariantId: { monthly: '', annual: '' },
    features: [
      { enabled: true, text: 'Everything in Growth' },
      { enabled: true, text: 'Unlimited members' },
      { enabled: true, text: 'SLA guarantee' },
      { enabled: true, text: 'Dedicated success manager' },
      { enabled: true, text: 'Custom integrations' },
      { enabled: true, text: 'On-site onboarding' },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// REVENUE MODEL ROWS (used by RevenueModel.tsx — Combined trajectory table)
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
