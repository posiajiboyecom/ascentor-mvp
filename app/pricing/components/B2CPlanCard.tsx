'use client'

// app/pricing/components/B2CPlanCard.tsx — v5
// FIX 1: Free plan → /dashboard (not /signup)
// FIX 2: Paid plans → /checkout?plan=X&billing=Y (not inline Paystack on pricing page)
//         → eliminates the infinite "Loading…" caused by auth redirect not resetting state
// FIX 3: Unauthenticated users clicking paid plans → /signup?plan=X (they need an account first)

import { B2CTier, BillingCycle, Currency, formatPrice, getAnnualLabel } from '../data'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

interface Props {
  tier: B2CTier
  currency: Currency
  billing: BillingCycle
}

const STAGE_COLOR: Record<string, string> = {
  free:    'rgba(232,160,32,0.4)',
  builder: 'var(--teal,    #14B8A6)',
  pro:     'var(--gold,    #E8A020)',
  elite:   'var(--purple,  #8B5CF6)',
}

export default function B2CPlanCard({ tier, currency, billing }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

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

  async function handleCTA() {
    // Climber → email enquiry
    if (tier.id === 'elite') {
      window.location.href = 'mailto:hello@ascentorbi.com?subject=Climber Plan Enquiry'
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // FIX: Free plan → dashboard directly (gating handles restrictions)
      if (isFree) {
        if (user) {
          router.push('/dashboard')
        } else {
          router.push('/signup?plan=free')
        }
        return
      }

      // FIX: Paid plans → don't trigger Paystack here on pricing page.
      // Route to checkout page instead. This removes the infinite loading
      // caused by auth redirect not resetting the loading state.
      if (!user) {
        // Not logged in → signup first, checkout after
        router.push(`/signup?plan=${tier.id}&billing=${billing}`)
        return
      }

      // Logged in → go straight to checkout with plan pre-selected
      router.push(`/checkout?plan=${tier.id}&billing=${billing === 'annual' ? 'yearly' : 'monthly'}`)
    } catch {
      setLoading(false)
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
        {loading ? 'One moment…' : tier.ctaLabel}
      </button>
    </div>
  )
}
