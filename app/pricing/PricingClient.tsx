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

        /* ── b2b note ── */
        .pr-b2b-note {
          font-size: 12px;
          color: #8A8272;
          margin-bottom: 24px;
          font-family: 'DM Mono', monospace;
          letter-spacing: 0.02em;
        }
        .pr-b2b-demo-banner {
          background: linear-gradient(135deg, rgba(232,160,32,0.10), rgba(139,92,246,0.08));
          border: 1px solid rgba(232,160,32,0.22);
          border-radius: 16px;
          padding: 28px 32px;
          margin-top: 36px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }
        .pr-b2b-demo-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 22px;
          font-weight: 700;
          color: #F7F6F3;
          margin-bottom: 6px;
        }
        .pr-b2b-demo-sub {
          font-size: 13px;
          color: #8A8272;
          max-width: 420px;
          line-height: 1.55;
        }
        .pr-b2b-demo-btn {
          padding: 12px 28px;
          border-radius: 10px;
          background: #E8A020;
          color: #0C0B08;
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: background 0.15s, transform 0.12s;
          white-space: nowrap;
          text-decoration: none;
          display: inline-block;
        }
        .pr-b2b-demo-btn:hover { background: #F5C55A; transform: translateY(-1px); }

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
              B2B TAB
          ════════════════════════════════════════════ */}
          {tab === 'b2b' && (
            <div>
              <p className="pr-b2b-note">
                All partner plans priced in USD · Partners collect member revenue in any currency
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
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

              <div className="pr-grid-3">
                {B2B_TIERS.map(tier => (
                  <B2BPlanCard key={tier.id} tier={tier} billing={billing} />
                ))}
              </div>

              {/* Demo CTA banner */}
              <div className="pr-b2b-demo-banner">
                <div>
                  <p className="pr-b2b-demo-title">See it live before you commit</p>
                  <p className="pr-b2b-demo-sub">
                    Explore a fully working demo of the Ascentor partner platform &mdash;
                    white-label branding, AI coaching, community, and payment flows &mdash;
                    exactly as your members will experience it.
                    An active subscription or admin approval is required to access.
                  </p>
                </div>
                <a
                  href="https://demo.ascentorbi.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pr-b2b-demo-btn"
                >
                  View live demo →
                </a>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
