'use client'

// components/pricing/B2CPlanCard.tsx
import { B2CTier, BillingCycle, Currency, formatPrice, getAnnualLabel } from '../data'
import { CheckCircle2, MinusCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCheckout } from './useCheckout'

interface Props {
  tier: B2CTier
  currency: Currency
  billing: BillingCycle
}

export default function B2CPlanCard({ tier, currency, billing }: Props) {
  const { initiateCheckout, loading } = useCheckout()
  const router = useRouter()

  const monthlyPrice = tier.priceMonthly[currency]
  const isFree = monthlyPrice === 0

  // Displayed price — if annual, show the monthly equivalent
  const displayedPrice = (() => {
    if (isFree) return formatPrice(0, currency)
    if (billing === 'annual' && tier.annualTotal[currency]) {
      const monthlyEquiv = Math.round(tier.annualTotal[currency]! / 12)
      return formatPrice(monthlyEquiv, currency)
    }
    return formatPrice(monthlyPrice, currency)
  })()

  const annualLabel = billing === 'annual' ? getAnnualLabel(tier, currency) : ''

  function handleCTA() {
    if (isFree) {
      router.push('/signup')
      return
    }
    if (tier.id === 'elite') {
      window.location.href = 'mailto:hello@ascentorbi.com?subject=Elite Plan Enquiry'
      return
    }
    const planCode = billing === 'annual'
      ? tier.paystackPlanCode[currency].annual
      : tier.paystackPlanCode[currency].monthly
    initiateCheckout({ planCode, planName: tier.name, currency })
  }

  return (
    <div
      className={[
        'relative flex flex-col rounded-2xl border p-6 transition-all duration-200',
        tier.hot
          ? 'border-foreground bg-background shadow-lg scale-[1.02]'
          : 'border-border bg-card hover:border-foreground/40',
      ].join(' ')}
    >
      {tier.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-foreground px-3 py-0.5 text-[10px] font-medium uppercase tracking-wider text-background">
          {tier.badge}
        </div>
      )}

      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{tier.label}</p>
        <p className="text-sm font-semibold text-foreground">{tier.name}</p>
      </div>

      <div className="mb-1">
        <span className="text-4xl font-bold tracking-tight text-foreground">{displayedPrice}</span>
        {!isFree && (
          <span className="ml-1 text-sm text-muted-foreground">/mo</span>
        )}
        {isFree && (
          <span className="ml-1 text-sm text-muted-foreground">forever</span>
        )}
      </div>

      <p className="mb-5 min-h-[18px] text-[11px] text-emerald-600 dark:text-emerald-400">
        {annualLabel || (billing === 'monthly' && !isFree
          ? `${getAnnualLabel(tier, currency).replace(/\·.*/, '').trim()} if billed annually`
          : ''
        )}
      </p>

      <hr className="mb-4 border-border" />

      <ul className="mb-6 flex-1 space-y-2">
        {tier.features.map((feat, i) => (
          <li key={i} className="flex items-start gap-2 text-[12px]">
            {feat.enabled ? (
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-500" />
            ) : (
              <MinusCircle size={13} className="mt-0.5 shrink-0 text-muted-foreground/40" />
            )}
            <span className={feat.enabled ? 'text-foreground' : 'text-muted-foreground/50 line-through decoration-1'}>
              {feat.text}
            </span>
          </li>
        ))}
      </ul>

      <button
        onClick={handleCTA}
        disabled={loading}
        className={[
          'w-full rounded-xl py-2.5 text-[13px] font-medium transition-all duration-150',
          tier.ctaVariant === 'primary'
            ? 'bg-foreground text-background hover:opacity-90'
            : 'border border-border bg-transparent text-foreground hover:bg-muted',
          loading ? 'opacity-60 cursor-not-allowed' : '',
        ].join(' ')}
      >
        {loading ? 'Loading…' : tier.ctaLabel}
      </button>
    </div>
  )
}
