'use client'

// app/pricing/components/B2BPlanCard.tsx — v3
// Full Ascentor dark-gold branding.
// ALL CTAs lead to demo.ascentorbi.com — users must pay or contact admin to unlock.
// Enterprise → contact email directly.

import { B2BTier, BillingCycle } from '../data'

interface Props {
  tier: B2BTier
  billing: BillingCycle
}

// The demo URL — users land here, see a paywall/contact prompt before use
const DEMO_URL = 'https://demo.ascentorbi.com'
const CONTACT_EMAIL = 'partners@ascentorbi.com'

export default function B2BPlanCard({ tier, billing }: Props) {
  const isCustom = tier.flatMonthly === null

  // Annual flat price (15% off)
  const annualFlat = tier.flatMonthly
    ? Math.round(tier.flatMonthly * 12 * 0.85)
    : null

  function handleCTA() {
    if (tier.id === 'enterprise') {
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=Enterprise Partner Enquiry`
      return
    }
    // Studio + Academy → live demo with payment gate
    window.open(DEMO_URL, '_blank', 'noopener,noreferrer')
  }

  const isHot = tier.hot

  return (
    <>
      <style>{`
        .b2b-card {
          position: relative;
          display: flex;
          flex-direction: column;
          border-radius: 18px;
          padding: 26px 22px 22px;
          border: 1px solid rgba(212,207,195,0.12);
          background: #141310;
          transition: border-color 0.18s, transform 0.18s;
        }
        .b2b-card:hover { border-color: rgba(232,160,32,0.28); }
        .b2b-card.hot {
          border-color: #E8A020;
          background: #1A1813;
          transform: scale(1.025);
          box-shadow: 0 0 0 1px rgba(232,160,32,0.35), 0 8px 40px rgba(232,160,32,0.10);
        }
        .b2b-badge {
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
        .b2b-label {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #4A4438;
          margin-bottom: 4px;
        }
        .b2b-name {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 22px;
          font-weight: 700;
          color: #F7F6F3;
          margin-bottom: 18px;
        }
        .b2b-price {
          font-family: 'Syne', sans-serif;
          font-size: 36px;
          font-weight: 800;
          color: #F7F6F3;
          line-height: 1;
        }
        .b2b-price-unit { font-size: 12px; color: #4A4438; font-family: 'DM Mono', monospace; }
        .b2b-seat-note { font-size: 12px; color: #8A8272; margin-top: 6px; }
        .b2b-seat-note strong { color: #C8C3B8; font-weight: 600; }
        .b2b-capacity { font-size: 11px; color: #4A4438; font-family: 'DM Mono', monospace; margin-top: 4px; }
        .b2b-annual-note { font-size: 11px; color: #14B8A6; font-family: 'DM Mono', monospace; margin-top: 4px; min-height: 16px; }
        .b2b-divider {
          height: 1px;
          background: rgba(212,207,195,0.10);
          margin: 18px 0;
        }
        .b2b-features { list-style: none; flex: 1; margin-bottom: 22px; display: flex; flex-direction: column; gap: 9px; }
        .b2b-feat { display: flex; align-items: flex-start; gap: 9px; font-size: 12px; line-height: 1.45; }
        .b2b-feat-on  { color: #C8C3B8; }
        .b2b-feat-off { color: #2E2A22; text-decoration: line-through; }
        .b2b-check {
          width: 14px; height: 14px; flex-shrink: 0; margin-top: 1px;
          border-radius: 50%; background: rgba(20,184,166,0.15);
          border: 1px solid rgba(20,184,166,0.4);
          display: flex; align-items: center; justify-content: center;
        }
        .b2b-check-tick { width: 7px; height: 7px; border-radius: 50%; background: #14B8A6; }
        .b2b-dash {
          width: 14px; height: 14px; flex-shrink: 0; margin-top: 1px;
          border-radius: 50%; background: #1E1C17;
          border: 1px solid rgba(212,207,195,0.08);
          display: flex; align-items: center; justify-content: center;
        }
        .b2b-dash-line { width: 6px; height: 1px; background: #2E2A22; }
        .b2b-cta {
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
        .b2b-cta.primary { background: #E8A020; color: #0C0B08; }
        .b2b-cta.primary:hover { background: #F5C55A; }
        .b2b-cta.secondary {
          background: transparent;
          border: 1px solid rgba(212,207,195,0.2);
          color: #C8C3B8;
        }
        .b2b-cta.secondary:hover {
          border-color: rgba(232,160,32,0.45);
          color: #E8A020;
        }
        .b2b-demo-hint {
          text-align: center;
          font-size: 10px;
          color: #4A4438;
          font-family: 'DM Mono', monospace;
          margin-top: 8px;
          letter-spacing: 0.03em;
        }
      `}</style>

      <div className={`b2b-card${isHot ? ' hot' : ''}`}>
        {tier.badge && <div className="b2b-badge">{tier.badge}</div>}

        <p className="b2b-label">{tier.label}</p>
        <p className="b2b-name">{tier.name}</p>

        <div>
          <span className="b2b-price">
            {isCustom ? 'Custom' : (
              billing === 'annual' && annualFlat
                ? `$${annualFlat}`
                : `$${tier.flatMonthly}`
            )}
          </span>
          {!isCustom && (
            <span className="b2b-price-unit">
              {billing === 'annual' ? '/yr' : '/mo flat'}
            </span>
          )}
        </div>

        {!isCustom && tier.seatPrice !== null && (
          <p className="b2b-seat-note">
            + <strong>${tier.seatPrice}/seat</strong> per active member
          </p>
        )}

        <p className="b2b-capacity">{tier.maxSeats}</p>

        <p className="b2b-annual-note">
          {billing === 'annual' && !isCustom
            ? tier.annualText
            : billing === 'monthly' && !isCustom
              ? 'Save 15% with annual billing'
              : tier.annualText}
        </p>

        <div className="b2b-divider" />

        <ul className="b2b-features">
          {tier.features.map((feat, i) => (
            <li key={i} className={`b2b-feat ${feat.enabled ? 'b2b-feat-on' : 'b2b-feat-off'}`}>
              {feat.enabled ? (
                <span className="b2b-check"><span className="b2b-check-tick" /></span>
              ) : (
                <span className="b2b-dash"><span className="b2b-dash-line" /></span>
              )}
              {feat.text}
            </li>
          ))}
        </ul>

        <button onClick={handleCTA} className={`b2b-cta ${tier.ctaVariant}`}>
          {tier.id === 'enterprise' ? 'Contact us' : 'Explore demo →'}
        </button>

        {tier.id !== 'enterprise' && (
          <p className="b2b-demo-hint">
            Subscription or admin approval required to unlock
          </p>
        )}
      </div>
    </>
  )
}
