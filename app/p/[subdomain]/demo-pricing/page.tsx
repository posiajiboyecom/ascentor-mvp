'use client'

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  FILE PATH: app/p/[subdomain]/demo-pricing.tsx                          ║
// ║  ACTION:    CREATE this as a NEW file (does not exist yet)              ║
// ║                                                                          ║
// ║  Then in app/p/[subdomain]/[...path]/page.tsx, add this route           ║
// ║  inside the PROTECTED ROUTES block (after requireAuth()):               ║
// ║                                                                          ║
// ║  if (route === 'pricing' && subdomain === 'demo') {                     ║
// ║    const { default: DemoPricingPage } =                                 ║
// ║      await import('@/app/p/[subdomain]/demo-pricing')                   ║
// ║    return <DemoPricingPage />                                           ║
// ║  }                                                                       ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { useState } from 'react'

type Billing = 'monthly' | 'annual'

// NGN prices — $1 ≈ ₦1,600. Update this rate in one place as needed.
const PLANS = [
  {
    id: 'studio',
    name: 'Studio',
    label: 'Solo coaches',
    flatMonthly: 238400,
    flatAnnual: Math.round(238400 * 12 * 0.85),
    seatMonthly: 6400,
    maxSeats: 'Up to 100 members',
    annualSave: Math.round(238400 * 12 * 0.15),
    hot: false,
    badge: '',
    features: [
      { on: true,  text: '1 branded subdomain' },
      { on: true,  text: 'Up to 100 member seats' },
      { on: true,  text: 'Community + courses' },
      { on: true,  text: 'Payment collection' },
      { on: true,  text: 'Basic admin dashboard' },
      { on: false, text: 'AI agents' },
      { on: false, text: 'Custom domain' },
      { on: false, text: 'API access' },
    ],
  },
  {
    id: 'academy',
    name: 'Academy',
    label: 'Growing organisations',
    flatMonthly: 798400,
    flatAnnual: Math.round(798400 * 12 * 0.85),
    seatMonthly: 4800,
    maxSeats: 'Up to 500 members',
    annualSave: Math.round(798400 * 12 * 0.15),
    hot: true,
    badge: 'Most popular',
    features: [
      { on: true,  text: '3 branded subdomains' },
      { on: true,  text: 'Up to 500 member seats' },
      { on: true,  text: 'Full AI agent suite' },
      { on: true,  text: 'Content + intel agents' },
      { on: true,  text: 'Personal brand agent' },
      { on: true,  text: 'Custom domain support' },
      { on: true,  text: 'Priority support' },
      { on: false, text: 'Dedicated CSM' },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    label: 'Large institutions',
    flatMonthly: null,
    flatAnnual: null,
    seatMonthly: null,
    maxSeats: '500+ members',
    annualSave: null,
    hot: false,
    badge: '',
    features: [
      { on: true, text: 'Unlimited subdomains' },
      { on: true, text: '500+ seats, volume pricing' },
      { on: true, text: 'All AI agents + custom agents' },
      { on: true, text: 'SLA + uptime guarantee' },
      { on: true, text: 'Dedicated CSM' },
      { on: true, text: 'API access' },
      { on: true, text: 'SSO / SAML integration' },
      { on: true, text: 'Custom contract + invoicing' },
    ],
  },
]

function fmt(n: number) {
  return '₦' + n.toLocaleString('en-NG')
}

export default function DemoPricingPage() {
  const [billing, setBilling] = useState<Billing>('monthly')

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,700;1,600&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

        .dp-wrap { min-height: 100vh; background: #0C0B08; color: #F7F6F3; font-family: 'Syne', system-ui, sans-serif; padding: 56px 24px 100px; }
        .dp-inner { max-width: 1060px; margin: 0 auto; }
        .dp-topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 52px; flex-wrap: wrap; gap: 12px; }
        .dp-logo { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 18px; font-weight: 700; color: #F7F6F3; letter-spacing: 0.04em; }
        .dp-logo span { color: #E8A020; }
        .dp-approved-badge {
          display: inline-flex; align-items: center; gap: 7px; padding: 5px 14px; border-radius: 100px;
          background: rgba(20,184,166,0.10); border: 1px solid rgba(20,184,166,0.25);
          font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.14em; color: #14B8A6; text-transform: uppercase;
        }
        .dp-dot { width: 6px; height: 6px; border-radius: 50%; background: #14B8A6; }
        .dp-eyebrow { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.2em; color: #E8A020; text-transform: uppercase; text-align: center; margin-bottom: 14px; }
        .dp-headline { font-family: 'Cormorant Garamond', Georgia, serif; font-size: clamp(32px, 5vw, 50px); font-weight: 700; line-height: 1.08; text-align: center; color: #F7F6F3; margin-bottom: 14px; }
        .dp-headline span { color: #E8A020; }
        .dp-sub { text-align: center; font-size: 14px; color: #8A8272; margin-bottom: 10px; line-height: 1.6; }
        .dp-notice {
          display: flex; align-items: center; gap: 10px; max-width: 600px; margin: 0 auto 40px;
          background: rgba(20,184,166,0.07); border: 1px solid rgba(20,184,166,0.18);
          border-radius: 10px; padding: 10px 16px; font-size: 12px; color: #8A8272;
          font-family: 'DM Mono', monospace; letter-spacing: 0.02em;
        }
        .dp-toggle-row { display: flex; justify-content: flex-end; margin-bottom: 24px; }
        .dp-toggle {
          display: flex; align-items: center; gap: 2px; padding: 3px;
          border-radius: 100px; border: 1px solid rgba(212,207,195,0.14); background: #1E1C17;
        }
        .dp-toggle-btn {
          padding: 6px 16px; border-radius: 100px; border: none; background: transparent;
          color: #8A8272; font-family: 'Syne', sans-serif; font-size: 12px; cursor: pointer; transition: all 0.15s; white-space: nowrap;
        }
        .dp-toggle-btn.active { background: #E8A020; color: #0C0B08; font-weight: 700; }
        .dp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px; max-width: 960px; margin: 0 auto; }
        .dp-card {
          position: relative; display: flex; flex-direction: column; border-radius: 18px;
          padding: 26px 22px 22px; border: 1px solid rgba(212,207,195,0.12); background: #141310; transition: border-color 0.18s;
        }
        .dp-card:hover { border-color: rgba(232,160,32,0.28); }
        .dp-card.hot {
          border-color: #E8A020; background: #1A1813;
          box-shadow: 0 0 0 1px rgba(232,160,32,0.3), 0 8px 40px rgba(232,160,32,0.09); transform: scale(1.02);
        }
        .dp-badge {
          position: absolute; top: -13px; left: 50%; transform: translateX(-50%);
          background: #E8A020; color: #0C0B08; font-family: 'Syne', sans-serif;
          font-size: 9px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase;
          padding: 4px 14px; border-radius: 100px; white-space: nowrap;
        }
        .dp-plan-label { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase; color: #4A4438; margin-bottom: 4px; }
        .dp-plan-name { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 24px; font-weight: 700; color: #F7F6F3; margin-bottom: 18px; }
        .dp-price { font-family: 'Syne', sans-serif; font-size: clamp(20px, 3.5vw, 28px); font-weight: 800; color: #F7F6F3; line-height: 1; }
        .dp-price-unit { font-size: 12px; color: #4A4438; font-family: 'DM Mono', monospace; }
        .dp-seat-note { font-size: 12px; color: #8A8272; margin-top: 6px; }
        .dp-seat-note strong { color: #C8C3B8; }
        .dp-capacity { font-size: 10px; color: #4A4438; font-family: 'DM Mono', monospace; margin-top: 4px; letter-spacing: 0.04em; }
        .dp-save-note { font-size: 11px; color: #14B8A6; font-family: 'DM Mono', monospace; margin-top: 4px; min-height: 16px; letter-spacing: 0.02em; }
        .dp-divider { height: 1px; background: rgba(212,207,195,0.10); margin: 16px 0; }
        .dp-features { list-style: none; flex: 1; margin-bottom: 20px; display: flex; flex-direction: column; gap: 9px; }
        .dp-feat { display: flex; align-items: flex-start; gap: 9px; font-size: 12px; line-height: 1.45; }
        .dp-feat-on { color: #C8C3B8; }
        .dp-feat-off { color: #2E2A22; text-decoration: line-through; }
        .dp-check { width: 14px; height: 14px; flex-shrink: 0; margin-top: 1px; border-radius: 50%; background: rgba(20,184,166,0.15); border: 1px solid rgba(20,184,166,0.4); display: flex; align-items: center; justify-content: center; }
        .dp-check-tick { width: 7px; height: 7px; border-radius: 50%; background: #14B8A6; }
        .dp-dash { width: 14px; height: 14px; flex-shrink: 0; margin-top: 1px; border-radius: 50%; background: #1E1C17; border: 1px solid rgba(212,207,195,0.08); display: flex; align-items: center; justify-content: center; }
        .dp-dash-line { width: 6px; height: 1px; background: #2E2A22; }
        .dp-cta { width: 100%; padding: 11px 0; border-radius: 10px; font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; cursor: pointer; border: none; transition: all 0.15s; text-decoration: none; display: block; text-align: center; }
        .dp-cta.primary { background: #E8A020; color: #0C0B08; }
        .dp-cta.primary:hover { background: #F5C55A; }
        .dp-cta.secondary { background: transparent; border: 1px solid rgba(212,207,195,0.2); color: #C8C3B8; }
        .dp-cta.secondary:hover { border-color: rgba(232,160,32,0.45); color: #E8A020; }
        .dp-footer-note { margin-top: 48px; text-align: center; font-size: 12px; color: #4A4438; font-family: 'DM Mono', monospace; letter-spacing: 0.04em; line-height: 1.7; }
        .dp-footer-note a { color: #8A8272; text-decoration: underline; text-underline-offset: 3px; }
        .dp-footer-note a:hover { color: #C8C3B8; }
      `}</style>

      <div className="dp-wrap">
        <div className="dp-inner">

          <div className="dp-topbar">
            <div className="dp-logo">
              ASCENT<span>OR</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#4A4438', letterSpacing: '0.12em', marginLeft: 6 }}>PARTNER DEMO</span>
            </div>
            <div className="dp-approved-badge">
              <span className="dp-dot" />
              Approved partner access
            </div>
          </div>

          <p className="dp-eyebrow">Organisation pricing</p>
          <h1 className="dp-headline">White-label plans in <span>Nigerian Naira</span></h1>
          <p className="dp-sub">All prices in ₦ NGN · Billed via Paystack · Partners collect member revenue in any currency</p>
          <div className="dp-notice">
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#14B8A6', flexShrink: 0, display: 'inline-block' }} />
            This page is visible only to approved partners. Contact Team Ascentor to activate your plan.
          </div>

          <div className="dp-toggle-row">
            <div className="dp-toggle">
              {(['monthly', 'annual'] as Billing[]).map(b => (
                <button
                  key={b}
                  onClick={() => setBilling(b)}
                  className={`dp-toggle-btn${billing === b ? ' active' : ''}`}
                >
                  {b === 'monthly' ? 'Monthly' : 'Annual · save 15%'}
                </button>
              ))}
            </div>
          </div>

          <div className="dp-grid">
            {PLANS.map(plan => {
              const isCustom = plan.flatMonthly === null
              const displayFlat = isCustom
                ? 'Custom'
                : billing === 'annual' ? fmt(plan.flatAnnual!) : fmt(plan.flatMonthly!)
              const flatUnit = isCustom ? '' : billing === 'annual' ? '/yr flat' : '/mo flat'

              return (
                <div key={plan.id} className={`dp-card${plan.hot ? ' hot' : ''}`}>
                  {plan.badge && <div className="dp-badge">{plan.badge}</div>}

                  <p className="dp-plan-label">{plan.label}</p>
                  <p className="dp-plan-name">{plan.name}</p>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0, overflow: 'hidden', marginBottom: 4 }}>
                    <span className="dp-price" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                      {displayFlat}
                    </span>
                    {flatUnit && <span className="dp-price-unit">{flatUnit}</span>}
                  </div>

                  {!isCustom && plan.seatMonthly && (
                    <p className="dp-seat-note">+ <strong>{fmt(plan.seatMonthly)}/seat</strong> per active member</p>
                  )}
                  <p className="dp-capacity">{plan.maxSeats}</p>
                  <p className="dp-save-note">
                    {billing === 'annual' && !isCustom && plan.annualSave
                      ? `Save ${fmt(plan.annualSave)} per year`
                      : billing === 'monthly' && !isCustom
                        ? 'Switch to annual and save 15%'
                        : ''}
                  </p>

                  <div className="dp-divider" />

                  <ul className="dp-features">
                    {plan.features.map((f, i) => (
                      <li key={i} className={`dp-feat ${f.on ? 'dp-feat-on' : 'dp-feat-off'}`}>
                        {f.on
                          ? <span className="dp-check"><span className="dp-check-tick" /></span>
                          : <span className="dp-dash"><span className="dp-dash-line" /></span>}
                        {f.text}
                      </li>
                    ))}
                  </ul>

                  <a
                    href={
                      plan.id === 'enterprise'
                        ? 'mailto:asamuel@ascentorbi.com?subject=Enterprise Partner Enquiry'
                        : `mailto:asamuel@ascentorbi.com?subject=Activate ${plan.name} Plan&body=Hi Team Ascentor,%0A%0AI would like to activate the ${plan.name} partner plan (${billing} billing).%0A%0AOrganisation name:%0AExpected member count:%0A%0AThank you.`
                    }
                    className={`dp-cta ${plan.hot ? 'primary' : 'secondary'}`}
                  >
                    {plan.id === 'enterprise' ? 'Contact us →' : `Activate ${plan.name} →`}
                  </a>
                </div>
              )
            })}
          </div>

          <p className="dp-footer-note">
            Prices in Nigerian Naira (₦) · Seat charges apply to active members (logged in within 90 days)<br />
            Annual billing gives 15% off the flat fee only · Seat rates stay the same<br />
            To activate or ask questions: <a href="mailto:asamuel@ascentorbi.com">asamuel@ascentorbi.com</a>
          </p>

        </div>
      </div>
    </>
  )
}
