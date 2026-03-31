'use client'

// app/pricing/components/B2CPlanCard.tsx — v3
// Styled using Ascentor brand tokens from globals.css (var(--gold), var(--bg-card), etc.)
// Plan display names come from data.ts — ids are unchanged (used by Supabase/Paystack).

import { B2CTier, BillingCycle, Currency, formatPrice, getAnnualLabel } from '../data'
import { useRouter } from 'next/navigation'
import { useCheckout } from './useCheckout'

interface Props {
  tier: B2CTier
  currency: Currency
  billing: BillingCycle
}

// Stage accent colours matching globals.css --explorer, --builder, --climber
// Free has no stage colour so we use a neutral gold-muted
const STAGE_COLOR: Record<string, string> = {
  free:    'rgba(232,160,32,0.35)',
  builder: 'var(--explorer)',   // id=builder → display=Explorer → teal
  pro:     'var(--builder)',    // id=pro      → display=Builder  → gold
  elite:   'var(--climber)',    // id=elite    → display=Climber  → purple
}

export default function B2CPlanCard({ tier, currency, billing }: Props) {
  const { initiateCheckout, loading } = useCheckout()
  const router = useRouter()

  const monthlyPrice = tier.priceMonthly[currency]
  const isFree       = monthlyPrice === 0
  const isHot        = tier.hot
  const accentColor  = STAGE_COLOR[tier.id] || 'var(--gold)'

  // Displayed price
  const displayedPrice = (() => {
    if (isFree) return formatPrice(0, currency)
    if (billing === 'annual' && tier.annualTotal[currency]) {
      const monthlyEquiv = Math.round(tier.annualTotal[currency]! / 12)
      return formatPrice(monthlyEquiv, currency)
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
        paystackPlanCode: billing === 'annual' ? tier.paystackPlanCode.annual : tier.paystackPlanCode.monthly,
      })
    } else {
      initiateCheckout({
        planName: tier.name, currency, billing,
        lemonVariantId: billing === 'annual' ? tier.lemonVariantId.annual : tier.lemonVariantId.monthly,
      })
    }
  }

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      borderRadius: 20,
      padding: '28px 24px',
      background: isHot ? 'var(--bg-card)' : 'var(--bg-card)',
      border: isHot
        ? `1.5px solid ${accentColor}`
        : '1px solid var(--border)',
      boxShadow: isHot ? `0 0 0 1px ${accentColor}22, 0 8px 32px rgba(0,0,0,0.4)` : 'none',
      transform: isHot ? 'translateY(-4px)' : 'none',
      transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
    }}>

      {/* Top accent bar */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 3,
        borderRadius: '20px 20px 0 0',
        background: isHot
          ? `linear-gradient(90deg, ${accentColor}, transparent)`
          : 'transparent',
      }} />

      {/* Badge */}
      {tier.badge && (
        <div style={{
          position: 'absolute',
          top: -13,
          left: '50%',
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
          background: 'var(--gold)',
          color: 'var(--dark)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          padding: '3px 14px',
          borderRadius: 999,
          fontFamily: 'var(--font-ui)',
        }}>
          {tier.badge}
        </div>
      )}

      {/* Label + name */}
      <div style={{ marginBottom: 16 }}>
        <p style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          margin: '0 0 5px',
          fontFamily: 'var(--font-ui)',
        }}>
          {tier.label}
        </p>
        <p style={{
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--text)',
          margin: 0,
          fontFamily: 'var(--font-display)',
        }}>
          {tier.name}
        </p>
      </div>

      {/* Price */}
      <div style={{ marginBottom: 4 }}>
        <span style={{
          fontSize: 38,
          fontWeight: 700,
          color: 'var(--text)',
          fontFamily: 'var(--font-display)',
          letterSpacing: '-1px',
          lineHeight: 1,
        }}>
          {displayedPrice}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-dim)', marginLeft: 4, fontFamily: 'var(--font-ui)' }}>
          {isFree ? 'forever' : '/mo'}
        </span>
      </div>

      {/* Annual savings line */}
      <p style={{
        minHeight: 18,
        fontSize: 11,
        color: 'var(--success)',
        margin: '0 0 20px',
        fontFamily: 'var(--font-ui)',
      }}>
        {annualLine}
      </p>

      <div style={{
        height: 1,
        background: 'var(--border)',
        marginBottom: 16,
      }} />

      {/* Features */}
      <ul style={{ flex: 1, margin: '0 0 20px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {tier.features.map((feat, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
            {feat.enabled ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1, opacity: 0.4 }}>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            )}
            <span style={{
              color: feat.enabled ? 'var(--text-muted)' : 'var(--text-dim)',
              textDecoration: feat.enabled ? 'none' : 'line-through',
              opacity: feat.enabled ? 1 : 0.5,
              fontFamily: 'var(--font-ui)',
              lineHeight: 1.5,
            }}>
              {feat.text}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={handleCTA}
        disabled={loading}
        style={{
          width: '100%',
          padding: '11px 20px',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 700,
          fontFamily: 'var(--font-ui)',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
          transition: 'opacity 0.15s, transform 0.1s',
          border: 'none',
          ...(tier.ctaVariant === 'primary'
            ? { background: 'var(--gold)', color: 'var(--dark)' }
            : { background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' }
          ),
        }}
      >
        {loading ? 'Loading…' : tier.ctaLabel}
      </button>
    </div>
  )
}
