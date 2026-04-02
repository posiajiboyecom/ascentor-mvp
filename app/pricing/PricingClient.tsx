'use client'

// app/pricing/PricingClient.tsx

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

  const currency: Currency = defaultCurrency

  return (
    <div style={{
      width:      '100%',
      maxWidth:   1120,
      margin:     '0 auto',
      padding:    '56px 24px 96px',
      fontFamily: 'var(--font-ui)',
    }}>

      {/* ── Header ── */}
      <div style={{ textAlign: 'center', marginBottom: 44 }}>
        <p style={{
          fontSize:      11,
          fontWeight:    700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color:         'var(--gold)',
          margin:        '0 0 12px',
          fontFamily:    'var(--font-ui)',
        }}>
          Pricing
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize:   'clamp(32px, 5vw, 52px)',
          fontWeight: 700,
          color:      'var(--text)',
          margin:     '0 0 12px',
          lineHeight: 1.1,
        }}>
          Invest in your career.
        </h1>
        <p style={{
          fontSize:  15,
          color:     'var(--text-dim)',
          margin:    '0 auto',
          maxWidth:  480,
          lineHeight: 1.6,
        }}>
          Cancel anytime. 7-day free trial on all paid plans — no charge until Day 8.
        </p>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display:        'flex',
        justifyContent: 'center',
        gap:            8,
        marginBottom:   40,
      }}>
        {([
          { id: 'b2c' as Tab, label: 'For you' },
          { id: 'b2b' as Tab, label: 'For your organisation' },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding:    '9px 22px',
              borderRadius: 999,
              fontSize:   13,
              fontWeight: 600,
              fontFamily: 'var(--font-ui)',
              cursor:     'pointer',
              transition: 'all 0.15s',
              background: tab === t.id ? 'var(--gold)' : 'transparent',
              color:      tab === t.id ? 'var(--dark)' : 'var(--text-dim)',
              border:     tab === t.id
                ? '1.5px solid var(--gold)'
                : '1.5px solid var(--border)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── B2C Tab ── */}
      {tab === 'b2c' && (
        <div>

          {/* Billing toggle */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
            <div style={{
              display:    'flex',
              alignItems: 'center',
              gap:        2,
              background: 'var(--bg-card)',
              border:     '1px solid var(--border)',
              borderRadius: 999,
              padding:    '3px',
            }}>
              {([
                { val: 'monthly' as BillingCycle, label: 'Monthly' },
                { val: 'annual'  as BillingCycle, label: 'Annual · save 20%' },
              ]).map(b => (
                <button
                  key={b.val}
                  onClick={() => setBilling(b.val)}
                  style={{
                    padding:    '7px 18px',
                    borderRadius: 999,
                    fontSize:   12,
                    fontWeight: 600,
                    fontFamily: 'var(--font-ui)',
                    cursor:     'pointer',
                    transition: 'all 0.15s',
                    border:     'none',
                    background: billing === b.val ? 'var(--gold)'      : 'transparent',
                    color:      billing === b.val ? 'var(--dark)'       : 'var(--text-dim)',
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Plan cards — responsive grid */}
          <style>{`
            .pricing-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 16px;
              align-items: start;
            }
            @media (max-width: 1024px) {
              .pricing-grid {
                grid-template-columns: repeat(2, 1fr);
                max-width: 720px;
                margin: 0 auto;
              }
            }
            @media (max-width: 600px) {
              .pricing-grid {
                grid-template-columns: 1fr;
                max-width: 420px;
                margin: 0 auto;
              }
            }
          `}</style>

          <div className="pricing-grid">
            {B2C_TIERS.map(tier => (
              <B2CPlanCard
                key={tier.id}
                tier={tier}
                currency={currency}
                billing={billing}
              />
            ))}
          </div>

          {/* Trust row */}
          <div style={{
            display:        'flex',
            justifyContent: 'center',
            gap:            28,
            flexWrap:       'wrap',
            marginTop:      40,
            paddingTop:     32,
            borderTop:      '1px solid var(--border)',
          }}>
            {[
              { icon: '🔒', text: 'Paystack secured' },
              { icon: '↩', text: '7-day money back' },
              { icon: '✕', text: 'Cancel anytime' },
              { icon: '₦', text: 'NGN · no FX fees' },
            ].map((item, i) => (
              <div key={i} style={{
                display:    'flex',
                alignItems: 'center',
                gap:        7,
                fontFamily: 'var(--font-ui)',
                fontSize:   12,
                color:      'var(--text-dim)',
              }}>
                <span>{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── For your organisation Tab ── */}
      {tab === 'b2b' && <PartnerEnquiry />}

    </div>
  )
}
