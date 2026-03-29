'use client'

// app/pricing/PricingClient.tsx — v3
// • Full Ascentor brand (dark bg, gold accent, Cormorant + Syne fonts)
// • Auto-detects currency from server (x-currency header via proxy)
// • Non-NG users see USD prices; all payments still via Paystack (NGN equiv)
// • No Revenue Model tab, no Pricing Rationale sections
// • "For your organisation" CTAs → demo.ascentorbi.com with payment gate

import { useState } from 'react'
import { B2C_TIERS, type Currency, type BillingCycle } from './data'
import B2CPlanCard from './components/B2CPlanCard'

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
              B2B TAB — demo invite, no public pricing grid
          ════════════════════════════════════════════ */}
          {tab === 'b2b' && (
            <div style={{ maxWidth: 720, margin: '0 auto' }}>

              {/* Eyebrow */}
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.18em', color: '#E8A020', textTransform: 'uppercase', marginBottom: 20, textAlign: 'center' }}>
                White-label partner platform
              </p>

              {/* Headline */}
              <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700, color: '#F7F6F3', textAlign: 'center', lineHeight: 1.1, marginBottom: 20 }}>
                Your brand. Our infrastructure.<br />
                <span style={{ color: '#E8A020' }}>Built to scale.</span>
              </h2>

              <p style={{ fontSize: 14, color: '#8A8272', textAlign: 'center', lineHeight: 1.7, marginBottom: 40 }}>
                Deploy a fully branded coaching and community platform for your team, alumni network, or institution &mdash; powered by Ascentor&rsquo;s AI. Plans are available for solo coaches through to large enterprises, with pricing tailored to your scale.
              </p>

              {/* Feature highlights */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 40 }}>
                {[
                  { icon: '◈', label: 'Branded subdomain', desc: 'Your name, your platform' },
                  { icon: '◈', label: 'AI coaching suite', desc: 'Content, intel & personal brand agents' },
                  { icon: '◈', label: 'Community & courses', desc: 'Cohorts, discussions, learning paths' },
                  { icon: '◈', label: 'Payment collection', desc: 'Charge your members directly' },
                  { icon: '◈', label: 'Admin dashboard', desc: 'Full visibility on engagement' },
                  { icon: '◈', label: 'Custom domain', desc: 'Available on growing plans' },
                ].map(f => (
                  <div key={f.label} style={{ background: '#141310', border: '1px solid rgba(212,207,195,0.10)', borderRadius: 12, padding: '16px 18px' }}>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#E8A020', letterSpacing: '0.1em', marginBottom: 6 }}>{f.icon} {f.label.toUpperCase()}</p>
                    <p style={{ fontSize: 12, color: '#8A8272', lineHeight: 1.5 }}>{f.desc}</p>
                  </div>
                ))}
              </div>

              {/* Demo CTA card */}
              <div style={{ background: 'linear-gradient(135deg, rgba(232,160,32,0.10), rgba(139,92,246,0.07))', border: '1px solid rgba(232,160,32,0.25)', borderRadius: 18, padding: '32px 36px', marginBottom: 20, textAlign: 'center' }}>
                <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 700, color: '#F7F6F3', marginBottom: 10 }}>
                  See it live before you commit
                </p>
                <p style={{ fontSize: 13, color: '#8A8272', lineHeight: 1.65, marginBottom: 28, maxWidth: 480, margin: '0 auto 28px' }}>
                  Explore a fully working demo of the Ascentor partner platform &mdash; white-label branding, AI coaching, community, and member payment flows &mdash; exactly as your members will experience it.
                </p>
                <a
                  href="https://demo.ascentorbi.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-block', padding: '13px 32px', borderRadius: 10, background: '#E8A020', color: '#0C0B08', fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, textDecoration: 'none', transition: 'background 0.15s' }}
                >
                  Visit demo.ascentorbi.com →
                </a>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#4A4438', marginTop: 12, letterSpacing: '0.04em' }}>
                  Access requires approval from Team Ascentor
                </p>
              </div>

              {/* Contact card */}
              <div style={{ background: '#141310', border: '1px solid rgba(212,207,195,0.10)', borderRadius: 14, padding: '22px 28px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#4A4438', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Ready to discuss?</p>
                  <p style={{ fontSize: 13, color: '#C8C3B8', lineHeight: 1.5 }}>
                    Contact Team Ascentor to get pricing, request demo access, or book a discovery call.
                  </p>
                </div>
                <a
                  href="mailto:asamuel@ascentorbi.com?subject=Organisation Plan Enquiry"
                  style={{ display: 'inline-block', padding: '10px 22px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(232,160,32,0.4)', color: '#E8A020', fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                  asamuel@ascentorbi.com
                </a>
              </div>

            </div>
          )}

        </div>
      </div>
    </>
  )
}
