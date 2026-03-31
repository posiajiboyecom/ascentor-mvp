'use client'

// app/pricing/components/PartnerEnquiry.tsx — v2
// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 (default): Contact form — name, email, org, message.
// Phase 2 (on success): Full organisation pricing reveal — Studio / Academy /
//   Enterprise plans, comparison table, seat pricing explanation, demo access.
//
// Pricing content is sourced from the official Ascentor Organisation Pricing
// document (29 March 2026). Styled with Ascentor brand tokens.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef } from 'react'

type FormField = 'name' | 'email' | 'org' | 'message'
type Errors = Partial<Record<FormField, string>>

// ── Pricing data from Ascentor_Organisation_Pricing.docx ─────────────────────
const PLANS = [
  {
    id:        'studio',
    name:      'Studio',
    badge:     null,
    for:       'Solo coaches & independent practitioners',
    price:     '$149',
    unit:      '/mo flat',
    seat:      '+ $4 per active member seat',
    seats:     'Up to 100 active member seats',
    annual:    '$1,520/yr  ·  save $268',
    hot:       false,
    features: [
      { on: true,  text: '1 branded subdomain (yourname.ascentorbi.com)' },
      { on: true,  text: 'Up to 100 member seats' },
      { on: true,  text: 'Community + cohorts' },
      { on: true,  text: 'Course hosting' },
      { on: true,  text: 'Payment collection from members' },
      { on: true,  text: 'Basic admin dashboard' },
      { on: false, text: 'AI agents (content, intel, personal brand)' },
      { on: false, text: 'Custom domain' },
      { on: false, text: 'API access' },
    ],
  },
  {
    id:        'academy',
    name:      'Academy',
    badge:     'Most Popular',
    for:       'Growing organisations, L&D teams, alumni networks',
    price:     '$499',
    unit:      '/mo flat',
    seat:      '+ $3 per active member seat',
    seats:     'Up to 500 active member seats',
    annual:    '$5,090/yr  ·  save $898',
    hot:       true,
    features: [
      { on: true,  text: '3 branded subdomains' },
      { on: true,  text: 'Up to 500 member seats' },
      { on: true,  text: 'Community + cohorts' },
      { on: true,  text: 'Full AI agent suite' },
      { on: true,  text: 'Content + intel agents' },
      { on: true,  text: 'Personal brand agent for members' },
      { on: true,  text: 'Custom domain support' },
      { on: true,  text: 'Priority support' },
      { on: false, text: 'Dedicated Customer Success Manager' },
    ],
  },
  {
    id:        'enterprise',
    name:      'Enterprise',
    badge:     null,
    for:       'Universities, large corporates, institutions',
    price:     'Custom',
    unit:      '',
    seat:      '500+ seats · volume pricing',
    seats:     'Annual contract',
    annual:    '',
    hot:       false,
    features: [
      { on: true, text: 'Unlimited branded subdomains' },
      { on: true, text: '500+ seats with volume pricing' },
      { on: true, text: 'All AI agents + custom agent development' },
      { on: true, text: 'SLA + uptime guarantee' },
      { on: true, text: 'Dedicated Customer Success Manager' },
      { on: true, text: 'API access' },
      { on: true, text: 'SSO / SAML integration' },
      { on: true, text: 'Custom contract + invoicing' },
    ],
  },
]

const COMPARISON_ROWS = [
  { label: 'Branded subdomain',    studio: '1',  academy: '3',  enterprise: 'Unlimited' },
  { label: 'Member seats',         studio: 'Up to 100', academy: 'Up to 500', enterprise: '500+' },
  { label: 'Community + courses',  studio: true, academy: true,  enterprise: true },
  { label: 'Payment collection',   studio: true, academy: true,  enterprise: true },
  { label: 'AI agents',            studio: false, academy: true, enterprise: true },
  { label: 'Content + intel agents', studio: false, academy: true, enterprise: true },
  { label: 'Personal brand agent', studio: false, academy: true, enterprise: true },
  { label: 'Custom domain',        studio: false, academy: true, enterprise: true },
  { label: 'API access',           studio: false, academy: false, enterprise: true },
  { label: 'SSO / SAML',          studio: false, academy: false, enterprise: true },
  { label: 'Dedicated CSM',        studio: false, academy: false, enterprise: true },
  { label: 'SLA + uptime guarantee', studio: false, academy: false, enterprise: true },
  { label: 'Custom contract',      studio: false, academy: false, enterprise: true },
]

