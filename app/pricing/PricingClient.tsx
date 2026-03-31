'use client'

// app/pricing/PricingClient.tsx — v3
// ─────────────────────────────────────────────────────────────────────────────
// Changes from v2:
//  1. Currency auto-detected server-side (via x-currency header from proxy).
//     No manual Nigeria/Global toggle shown to users.
//  2. Revenue Model tab removed entirely.
//  3. "For your organisation" tab now shows PartnerEnquiry form instead of
//     B2B plan cards. Partners must contact sales to get pricing & demo access.
//  4. Plan display names: Free / Explorer / Builder / Climber (from data.ts v3).
//  5. Styled with Ascentor brand tokens (var(--gold), var(--bg-card), etc.)
// ─────────────────────────────────────────────────────────────────────────────

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

  // Currency comes from server-side locale detection — no toggle shown
  const currency: Currency = defaultCurrency

  return (
    <div style={{
      width: '100%',
      maxWidth: 1040,
      margin: '0 auto',
      padding: '48px 24px 80px',
      fontFamily: 'var(--font-ui)',
    }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <p style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--gold)',
          margin: '0 0 10px',
        }}>
          Pricing
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(32px, 5vw, 52px)',
          fontWeight: 700,
          color: 'var(--text)',
          margin: '0 0 10px',
          lineHeight: 1.1,
        }}>
          Invest in your career.
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-dim)', margin: 0 }}>
          Cancel anytime. 7-day free trial on paid plans.
        </p>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 36 }}>
        {([
          { id: 'b2c' as Tab, label: 'For you' },
          { id: 'b2b' as Tab, label: 'For your organisation' },
        ] as { id: Tab; label: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 20px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--font-ui)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              background: tab === t.id ? 'var(--gold)' : 'transparent',
              color:      tab === t.id ? 'var(--dark)' : 'var(--text-dim)',
              border: tab === t.id
                ? '1.5px solid var(--gold)'
                : '1.5px solid var(--border)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── B2C Tab ─────────────────────────────────────────────────────── */}
      {tab === 'b2c' && (
        <div>
          {/* Billing toggle */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 999,
              padding: '3px',
            }}>
              {([
                { val: 'monthly' as BillingCycle, label: 'Monthly' },
                { val: 'annual'  as BillingCycle, label: 'Annual · save 20%' },
              ]).map(b => (
                <button
                  key={b.val}
                  onClick={() => setBilling(b.val)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'var(--font-ui)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    border: 'none',
                    background: billing === b.val ? 'var(--text)' : 'transparent',
                    color:      billing === b.val ? 'var(--dark)' : 'var(--text-dim)',
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Plan cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
          }}>
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
          <div style={{ marginTop: 40 }}>
            <p style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              marginBottom: 14,
            }}>
              Pricing rationale
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
            }}>
              {(currency === 'ngn'
                ? [
                    { label: 'Free tier purpose',      text: 'Acquisition — no credit card. Session cap creates upgrade pressure. 15–20% convert within 60 days if coaching delivers value.' },
                    { label: '₦12k Explorer logic',    text: '~$7 USD. Less than one business lunch. Targets professionals earning ₦300k–₦600k/month.' },
                    { label: '₦25k Builder logic',     text: 'Your revenue engine. The AI content agent saves 5+ hours/week — frame the upgrade around time saved, not features unlocked.' },
                    { label: '₦60k Climber logic',     text: 'Price anchor that makes Builder feel affordable. 10 Climber subscribers = ₦600k/month from this tier alone.' },
                  ]
                : [
                    { label: 'Explorer $19',           text: 'Below LinkedIn Premium ($40). Above Calm ($15). Frame it as career ROI vs entertainment spend.' },
                    { label: 'Builder $39',            text: 'One human coaching session costs $150–$500. $39/month for unlimited AI coaching + content writing is a clear win.' },
                    { label: 'Diaspora conversion',    text: 'Global users convert 25–30% faster — higher disposable income and stronger career anxiety around standing out internationally.' },
                    { label: 'Climber $99 anchor',     text: 'Positions Builder as obvious value. Less than one hour with a human executive coach — lead with that comparison.' },
                  ]
              ).map(item => (
                <div key={item.label} style={{
                  borderLeft: '2px solid var(--border)',
                  paddingLeft: 16,
                  paddingTop: 10,
                  paddingBottom: 10,
                  paddingRight: 12,
                  background: 'rgba(212,207,195,0.03)',
                  borderRadius: '0 8px 8px 0',
                }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', margin: '0 0 5px' }}>
                    {item.label}
                  </p>
                  <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-muted)', margin: 0 }}>
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── For your organisation Tab ───────────────────────────────────── */}
      {tab === 'b2b' && <PartnerEnquiry />}

    </div>
  )
}
