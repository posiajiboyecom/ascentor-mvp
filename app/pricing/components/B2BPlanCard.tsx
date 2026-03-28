'use client'

// components/pricing/B2BPlanCard.tsx
import { B2BTier, BillingCycle } from '../data'
import { CheckCircle2, MinusCircle } from 'lucide-react'
import { useCheckout } from './useCheckout'

interface Props {
  tier: B2BTier
  billing: BillingCycle
}

export default function B2BPlanCard({ tier, billing }: Props) {
  const { initiateCheckout, loading } = useCheckout()
  const isCustom = tier.flatMonthly === null

  function handleCTA() {
    if (isCustom || tier.id === 'enterprise') {
      window.location.href = 'mailto:asamuel@ascentorbi.com?subject=Enterprise Partner Enquiry'
      return
    }
    initiateCheckout({
      planName: `${tier.name} Partner`,
      currency: 'usd',
      billing,
      paystackPlanCode: billing === 'annual'
        ? tier.paystackPlanCode.annual
        : tier.paystackPlanCode.monthly,
    })
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

      {/* Pricing display */}
      <div className="mb-1">
        <span className="text-4xl font-bold tracking-tight text-foreground">
          {isCustom ? 'Custom' : `$${tier.flatMonthly}`}
        </span>
        {!isCustom && <span className="ml-1 text-sm text-muted-foreground">/mo flat</span>}
      </div>

      {!isCustom && tier.seatPrice !== null && (
        <p className="mb-1 text-[12px] text-muted-foreground">
          + <span className="font-medium text-foreground">${tier.seatPrice}/seat</span> per active member
        </p>
      )}

      <p className="mb-1 text-[11px] text-muted-foreground">{tier.maxSeats}</p>

      <p className="mb-5 min-h-[18px] text-[11px] text-emerald-600 dark:text-emerald-400">
        {tier.annualText}
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
