'use client'

// app/pricing/components/B2CPlanCard.tsx — v3
// Full Ascentor dark-gold branding. No Tailwind dependency for card chrome.
// USD users are still charged via Paystack (NGN equivalent at live rate).

import { B2CTier, BillingCycle, Currency, formatPrice, getAnnualLabel } from '../data'
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

  const displayedPrice = (() => {
    if (isFree) return currency === 'ngn' ? '₦0' : '$0'
    if (billing === 'annual' && tier.annualTotal[currency]) {
      const equiv = Math.round(tier.annualTotal[currency]! / 12)
      return formatPrice(equiv, currency)
    }
    return formatPrice(monthlyPrice, currency)
  })()

  const annualSavingLine = billing === 'annual'
    ? getAnnualLabel(tier, currency)
    : ''

  function handleCTA() {
    if (isFree) { router.push('/signup'); return }
    if (tier.id === 'elite') {
      window.location.href = 'mailto:hello@ascentorbi.com?subject=Elite Plan Enquiry'
      return
    }
    // Both NGN and USD route through Paystack.
    // USD users: the /api/payments/initialize endpoint converts to NGN at live rate.
    initiateCheckout({
      planName: tier.name,
      currency,
      billing,
      paystackPlanCode: billing === 'annual'
        ? tier.paystackPlanCode.annual
        : tier.paystackPlanCode.monthly,
    })
  }

  const isHot = tier.hot

  return (
    <>
      <style>{`
        .b2c-card {
          position: relative;
          display: flex;
          flex-direction: column;
          border-radius: 18px;
          padding: 24px 22px 22px;
          border: 1px solid rgba(212,207,195,0.12);
          background: #141310;
          transition: border-color 0.18s, transform 0.18s;
        }
        .b2c-card:hover {
          border-color: rgba(232,160,32,0.28);
        }
        .b2c-card.hot {
          border-color: #E8A020;
          background: #1A1813;
          transform: scale(1.025);
          box-shadow: 0 0 0 1px rgba(232,160,32,0.35), 0 8px 40px rgba(232,160,32,0.10);
        }
        .b2c-badge {
          position: absolute;
          top: -13px;
          left: 50%;
          transform: translateX(-50%);
          background: #E8A020;
          color: #0C0B08;
          font-family: 'Syne', sans-serif;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          padding: 4px 14px;
          border-radius: 100px;
          white-space: nowrap;
        }
        .b2c-label {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #4A4438;
          margin-bottom: 4px;
        }
        .b2c-name {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 22px;
          font-weight: 700;
          color: #F7F6F3;
          margin-bottom: 20px;
        }
        .b2c-price-row { display: flex; align-items: baseline; gap: 4px; margin-bottom: 4px; }
        .b2c-price {
          font-family: 'Syne', sans-serif;
          font-size: 36px;
          font-weight: 800;
          color: #F7F6F3;
          line-height: 1;
        }
        .b2c-price-unit {
          font-size: 12px;
          color: #4A4438;
          font-family: 'DM Mono', monospace;
        }
        .b2c-annual-note {
          font-size: 11px;
          color: #14B8A6;
          font-family: 'DM Mono', monospace;
          min-height: 16px;
          margin-bottom: 20px;
          letter-spacing: 0.02em;
        }
        .b2c-divider {
          height: 1px;
          background: rgba(212,207,195,0.10);
          margin-bottom: 18px;
        }
        .b2c-features { list-style: none; flex: 1; margin-bottom: 22px; display: flex; flex-direction: column; gap: 9px; }
        .b2c-feat { display: flex; align-items: flex-start; gap: 9px; font-size: 12px; line-height: 1.45; }
        .b2c-feat-on  { color: #C8C3B8; }
        .b2c-feat-off { color: #2E2A22; text-decoration: line-through; }
        .b2c-check {
          width: 14px; height: 14px; flex-shrink: 0; margin-top: 1px;
          border-radius: 50%; background: rgba(20,184,166,0.15);
          border: 1px solid rgba(20,184,166,0.4);
          display: flex; align-items: center; justify-content: center;
        }
        .b2c-check-tick { width: 7px; height: 7px; border-radius: 50%; background: #14B8A6; }
        .b2c-dash {
          width: 14px; height: 14px; flex-shrink: 0; margin-top: 1px;
          border-radius: 50%; background: #1E1C17;
          border: 1px solid rgba(212,207,195,0.08);
          display: flex; align-items: center; justify-content: center;
        }
        .b2c-dash-line { width: 6px; height: 1px; background: #2E2A22; }
        .b2c-cta {
          width: 100%;
          padding: 11px 0;
          border-radius: 10px;
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
          border: none;
        }
        .b2c-cta.primary {
          background: #E8A020;
          color: #0C0B08;
        }
        .b2c-cta.primary:hover { background: #F5C55A; }
        .b2c-cta.secondary {
          background: transparent;
          border: 1px solid rgba(212,207,195,0.2);
          color: #C8C3B8;
        }
        .b2c-cta.secondary:hover {
          border-color: rgba(232,160,32,0.45);
          color: #E8A020;
        }
        .b2c-cta:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <div className={`b2c-card${isHot ? ' hot' : ''}`}>
        {tier.badge && <div className="b2c-badge">{tier.badge}</div>}

        <p className="b2c-label">{tier.label}</p>
        <p className="b2c-name">{tier.name}</p>

        <div className="b2c-price-row">
          <span className="b2c-price">{displayedPrice}</span>
          <span className="b2c-price-unit">
            {isFree ? 'forever' : '/mo'}
          </span>
        </div>

        <p className="b2c-annual-note">
          {annualSavingLine || (billing === 'monthly' && !isFree
            ? `${getAnnualLabel(tier, currency).split('·')[0]?.trim()} annually`
            : ''
          )}
        </p>

        <div className="b2c-divider" />

        <ul className="b2c-features">
          {tier.features.map((feat, i) => (
            <li key={i} className={`b2c-feat ${feat.enabled ? 'b2c-feat-on' : 'b2c-feat-off'}`}>
              {feat.enabled ? (
                <span className="b2c-check"><span className="b2c-check-tick" /></span>
              ) : (
                <span className="b2c-dash"><span className="b2c-dash-line" /></span>
              )}
              {feat.text}
            </li>
          ))}
        </ul>

        <button
          onClick={handleCTA}
          disabled={loading}
          className={`b2c-cta ${tier.ctaVariant}`}
        >
          {loading ? 'Loading…' : tier.ctaLabel}
        </button>
      </div>
    </>
  )
}