const ACCESS_STEPS = [
  { n: '01', text: 'Reach out to Team Ascentor via email to begin the conversation.' },
  { n: '02', text: 'We schedule a 30-minute discovery call to understand your use case, member profile, and goals.' },
  { n: '03', text: 'Team Ascentor reviews and approves your account — typically within 2 business days.' },
  { n: '04', text: 'Once approved, your branded subdomain is provisioned and you can begin onboarding your members.' },
  { n: '05', text: 'Ongoing support from your dedicated contact at Ascentor throughout setup and launch.' },
]

// ─────────────────────────────────────────────────────────────────────────────

export default function PartnerEnquiry() {
  const [name,        setName]        = useState('')
  const [email,       setEmail]       = useState('')
  const [org,         setOrg]         = useState('')
  const [message,     setMessage]     = useState('')
  const [errors,      setErrors]      = useState<Errors>({})
  const [loading,     setLoading]     = useState(false)
  const [success,     setSuccess]     = useState(false)
  const [serverError, setServerError] = useState('')
  const topRef = useRef<HTMLDivElement>(null)

  function validate(): Errors {
    const e: Errors = {}
    if (!name.trim())  e.name  = 'Your name is required'
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      e.email = 'A valid work email is required'
    if (!org.trim())   e.org   = 'Organisation name is required'
    return e
  }

  async function handleSubmit() {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return
    setLoading(true)
    setServerError('')
    try {
      const res  = await fetch('/api/partner-enquiry', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    name.trim(),
          email:   email.trim().toLowerCase(),
          org:     org.trim(),
          message: message.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setServerError(data.error || 'Something went wrong. Please try again.')
      } else {
        setSuccess(true)
        setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
      }
    } catch {
      setServerError('Network error. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 2 — Pricing Reveal (shown after successful form submission)
  // ══════════════════════════════════════════════════════════════════════════
  if (success) {
    return (
      <div ref={topRef}>

        {/* Confirmation banner */}
        <div style={s.confirmBanner}>
          <div style={s.confirmIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
              Request received — a confirmation is on its way to {email}
            </p>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-ui)' }}>
              Our team will be in touch within 1–2 business days to schedule a discovery call.
            </p>
          </div>
        </div>

        {/* Overview */}
        <div style={{ textAlign: 'center', margin: '48px 0 40px' }}>
          <p style={s.eyebrow}>Organisation Plans</p>
          <h2 style={s.revealHeadline}>White-label AI coaching infrastructure<br />for teams, coaches, and institutions.</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 580, margin: '12px auto 0', lineHeight: 1.7, fontFamily: 'var(--font-ui)' }}>
            Each plan includes a white-label subdomain, community infrastructure, course hosting, payment collection from your members, and varying levels of AI agent capability. You focus on your community; Ascentor handles the technology.
          </p>
        </div>

        {/* Plan cards */}
        <div style={s.planGrid}>
          {PLANS.map(plan => (
            <div key={plan.id} style={{
              ...s.planCard,
              border: plan.hot ? '1.5px solid var(--gold)' : '1px solid var(--border)',
              boxShadow: plan.hot ? '0 0 0 1px rgba(232,160,32,0.12), 0 8px 32px rgba(0,0,0,0.35)' : 'none',
              transform: plan.hot ? 'translateY(-6px)' : 'none',
              position: 'relative',
            }}>
              {/* Gold top bar on hot card */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                borderRadius: '20px 20px 0 0',
                background: plan.hot ? 'linear-gradient(90deg, var(--gold), transparent)' : 'transparent',
              }} />

              {plan.badge && (
                <div style={s.planBadge}>{plan.badge}</div>
              )}

              <p style={s.planFor}>{plan.for}</p>
              <p style={s.planName}>{plan.name}</p>

              {/* Price */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, margin: '12px 0 4px' }}>
                <span style={s.planPrice}>{plan.price}</span>
                {plan.unit && <span style={s.planUnit}>{plan.unit}</span>}
              </div>
              {plan.seat && <p style={s.planSeat}>{plan.seat}</p>}
              <p style={s.planSeats}>{plan.seats}</p>
              {plan.annual && (
                <p style={s.planAnnual}>{plan.annual}</p>
              )}

              <div style={s.planDivider} />

              {/* Features */}
              <ul style={s.featureList}>
                {plan.features.map((f, i) => (
                  <li key={i} style={s.featureItem}>
                    {f.on ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1, opacity: 0.35 }}>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    )}
                    <span style={{
                      fontSize: 12,
                      fontFamily: 'var(--font-ui)',
                      color: f.on ? 'var(--text-muted)' : 'var(--text-dim)',
                      textDecoration: f.on ? 'none' : 'line-through',
                      opacity: f.on ? 1 : 0.5,
                      lineHeight: 1.5,
                    }}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <a
                href={plan.id === 'enterprise'
                  ? 'mailto:asamuel@ascentorbi.com?subject=Enterprise Partner Enquiry'
                  : 'mailto:asamuel@ascentorbi.com?subject=Partner Access Request — ' + plan.name + ' Plan'}
                style={{
                  ...s.planCta,
                  background: plan.hot ? 'var(--gold)' : 'transparent',
                  color: plan.hot ? 'var(--dark)' : 'var(--text-muted)',
                  border: plan.hot ? 'none' : '1px solid var(--border)',
                }}
              >
                {plan.id === 'enterprise' ? 'Contact for pricing →' : 'Get started →'}
              </a>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div style={{ marginTop: 64 }}>
          <p style={{ ...s.eyebrow, textAlign: 'center' }}>Plan Comparison</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={{ ...s.th, textAlign: 'left', width: '40%' }}>Feature</th>
                  <th style={s.th}>Studio</th>
                  <th style={{ ...s.th, color: 'var(--gold)' }}>Academy</th>
                  <th style={s.th}>Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(212,207,195,0.02)' : 'transparent' }}>
                    <td style={s.tdLabel}>{row.label}</td>
                    {(['studio', 'academy', 'enterprise'] as const).map(col => {
                      const val = row[col]
                      return (
                        <td key={col} style={{ ...s.td, color: col === 'academy' ? 'var(--gold)' : undefined }}>
                          {typeof val === 'boolean' ? (
                            val
                              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={col === 'academy' ? 'var(--gold)' : 'var(--success)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                              : <span style={{ color: 'var(--text-dim)', opacity: 0.3, fontSize: 16, lineHeight: 1 }}>–</span>
                          ) : (
                            <span style={{ fontSize: 12, fontFamily: 'var(--font-ui)' }}>{val}</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Seat pricing explanation */}
        <div style={s.seatSection}>
          <p style={s.eyebrow}>How Seat Pricing Works</p>
          <div style={s.seatGrid}>
            {[
              {
                title: 'What counts as a seat',
                body:  'Each active member on your platform counts as one seat. "Active" means the member has logged in at least once in the past 90 days — inactive or dormant accounts do not count.',
              },
              {
                title: 'Flat fee + seat charge',
                body:  'The flat fee covers your infrastructure, platform, and baseline capacity. The seat charge scales as your community grows — you only pay for engaged members.',
              },
              {
                title: 'Volume pricing at 500+',
                body:  'Partners with 500+ seats qualify for custom volume pricing. Reach out to start that conversation.',
              },
              {
                title: 'Annual billing discount',
                body:  'Annual billing applies a 15% discount to the flat fee only. Seat charges remain the same — keeping your recurring revenue predictable month to month.',
              },
            ].map((item, i) => (
              <div key={i} style={s.seatCard}>
                <p style={s.seatTitle}>{item.title}</p>
                <p style={s.seatBody}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Access steps */}
        <div style={{ marginTop: 64 }}>
          <p style={{ ...s.eyebrow, textAlign: 'center' }}>How to Get Access</p>
          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginBottom: 36, lineHeight: 1.6 }}>
            Ascentor operates a curated partner model. All organisation accounts are reviewed and approved by Team Ascentor before activation.
          </p>
          <div style={s.stepsWrap}>
            {ACCESS_STEPS.map((step, i) => (
              <div key={i} style={s.step}>
                <div style={s.stepNum}>{step.n}</div>
                <p style={s.stepText}>{step.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Demo + contact CTA */}
        <div style={s.ctaRow}>
          <div style={s.ctaCard}>
            <p style={s.ctaLabel}>Live Demo</p>
            <p style={s.ctaTitle}>Experience the platform before committing.</p>
            <p style={s.ctaBody}>
              Demo access reflects a real partner deployment — white-label branding, AI coaching, community, and member payment flows — exactly as your members will experience it. Approval required.
            </p>
            <a href="https://demo.ascentorbi.com" target="_blank" rel="noreferrer" style={s.ctaPrimary}>
              Request demo access →
            </a>
          </div>
          <div style={{ ...s.ctaCard, background: 'var(--bg-card)' }}>
            <p style={s.ctaLabel}>Talk to the team</p>
            <p style={s.ctaTitle}>Ready to start the conversation?</p>
            <p style={s.ctaBody}>
              Email Team Ascentor directly to begin the partner review process. We respond personally to every enquiry within 1–2 business days.
            </p>
            <a href="mailto:asamuel@ascentorbi.com?subject=Partner Enquiry" style={{ ...s.ctaPrimary, background: 'transparent', color: 'var(--gold)', border: '1.5px solid var(--gold)' }}>
              asamuel@ascentorbi.com →
            </a>
          </div>
        </div>

      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 1 — Contact Form
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div ref={topRef} style={s.formWrap}>

      {/* Left: value prop */}
      <div style={s.formLeft}>
        <p style={s.eyebrow}>For organisations</p>
        <h2 style={s.formHeadline}>
          Bring Ascentor<br />to your people.
        </h2>
        <p style={s.formSubtext}>
          Ascentor's white-label partner programme lets you deploy a fully branded AI mentorship platform for your team, institution, or community — powered by the same infrastructure behind ascentorbi.com.
        </p>

        <div style={s.valueList}>
          {[
            {
              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>,
              title: 'Custom branding',
              desc:  'Your logo, domain, and brand colours. Your members never see Ascentor.',
            },
            {
              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a2 2 0 0 1 2 2v1H10V4a2 2 0 0 1 2-2z"/><rect x="3" y="5" width="18" height="16" rx="2"/><circle cx="9" cy="13" r="1" fill="var(--gold)" stroke="none"/><circle cx="15" cy="13" r="1" fill="var(--gold)" stroke="none"/><path d="M12 16v2"/></svg>,
              title: 'AI-powered coaching',
              desc: 'Sage becomes your branded AI mentor, trained on your expertise and your community\'s needs.',
            },
            {
              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
              title: 'You keep the revenue',
              desc:  'Collect payments directly from your members. Ascentor takes a small platform fee.',
            },
          ].map((item, i) => (
            <div key={i} style={s.valueItem}>
              <div style={s.valueIcon}>{item.icon}</div>
              <div>
                <p style={s.valueTitle}>{item.title}</p>
                <p style={s.valueDesc}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={s.approvalNote}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, fontFamily: 'var(--font-ui)' }}>
            Partner access requires approval. Submit the form to request access — once reviewed, you'll see our full organisation pricing and can schedule a platform walkthrough.
          </span>
        </div>
      </div>

      {/* Right: form card */}
      <div>
        <div style={s.formCard}>
          <p style={s.formCardTitle}>Request partner access</p>
          <p style={s.formCardSub}>
            Tell us about your organisation and we'll be in touch within 1–2 business days.
          </p>

          <div style={s.fields}>
            <FormField label="Your name" placeholder="Amara Osei" value={name} onChange={setName} error={errors.name} onFocus={() => setErrors(e => ({ ...e, name: undefined }))} />
            <FormField label="Work email" placeholder="amara@yourorg.com" value={email} onChange={setEmail} error={errors.email} type="email" onFocus={() => setErrors(e => ({ ...e, email: undefined }))} />
            <FormField label="Organisation name" placeholder="Lagos Business School, Acme Corp…" value={org} onChange={setOrg} error={errors.org} onFocus={() => setErrors(e => ({ ...e, org: undefined }))} />

            <div style={s.fieldWrap}>
              <label style={s.fieldLabel}>
                What are you looking to achieve?{' '}
                <span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>(optional)</span>
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tell us about your team, what you're building, or any questions you have…"
                rows={4}
                style={{ ...s.input, resize: 'vertical', minHeight: 96 }}
              />
            </div>
          </div>

          {serverError && (
            <p style={s.serverError}>{serverError}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ ...s.submitBtn, opacity: loading ? 0.65 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Sending…' : 'Request access & see pricing →'}
          </button>

          <p style={s.formFootnote}>
            No commitment required. Pricing is revealed after your enquiry is received.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Form field sub-component ──────────────────────────────────────────────────
function FormField({ label, placeholder, value, onChange, error, type = 'text', onFocus }: {
  label: string; placeholder: string; value: string
  onChange: (v: string) => void; error?: string; type?: string; onFocus?: () => void
}) {
  return (
    <div style={s.fieldWrap}>
      <label style={s.fieldLabel}>{label}</label>
      <input
        type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)} onFocus={onFocus}
        style={{ ...s.input, borderColor: error ? 'var(--error)' : 'var(--border)' }}
      />
      {error && <p style={{ fontSize: 12, color: 'var(--error)', margin: '3px 0 0', fontFamily: 'var(--font-ui)' }}>{error}</p>}
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  // Shared
  eyebrow: {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
    textTransform: 'uppercase' as const, color: 'var(--gold)',
    marginBottom: 12, fontFamily: 'var(--font-ui)',
  },

  // ── Phase 1 form ──
  formWrap: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: 48, maxWidth: 1040, margin: '0 auto', alignItems: 'start',
  },
  formLeft:    { display: 'flex', flexDirection: 'column' as const, gap: 0 },
  formHeadline: {
    fontFamily: 'var(--font-display)', fontSize: 'clamp(30px, 3.5vw, 46px)',
    fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, marginBottom: 14,
  },
  formSubtext: { fontSize: 15, lineHeight: 1.7, color: 'var(--text-muted)', marginBottom: 28 },
  valueList:   { display: 'flex', flexDirection: 'column' as const, gap: 18, marginBottom: 24 },
  valueItem:   { display: 'flex', gap: 14, alignItems: 'flex-start' },
  valueIcon:   {
    width: 36, height: 36, borderRadius: 10,
    background: 'rgba(232,160,32,0.10)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  valueTitle:  { fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 3px', fontFamily: 'var(--font-ui)' },
  valueDesc:   { fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 },
  approvalNote: {
    display: 'flex', gap: 10, alignItems: 'flex-start', padding: '13px 16px',
    background: 'rgba(232,160,32,0.06)', border: '1px solid rgba(232,160,32,0.18)', borderRadius: 10,
  },
  formCard: {
    background: 'var(--bg-card)', border: '1px solid var(--border-light)',
    borderRadius: 20, padding: '32px 28px',
  },
  formCardTitle: {
    fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700,
    color: 'var(--text)', margin: '0 0 6px',
  },
  formCardSub:  { fontSize: 13, color: 'var(--text-muted)', margin: '0 0 24px', lineHeight: 1.6 },
  fields:       { display: 'flex', flexDirection: 'column' as const, gap: 14, marginBottom: 18 },
  fieldWrap:    { display: 'flex', flexDirection: 'column' as const, gap: 6 },
  fieldLabel:   { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' },
  input: {
    width: '100%', padding: '10px 14px', background: 'var(--bg)',
    border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)',
    fontSize: 14, fontFamily: 'var(--font-ui)', outline: 'none',
    transition: 'border-color 0.15s', boxSizing: 'border-box' as const,
  },
  serverError: {
    fontSize: 13, color: 'var(--error)',
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 8, padding: '10px 14px', margin: '0 0 14px', fontFamily: 'var(--font-ui)',
  },
  submitBtn: {
    width: '100%', padding: '13px 24px', background: 'var(--gold)', color: 'var(--dark)',
    border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
    fontFamily: 'var(--font-ui)', transition: 'opacity 0.15s', letterSpacing: '-0.01em',
  },
  formFootnote: {
    fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' as const,
    margin: '12px 0 0', fontFamily: 'var(--font-ui)',
  },

  // ── Phase 2 pricing reveal ──
  confirmBanner: {
    display: 'flex', gap: 14, alignItems: 'flex-start', padding: '16px 20px',
    background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)',
    borderRadius: 12, marginBottom: 8,
  },
  confirmIcon: {
    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
    background: 'rgba(232,160,32,0.10)', border: '1px solid rgba(232,160,32,0.22)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  revealHeadline: {
    fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 3.5vw, 44px)',
    fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, margin: '0 0 0',
  },
  planGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 20, alignItems: 'start',
  },
  planCard: {
    display: 'flex', flexDirection: 'column' as const,
    borderRadius: 20, padding: '28px 22px',
    background: 'var(--bg-card)', transition: 'box-shadow 0.2s',
    overflow: 'hidden',
  },
  planBadge: {
    position: 'absolute' as const, top: -13, left: '50%', transform: 'translateX(-50%)',
    whiteSpace: 'nowrap' as const, background: 'var(--gold)', color: 'var(--dark)',
    fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const,
    padding: '3px 14px', borderRadius: 999, fontFamily: 'var(--font-ui)',
  },
  planFor:   { fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-ui)', margin: '0 0 6px', lineHeight: 1.4 },
  planName:  { fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0 },
  planPrice: { fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, color: 'var(--text)', lineHeight: 1 },
  planUnit:  { fontSize: 13, color: 'var(--text-dim)', fontFamily: 'var(--font-ui)' },
  planSeat:  { fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', margin: '2px 0 2px' },
  planSeats: { fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-ui)', margin: '0 0 4px' },
  planAnnual:{ fontSize: 11, color: 'var(--success)', fontFamily: 'var(--font-ui)', margin: '0 0 4px' },
  planDivider: { height: 1, background: 'var(--border)', margin: '16px 0' },
  featureList: { flex: 1, listStyle: 'none', margin: '0 0 20px', padding: 0, display: 'flex', flexDirection: 'column' as const, gap: 8 },
  featureItem: { display: 'flex', alignItems: 'flex-start', gap: 8 },
  planCta: {
    display: 'block', padding: '11px 0', borderRadius: 10,
    fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-ui)',
    textAlign: 'center' as const, textDecoration: 'none', transition: 'opacity 0.15s',
  },

  // Comparison table
  table: { width: '100%', borderCollapse: 'collapse' as const, marginTop: 16 },
  th: {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
    color: 'var(--text-dim)', padding: '10px 16px', textAlign: 'center' as const,
    borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-ui)',
  },
  tdLabel: {
    padding: '10px 16px', fontSize: 13, color: 'var(--text-muted)',
    fontFamily: 'var(--font-ui)', borderBottom: '1px solid var(--border)',
  },
  td: {
    padding: '10px 16px', textAlign: 'center' as const,
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle' as const,
  },

  // Seat section
  seatSection: { marginTop: 64 },
  seatGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginTop: 16,
  },
  seatCard: {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 14, padding: '20px 22px',
  },
  seatTitle: { fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px', fontFamily: 'var(--font-ui)' },
  seatBody:  { fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, margin: 0, fontFamily: 'var(--font-ui)' },

  // Steps
  stepsWrap: {
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12,
  },
  step: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', textAlign: 'center' as const },
  stepNum: {
    width: 44, height: 44, borderRadius: '50%',
    background: 'rgba(232,160,32,0.10)', border: '1.5px solid rgba(232,160,32,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--gold)',
    marginBottom: 12, flexShrink: 0,
  },
  stepText: { fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0, fontFamily: 'var(--font-ui)' },

  // Bottom CTAs
  ctaRow: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 56,
  },
  ctaCard: {
    background: 'rgba(232,160,32,0.06)', border: '1px solid rgba(232,160,32,0.18)',
    borderRadius: 20, padding: '28px 28px',
  },
  ctaLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const,
    color: 'var(--gold)', margin: '0 0 8px', fontFamily: 'var(--font-ui)',
  },
  ctaTitle: {
    fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700,
    color: 'var(--text)', margin: '0 0 10px', lineHeight: 1.2,
  },
  ctaBody:  { fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, margin: '0 0 20px', fontFamily: 'var(--font-ui)' },
  ctaPrimary: {
    display: 'inline-block', padding: '11px 22px', background: 'var(--gold)',
    color: 'var(--dark)', fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700,
    textDecoration: 'none', borderRadius: 10, transition: 'opacity 0.15s',
  },
}
