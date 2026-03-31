'use client'

import { useState, useEffect } from 'react'
import { B2C_TIERS, Currency, BillingCycle } from './data'
import B2CPlanCard from './components/B2CPlanCard'
import PartnerEnquiry from './components/PartnerEnquiry'

type Tab = 'b2c' | 'b2b'

interface Props {
  defaultCurrency: Currency
  defaultCountry?: string
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}

export default function PricingClient({ defaultCurrency }: Props) {
  const [tab,     setTab]     = useState<Tab>('b2c')
  const [billing, setBilling] = useState<BillingCycle>('monthly')
  const isMobile = useIsMobile()
  const currency: Currency = defaultCurrency

  return (
    <div style={{
      width: '100%',
      maxWidth: 1040,
      margin: '0 auto',
      padding: isMobile ? '32px 16px 64px' : '48px 24px 80px',
      fontFamily: 'var(--font-ui)',
    }}>

      {/* ── Header ── */}
      <div style={{ textAlign: 'center', marginBottom: isMobile ? 28 : 40 }}>
        <p style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: 'var(--gold)', margin: '0 0 10px',
        }}>
          Pricing
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: isMobile ? '36px' : 'clamp(32px, 5vw, 52px)',
          fontWeight: 700, color: 'var(--text)', margin: '0 0 10px', lineHeight: 1.1,
        }}>
          Invest in your career.
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-dim)', margin: 0 }}>
          Cancel anytime. 7-day free trial on paid plans.
        </p>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 8,
        marginBottom: isMobile ? 24 : 36,
        flexWrap: 'wrap',
      }}>
        {([
          { id: 'b2c' as Tab, label: 'For you' },
          { id: 'b2b' as Tab, label: 'For your organisation' },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: isMobile ? '8px 16px' : '8px 20px',
              borderRadius: 999,
              fontSize: isMobile ? 12 : 13,
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

      {/* ── B2C Tab ── */}
      {tab === 'b2c' && (
        <div>
          {/* Billing toggle */}
          <div style={{
            display: 'flex',
            justifyContent: isMobile ? 'center' : 'flex-end',
            marginBottom: 24,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 2,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 999, padding: '3px',
            }}>
              {([
                { val: 'monthly' as BillingCycle, label: 'Monthly' },
                { val: 'annual'  as BillingCycle, label: isMobile ? 'Annual −20%' : 'Annual · save 20%' },
              ]).map(b => (
                <button
                  key={b.val}
                  onClick={() => setBilling(b.val)}
                  style={{
                    padding: isMobile ? '6px 12px' : '6px 16px',
                    borderRadius: 999,
                    fontSize: isMobile ? 11 : 12,
                    fontWeight: 600,
                    fontFamily: 'var(--font-ui)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    border: 'none',
                    whiteSpace: 'nowrap',
                    background: billing === b.val ? 'var(--text)' : 'transparent',
                    color:      billing === b.val ? 'var(--dark)' : 'var(--text-dim)',
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Plan cards — 1 col mobile, 2 col tablet, 4 col desktop */}
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

          <style>{`
            .pricing-grid {
              display: grid;
              grid-template-columns: 1fr;
              gap: 14px;
            }
            @media (min-width: 560px) {
              .pricing-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 16px;
              }
            }
            @media (min-width: 1024px) {
              .pricing-grid {
                grid-template-columns: repeat(4, 1fr);
              }
            }
          `}</style>
        </div>
      )}

      {/* ── Organisation Tab ── */}
      {tab === 'b2b' && <PartnerEnquiry />}

    </div>
  )
}
