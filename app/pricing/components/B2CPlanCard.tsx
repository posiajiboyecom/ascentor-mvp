'use client'

// app/pricing/components/B2CPlanCard.tsx — v4
// Uses CSS classes from PricingClient.tsx <style> block.
// No JS breakpoint detection — pure CSS media queries.

import { B2CTier, BillingCycle, Currency, formatPrice, getAnnualLabel } from '../data'
import { useRouter } from 'next/navigation'
import { useCheckout } from './useCheckout'

interface Props {
  tier: B2CTier
  currency: Currency
  billing: BillingCycle
}

const STAGE_COLOR: Record<string, string> = {
  free:    'rgba(232,160,32,0.4)',
  builder: 'var(--teal,    #14B8A6)',  // id=builder → display=Explorer
  pro:     'var(--gold,    #E8A020)',  // id=pro     → display=Builder
  elite:   'var(--purple,  #8B5CF6)',  // id=elite   → display=Climber
}

export default function B2CPlanCard({ tier, currency, billing }: Props) {
  const { initiateCheckout, loading } = useCheckout()
  const router = useRouter()

  const monthlyPrice = tier.priceMonthly[currency]
  const isFree       = monthlyPrice === 0
  const accentColor  = STAGE_COLOR[tier.id] || 'var(--gold, #E8A020)'

  const displayedPrice = (() => {
    if (isFree) return formatPrice(0, currency)
    if (billing === 'annual' && tier.annualTotal[currency]) {
      return formatPrice(Math.round(tier.annualTotal[currency]! / 12), currency)
    }
    return formatPrice(monthlyPrice, currency)
  })()

  const annualLine = billing === 'annual'
    ? getAnnualLabel(tier, currency)
    : (!isFree ? `${getAnnualLabel(tier, currency).replace(/·.*/, '').trim()} if billed annually` : '')

  function handleCTA() {
    if (isFree) { router.push('/signup'); return }
    if (tier.id === 'elite') {
      window.location.href = 'mailto:hello@ascentorbi.com?subject=Climber Plan Enquiry'
      return
    }
    if (currency === 'ngn') {
      initiateCheckout({
        planName: tier.name, currency, billing,
        paystackPlanCode: billing === 'annual'
          ? tier.paystackPlanCode.annual
          : tier.paystackPlanCode.monthly,
      })
    } else {
      initiateCheckout({
        planName: tier.name, currency, billing,
        lemonVariantId: billing === 'annual'
          ? tier.lemonVariantId.annual
          : tier.lemonVariantId.monthly,
      })
    }
  }

  return (
    <div
      className={`pr-card ${tier.hot ? 'pr-card-hot' : ''}`}
      style={{
        borderColor: tier.hot ? accentColor : undefined,
        boxShadow: tier.hot
          ? `0 0 0 1px ${accentColor}22, 0 8px 32px rgba(0,0,0,0.4)`
          : undefined,
      }}
    >
      {/* Accent top bar */}
      <div
        className="pr-card-bar"
        style={{
          background: tier.hot
            ? `linear-gradient(90deg, ${accentColor}, transparent)`
            : 'transparent',
        }}
      />

      {/* Badge */}
      {tier.badge && (
        <div className="pr-badge">{tier.badge}</div>
      )}

      {/* Label + name */}
      <p className="pr-card-label">{tier.label}</p>
      <p className="pr-card-name">{tier.name}</p>

      {/* Price */}
      <div>
        <span className="pr-card-price">{displayedPrice}</span>
        <span className="pr-card-per">{isFree ? 'forever' : '/mo'}</span>
      </div>

      {/* Annual savings */}
      <p className="pr-card-savings">{annualLine}</p>

      <div className="pr-card-divider" />

      {/* Features */}
      <ul className="pr-features">
        {tier.features.map((feat, i) => (
          <li key={i} className="pr-feature">
            <span className="pr-feature-icon">
              {feat.enabled ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="var(--success, #10B981)" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{ opacity: 0.3 }}>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              )}
            </span>
            <span className={feat.enabled ? 'pr-feature-on' : 'pr-feature-off'}>
              {feat.text}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={handleCTA}
        disabled={loading}
        className={`pr-cta ${tier.ctaVariant === 'primary' ? 'pr-cta-primary' : 'pr-cta-secondary'}`}
        style={
          tier.ctaVariant === 'secondary' && !isFree
            ? { color: accentColor, borderColor: `${accentColor}40` }
            : undefined
        }
      >
        {loading ? 'Loading…' : tier.ctaLabel}
      </button>
    </div>
  )
}
