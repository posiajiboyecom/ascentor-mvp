'use client'

// app/pricing/PricingClient.tsx — v3
// • Full Ascentor brand (dark bg, gold accent, Cormorant + Syne fonts)
// • Auto-detects currency from server (x-currency header via proxy)
// • Non-NG users see USD prices; all payments still via Paystack (NGN equiv)
// • No Revenue Model tab, no Pricing Rationale sections
// • "For your organisation" CTAs → demo.ascentorbi.com with payment gate

import { useState } from 'react'
import { B2C_TIERS, B2B_TIERS, type Currency, type BillingCycle } from './data'
import B2CPlanCard from './components/B2CPlanCard'
import B2BPlanCard from './components/B2BPlanCard'

type Tab = 'b2c' | 'b2b'

const TABS: { id: Tab; label: string }[] = [
  { id: 'b2c', label: 'For you' },
  { id: 'b2b', label: 'For your organisation' },
]

interface Props {
  defaultCurrency: Currency
  defaultCountry?: string
}

export default function PricingClient({ defaultCurrency, defaultCountry }: Props) {
  const [tab,      setTab]      = useState<Tab>('b2c')
  const [currency, setCurrency] = useState<Currency>(defaultCurrency)
  const [billing,  setBilling]  = useState<BillingCycle>('monthly')

  // Whether the visitor is outside Nigeria (auto-detected)
  const isGlobal = defaultCountry !== 'NG'

  return (
    <>
      {/* ── Brand fonts ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,700;1,600&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

        .pr-wrap {
          min-height: 100vh;
          background: #0C0B08;
          color: #F7F6F3;
          font-family: 'Syne', system-ui, sans-serif;
        }
        .pr-inner {
          max-width: 1100px;
          margin: 0 auto;
          padding: 64px 24px 100px;
        }

        /* ── header ── */
        .pr-eyebrow {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.2em;
          color: #E8A020;
          text-transform: uppercase;
          margin-bottom: 14px;
          text-align: center;
        }
        .pr-headline {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: clamp(38px, 5vw, 58px);
          font-weight: 700;
          line-height: 1.08;
          text-align: center;
          color: #F7F6F3;
          margin-bottom: 16px;
        }
        .pr-headline span { color: #E8A020; }
        .pr-sub {
          text-align: center;
          font-size: 14px;
          color: #8A8272;
          margin-bottom: 48px;
          line-height: 1.6;
        }

        /* ── tabs ── */
        .pr-tabs {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-bottom: 40px;
        }
        .pr-tab {
          padding: 8px 22px;
          border-radius: 100px;
          border: 1px solid rgba(212,207,195,0.16);
          background: transparent;
          color: #8A8272;
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.18s;
        }
        .pr-tab:hover { color: #F7F6F3; border-color: rgba(212,207,195,0.35); }
        .pr-tab.active {
          background: #E8A020;
          border-color: #E8A020;
          color: #0C0B08;
          font-weight: 700;
        }

        /* ── controls row ── */
        .pr-controls {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }
        .pr-currency-btns { display: flex; gap: 6px; }
        .pr-pill {
          padding: 6px 16px;
          border-radius: 100px;
          border: 1px solid rgba(212,207,195,0.16);
          background: transparent;
          color: #8A8272;
          font-family: 'Syne', sans-serif;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .pr-pill:hover { color: #F7F6F3; border-color: rgba(212,207,195,0.4); }
        .pr-pill.active {
          background: #1E1C17;
          border-color: rgba(232,160,32,0.5);
          color: #E8A020;
        }
        .pr-billing-toggle {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 3px;
          border-radius: 100px;
          border: 1px solid rgba(212,207,195,0.14);
          background: #1E1C17;
        }
        .pr-billing-btn {
          padding: 6px 16px;
          border-radius: 100px;
          border: none;
          background: transparent;
          color: #8A8272;
          font-family: 'Syne', sans-serif;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .pr-billing-btn.active {
          background: #E8A020;
          color: #0C0B08;
          font-weight: 700;
        }
        .pr-hint {
          font-size: 11px;
          color: #4A4438;
          margin-bottom: 28px;
          font-family: 'DM Mono', monospace;
          letter-spacing: 0.02em;
        }

        /* ── card grid ── */
        .pr-grid-4 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
        }
        .pr-grid-3 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 16px;
          max-width: 900px;
          margin: 0 auto;
        }

        /* ── geo notice ── */
        .pr-geo-notice {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(232,160,32,0.08);
          border: 1px solid rgba(232,160,32,0.2);
          border-radius: 10px;
          padding: 10px 16px;
          margin-bottom: 24px;
          font-size: 12px;
          color: #C8C3B8;
        }
        .pr-geo-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #E8A020;
          flex-shrink: 0;
        }

        @media (max-width: 640px) {
          .pr-controls { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <div className="pr-wrap">
        <div className="pr-inner">

          {/* ── Header ── */}
          <p className="pr-eyebrow">Pricing</p>
          <h1 className="pr-headline">
            Invest in your <span>career.</span>
          </h1>
          <p className="pr-sub">
            Cancel anytime · 7-day free trial on all paid plans
          </p>

          {/* ── Tabs ── */}
          <div className="pr-tabs">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`pr-tab${tab === t.id ? ' active' : ''}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ════════════════════════════════════════════
              B2C TAB
          ════════════════════════════════════════════ */}
          {tab === 'b2c' && (
            <div>
              {/* Auto-detected geo notice */}
              {isGlobal && (
                <div className="pr-geo-notice">
                  <span className="pr-geo-dot" />
                  <span>
                    We detected you&rsquo;re outside Nigeria &mdash; showing USD prices.
                    All payments are processed securely via Paystack at the current exchange rate.
                  </span>
                </div>
              )}

              {/* Controls */}
              <div className="pr-controls">
                <div className="pr-currency-btns">
                  {([
                    { val: 'ngn' as Currency, label: '₦ Nigeria' },
                    { val: 'usd' as Currency, label: '$ Global' },
                  ]).map(c => (
                    <button
                      key={c.val}
                      onClick={() => setCurrency(c.val)}
                      className={`pr-pill${currency === c.val ? ' active' : ''}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="pr-billing-toggle">
                  {([
                    { val: 'monthly' as BillingCycle, label: 'Monthly' },
                    { val: 'annual'  as BillingCycle, label: 'Annual · save 20%' },
                  ]).map(b => (
                    <button
                      key={b.val}
                      onClick={() => setBilling(b.val)}
                      className={`pr-billing-btn${billing === b.val ? ' active' : ''}`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="pr-hint">
                {currency === 'ngn'
                  ? '₦ Nigerian naira · Toggle to $ for global / diaspora pricing'
                  : '$ USD · Charged in NGN equivalent via Paystack at live exchange rate'}
              </p>

              <div className="pr-grid-4">
                {B2C_TIERS.map(tier => (
                  <B2CPlanCard
                    key={tier.id}
                    tier={tier}
                    currency={currency}
                    billing={billing}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════
              B2B TAB — full pricing cards + demo invite
          ════════════════════════════════════════════ */}
          {tab === 'b2b' && (
            <div>
              <p className="pr-hint" style={{ marginBottom: 24 }}>
                All partner plans priced in USD · Partners collect member revenue in any currency
              </p>

              {/* Billing toggle */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
                <div className="pr-billing-toggle">
                  {([
                    { val: 'monthly' as BillingCycle, label: 'Monthly' },
                    { val: 'annual'  as BillingCycle, label: 'Annual · save 15%' },
                  ]).map(b => (
                    <button
                      key={b.val}
                      onClick={() => setBilling(b.val)}
                      className={`pr-billing-btn${billing === b.val ? ' active' : ''}`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Plan cards */}
              <div className="pr-grid-3">
                {B2B_TIERS.map(tier => (
                  <B2BPlanCard key={tier.id} tier={tier} billing={billing} />
                ))}
              </div>

              {/* Demo invite banner */}
              <div style={{
                marginTop: 40,
                background: 'linear-gradient(135deg, rgba(232,160,32,0.10), rgba(139,92,246,0.07))',
                border: '1px solid rgba(232,160,32,0.25)',
                borderRadius: 18,
                padding: '32px 36px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 24,
              }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.16em', color: '#E8A020', textTransform: 'uppercase', marginBottom: 10 }}>
                    Live demo
                  </p>
                  <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 700, color: '#F7F6F3', marginBottom: 10, lineHeight: 1.15 }}>
                    See it live before you commit
                  </p>
                  <p style={{ fontSize: 13, color: '#8A8272', lineHeight: 1.65, maxWidth: 440 }}>
                    Explore a fully working demo of the Ascentor partner platform &mdash;
                    white-label branding, AI coaching, community, and member payment flows.
                    Request access from Team Ascentor, and once approved you can log in and
                    explore the platform including full NGN pricing.
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <a
                    href="https://demo.ascentorbi.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-block', padding: '13px 30px', borderRadius: 10, background: '#E8A020', color: '#0C0B08', fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
                  >
                    Request demo access →
                  </a>
                  <a
                    href="mailto:asamuel@ascentorbi.com?subject=Organisation Plan Enquiry"
                    style={{ fontSize: 12, color: '#8A8272', fontFamily: "'DM Mono', monospace", textDecoration: 'none', letterSpacing: '0.02em' }}
                  >
                    asamuel@ascentorbi.com
                  </a>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
