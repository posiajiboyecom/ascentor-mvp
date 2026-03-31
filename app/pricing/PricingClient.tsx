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


        </div>
      )}

      {/* ── For your organisation Tab ───────────────────────────────────── */}
      {tab === 'b2b' && <PartnerEnquiry />}

    </div>
  )
}
