'use client'

// app/pricing/PricingClient.tsx — v4 mobile-first
// Currency auto-detected server-side (x-currency header from proxy).
// Layout: single-column mobile → 2-col tablet → 4-col desktop.
// No JS-based isMobile detection — pure CSS media queries only.

import { useState } from 'react'
import { B2C_TIERS, Currency, BillingCycle } from './data'
import B2CPlanCard from './components/B2CPlanCard'
import PartnerEnquiry from './components/PartnerEnquiry'

type Tab = 'b2c' | 'b2b'

interface Props {
  defaultCurrency: Currency
  defaultCountry?: string
}

export default function PricingClient({ defaultCurrency }: Props) {
  const [tab,     setTab]     = useState<Tab>('b2c')
  const [billing, setBilling] = useState<BillingCycle>('monthly')
  const currency: Currency    = defaultCurrency

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600;1,700&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

        .pr-root {
          width: 100%;
          max-width: 1080px;
          margin: 0 auto;
          padding: 40px 16px 72px;
          font-family: var(--font-ui, 'Syne', sans-serif);
          box-sizing: border-box;
        }
        @media (min-width: 640px) {
          .pr-root { padding: 52px 24px 80px; }
        }

        /* ── Header ── */
        .pr-header {
          text-align: center;
          margin-bottom: 28px;
        }
        @media (min-width: 640px) {
          .pr-header { margin-bottom: 40px; }
        }
        .pr-eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--gold, #E8A020);
          margin: 0 0 10px;
          font-family: var(--font-ui);
        }
        .pr-heading {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: clamp(30px, 8vw, 52px);
          font-weight: 700;
          color: var(--text, #F7F6F3);
          margin: 0 0 10px;
          line-height: 1.1;
        }
        .pr-subhead {
          font-size: 14px;
          color: var(--text-dim, #8A8272);
          margin: 0;
          font-family: var(--font-ui);
        }

        /* ── Tabs ── */
        .pr-tabs {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        @media (min-width: 640px) {
          .pr-tabs { margin-bottom: 32px; }
        }
        .pr-tab {
          padding: 9px 18px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          font-family: var(--font-ui);
          cursor: pointer;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
          white-space: nowrap;
          line-height: 1;
        }
        .pr-tab-active {
          background: var(--gold, #E8A020);
          color: var(--dark, #0C0B08);
          border: 1.5px solid var(--gold, #E8A020);
        }
        .pr-tab-inactive {
          background: transparent;
          color: var(--text-dim, #8A8272);
          border: 1.5px solid var(--border, rgba(212,207,195,0.14));
        }
        .pr-tab-inactive:hover {
          color: var(--text, #F7F6F3);
          border-color: rgba(212,207,195,0.35);
        }

        /* ── Billing toggle ── */
        .pr-billing-wrap {
          display: flex;
          justify-content: center;
          margin-bottom: 24px;
        }
        @media (min-width: 640px) {
          .pr-billing-wrap { justify-content: flex-end; }
        }
        .pr-billing {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          background: var(--bg-card, #1E1C17);
          border: 1px solid var(--border, rgba(212,207,195,0.14));
          border-radius: 999px;
          padding: 3px;
        }
        .pr-bill-btn {
          padding: 7px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          font-family: var(--font-ui);
          cursor: pointer;
          border: none;
          white-space: nowrap;
          transition: background 0.15s, color 0.15s;
        }
        .pr-bill-active {
          background: var(--text, #F7F6F3);
          color: var(--dark, #0C0B08);
        }
        .pr-bill-inactive {
          background: transparent;
          color: var(--text-dim, #8A8272);
        }
        .pr-bill-inactive:hover { color: var(--text, #F7F6F3); }

        /* ── Plan grid ── */
        .pr-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        @media (min-width: 540px) {
          .pr-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 14px;
          }
        }
        @media (min-width: 1024px) {
          .pr-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
          }
        }

        /* ── Plan card ── */
        .pr-card {
          position: relative;
          display: flex;
          flex-direction: column;
          border-radius: 18px;
          padding: 22px 18px;
          background: var(--bg-card, #1E1C17);
          border: 1px solid var(--border, rgba(212,207,195,0.14));
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
          overflow: visible;
        }
        @media (min-width: 640px) {
          .pr-card { padding: 26px 22px; border-radius: 20px; }
        }
        .pr-card-hot {
          border-width: 1.5px;
          transform: translateY(-3px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        @media (min-width: 1024px) {
          .pr-card-hot { transform: translateY(-6px); }
        }

        /* Hot card top bar */
        .pr-card-bar {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          border-radius: 18px 18px 0 0;
        }

        /* Badge */
        .pr-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          background: var(--gold, #E8A020);
          color: var(--dark, #0C0B08);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 3px 12px;
          border-radius: 999px;
          font-family: var(--font-ui);
        }

        /* Card content */
        .pr-card-label {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--text-dim, #8A8272);
          margin: 0 0 4px;
          font-family: var(--font-ui);
        }
        .pr-card-name {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 22px;
          font-weight: 700;
          color: var(--text, #F7F6F3);
          margin: 0 0 14px;
        }
        .pr-card-price {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 36px;
          font-weight: 700;
          color: var(--text, #F7F6F3);
          letter-spacing: -1px;
          line-height: 1;
        }
        .pr-card-per {
          font-size: 12px;
          color: var(--text-dim, #8A8272);
          margin-left: 3px;
          font-family: var(--font-ui);
        }
        .pr-card-savings {
          min-height: 16px;
          font-size: 11px;
          color: var(--success, #10B981);
          margin: 3px 0 16px;
          font-family: var(--font-ui);
        }
        .pr-card-divider {
          height: 1px;
          background: var(--border, rgba(212,207,195,0.14));
          margin-bottom: 14px;
        }
        .pr-features {
          flex: 1;
          list-style: none;
          margin: 0 0 18px;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pr-feature {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 12px;
          line-height: 1.5;
          font-family: var(--font-ui);
        }
        .pr-feature-icon { flex-shrink: 0; margin-top: 1px; }
        .pr-feature-on  { color: var(--text-muted, #C8C3B8); }
        .pr-feature-off { color: var(--text-dim, #8A8272); text-decoration: line-through; opacity: 0.5; }
        .pr-cta {
          width: 100%;
          padding: 12px 18px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          font-family: var(--font-ui);
          cursor: pointer;
          transition: opacity 0.15s;
          border: none;
          letter-spacing: 0.01em;
        }
        .pr-cta:disabled { opacity: 0.5; cursor: not-allowed; }
        .pr-cta-primary  { background: var(--gold, #E8A020); color: var(--dark, #0C0B08); }
        .pr-cta-secondary {
          background: transparent;
          color: var(--text-muted, #C8C3B8);
          border: 1px solid var(--border, rgba(212,207,195,0.14));
        }

        /* ── Rationale grid ── */
        .pr-rationale {
          margin-top: 40px;
        }
        .pr-rationale-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--text-dim, #8A8272);
          margin-bottom: 12px;
          font-family: var(--font-ui);
        }
        .pr-rationale-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }
        @media (min-width: 640px) {
          .pr-rationale-grid { grid-template-columns: repeat(2, 1fr); }
        }
        .pr-rationale-item {
          border-left: 2px solid var(--border);
          padding: 10px 12px;
          background: rgba(212,207,195,0.02);
          border-radius: 0 8px 8px 0;
        }
        .pr-rationale-item-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text-dim);
          margin: 0 0 4px;
          font-family: var(--font-ui);
        }
        .pr-rationale-item-text {
          font-size: 12px;
          line-height: 1.6;
          color: var(--text-muted);
          margin: 0;
          font-family: var(--font-ui);
        }
      `}</style>

      <div className="pr-root">

        {/* Header */}
        <div className="pr-header">
          <p className="pr-eyebrow">Pricing</p>
          <h1 className="pr-heading">Invest in your career.</h1>
          <p className="pr-subhead">Cancel anytime. 7-day free trial on paid plans.</p>
        </div>

        {/* Tabs */}
        <div className="pr-tabs">
          {([
            { id: 'b2c' as Tab, label: 'For you' },
            { id: 'b2b' as Tab, label: 'For your organisation' },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`pr-tab ${tab === t.id ? 'pr-tab-active' : 'pr-tab-inactive'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* B2C */}
        {tab === 'b2c' && (
          <div>
            {/* Billing toggle */}
            <div className="pr-billing-wrap">
              <div className="pr-billing">
                {([
                  { val: 'monthly' as BillingCycle, label: 'Monthly' },
                  { val: 'annual'  as BillingCycle, label: 'Annual · −20%' },
                ]).map(b => (
                  <button
                    key={b.val}
                    onClick={() => setBilling(b.val)}
                    className={`pr-bill-btn ${billing === b.val ? 'pr-bill-active' : 'pr-bill-inactive'}`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cards */}
            <div className="pr-grid">
              {B2C_TIERS.map(tier => (
                <B2CPlanCard
                  key={tier.id}
                  tier={tier}
                  currency={currency}
                  billing={billing}
                />
              ))}
            </div>

            {/* Pricing rationale */}
            <div className="pr-rationale">
              <p className="pr-rationale-label">Pricing rationale</p>
              <div className="pr-rationale-grid">
                {(currency === 'ngn' ? [
                  { label: 'Free tier',         text: 'Acquisition — no credit card required. Session cap drives upgrades. 15–20% convert within 60 days.' },
                  { label: '₦12k Explorer',     text: '~$7 USD. Less than a business lunch. For professionals earning ₦300k–₦600k/month.' },
                  { label: '₦25k Builder',      text: 'The revenue engine. AI content agent saves 5+ hours/week — frame the upgrade around time, not features.' },
                  { label: '₦60k Climber',      text: 'Price anchor that makes Builder feel obvious. 10 Climbers = ₦600k/month from this tier alone.' },
                ] : [
                  { label: 'Explorer $19',      text: 'Below LinkedIn Premium ($40). Above Calm ($15). Frame it as career ROI vs entertainment spend.' },
                  { label: 'Builder $39',       text: 'One human coaching session costs $150–$500. $39/month for unlimited AI coaching is a clear win.' },
                  { label: 'Diaspora edge',     text: 'Global users convert 25–30% faster — higher income and sharper career anxiety around standing out.' },
                  { label: 'Climber $99 anchor',text: 'Positions Builder as obvious value. Less than one hour with a human executive coach.' },
                ]).map(item => (
                  <div key={item.label} className="pr-rationale-item">
                    <p className="pr-rationale-item-label">{item.label}</p>
                    <p className="pr-rationale-item-text">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Organisation */}
        {tab === 'b2b' && <PartnerEnquiry />}

      </div>
    </>
  )
}
