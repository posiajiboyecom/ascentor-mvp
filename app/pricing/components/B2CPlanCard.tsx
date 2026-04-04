'use client'

// ================================================================
// B2CPlanCard.tsx  — PAYMENT SYSTEM v4 (HOSTED PAGE)
// ================================================================
// Removed usePaystack() — now uses direct fetch + window.location
// redirect to Paystack hosted payment page. No popup, no CSP.
// ================================================================

import { useState } from 'react'
import { B2CTier, BillingCycle, Currency, formatPrice, getAnnualLabel } from '../data'
import { useRouter } from 'next/navigation'

interface Props {
  tier:     B2CTier
  currency: Currency
  billing:  BillingCycle
}

const STAGE_COLOR: Record<string, string> = {
  free:    'rgba(232,160,32,0.4)',
  builder: 'var(--teal,   #14B8A6)',
  pro:     'var(--gold,   #E8A020)',
  elite:   'var(--purple, #8B5CF6)',
}

// Map data.ts tier IDs → /api/pay/start plan IDs
const PLAN_ID_MAP: Record<string, string> = {
  builder:  'explorer',
  pro:      'builder',
  elite:    'climber',
  explorer: 'explorer',
  climber:  'climber',
}

export default function B2CPlanCard({ tier, currency, billing }: Props) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
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

  async function handleCTA() {
    setError(null)

    if (isFree) {
      router.push('/signup?plan=free')
      return
    }

    const resolvedPlanId = PLAN_ID_MAP[tier.id] ?? tier.id

    setLoading(true)
    try {
      const res = await fetch('/api/pay/start', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ planId: resolvedPlanId, billing }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Payment setup failed (${res.status})`)
      }

      const { authorizationUrl, error: apiError } = await res.json()
      if (apiError) throw new Error(apiError)
      if (!authorizationUrl) throw new Error('No payment URL returned. Please try again.')

      // Full page redirect — Paystack hosts the payment page
      window.location.href = authorizationUrl

    } catch (err: any) {
      console.error('[B2CPlanCard]', err)
      setError(err.message || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div
      className={`pr-card ${tier.hot ? 'pr-card-hot' : ''}`}
      style={{
        borderColor: tier.hot ? accentColor : undefined,
        boxShadow:   tier.hot
          ? `0 0 0 1px ${accentColor}22, 0 8px 32px rgba(0,0,0,0.4)`
          : undefined,
      }}
    >
      <div
        className="pr-card-bar"
        style={{
          background: tier.hot
            ? `linear-gradient(90deg, ${accentColor}, transparent)`
            : 'transparent',
        }}
      />

      {tier.badge && <div className="pr-badge">{tier.badge}</div>}

      <p className="pr-card-label">{tier.label}</p>
      <p className="pr-card-name">{tier.name}</p>

      <div>
        <span className="pr-card-price">{displayedPrice}</span>
        <span className="pr-card-per">{isFree ? 'forever' : '/mo'}</span>
      </div>

      <p className="pr-card-savings">{annualLine}</p>
      <div className="pr-card-divider" />

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

      {error && (
        <p style={{
          fontSize: '11px',
          color: 'var(--error, #EF4444)',
          margin: '0 0 8px',
          fontFamily: 'var(--font-ui)',
        }}>
          {error}
        </p>
      )}

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
        {loading ? 'Redirecting to payment…' : tier.ctaLabel}
      </button>
    </div>
  )
}
