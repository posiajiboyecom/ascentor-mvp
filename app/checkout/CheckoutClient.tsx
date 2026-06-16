// FILE: app/checkout/page.tsx
// FIXES: #1 theme-aware logo · #2 global theme toggle sync · #3 Most Popular badge visible

'use client'

// ================================================================
// app/checkout/page.tsx — UNIFIED PLAN SELECTION PAGE
// ================================================================
// Single page for all plan decisions. Replaces /pricing entirely.
//
// States handled:
//   1. New user (from onboarding)  → full plan picker + free escape hatch
//   2. Free user (from dashboard)  → full plan picker + "stay free" option
//   3. Paid user — Explorer        → current plan highlighted + upgrade to Builder/Climber
//   4. Paid user — Builder         → current plan highlighted + upgrade to Climber
//   5. Paid user — Climber         → you're at the top, manage in account
//
// Flow: click plan → POST /api/pay/start → redirect to Paystack hosted page
//       → pay → GET /api/pay/callback → subscription activated → /dashboard?welcome=1
// ================================================================

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { PLAN_PRICING, MAX_YEARLY_SAVINGS } from '@/lib/pricing'

type BillingCycle = 'monthly' | 'annual'

interface Plan {
  id:           string
  name:         string
  description:  string
  stage:        string
  stageColor:   string
  monthlyPrice: number
  yearlyPrice:  number
  yearlyMonthly: number
  features:     string[]
  highlighted?: boolean
}

const PLANS: Plan[] = [
  {
    id:            'explorer',
    name:          'Explorer',
    description:   'For those just starting to find their path.',
    stage:         'EXPLORER',
    stageColor:    '#14B8A6',
    monthlyPrice:  PLAN_PRICING[0].monthlyPrice,
    yearlyPrice:   PLAN_PRICING[0].yearlyPrice,
    yearlyMonthly: PLAN_PRICING[0].yearlyPerMonth,
    features: [
      'Sage AI — 10 sessions/month',
      '1 mentorship circle',
      'Mentor session recordings',
      'Playbooks & frameworks library',
      'Goal tracking (3 active goals)',
      'Weekly reflection prompts',
    ],
  },
  {
    id:            'builder',
    name:          'Builder',
    description:   'For professionals building their career edge.',
    stage:         'BUILDER',
    stageColor:    '#E8A020',
    monthlyPrice:  PLAN_PRICING[1].monthlyPrice,
    yearlyPrice:   PLAN_PRICING[1].yearlyPrice,
    yearlyMonthly: PLAN_PRICING[1].yearlyPerMonth,
    features: [
      'Sage AI — unlimited sessions',
      'Up to 3 mentorship circles',
      'Live mentor sessions (monthly)',
      'Human mentor matching',
      'Personal development plan',
      'Career strategy templates',
      'Export session history',
      'Analytics dashboard',
    ],
    highlighted: true,
  },
  {
    id:            'climber',
    name:          'Climber',
    description:   'For leaders scaling teams and building legacy.',
    stage:         'CLIMBER',
    stageColor:    '#8B5CF6',
    monthlyPrice:  PLAN_PRICING[2].monthlyPrice,
    yearlyPrice:   PLAN_PRICING[2].yearlyPrice,
    yearlyMonthly: PLAN_PRICING[2].yearlyPerMonth,
    features: [
      'Everything in Builder',
      'Unlimited mentorship circles',
      '1-on-1 expert session (quarterly)',
      'Executive peer circle',
      'Advanced analytics dashboard',
      'Team dashboard (up to 10)',
      'Dedicated account manager',
      'Quarterly strategy reviews',
    ],
  },
]

// Plan rank for upgrade logic
const PLAN_RANK: Record<string, number> = { free: 0, explorer: 1, builder: 2, climber: 3 }

function yearlySavings(plan: Plan) {
  return Math.round(plan.monthlyPrice * 12 - plan.yearlyPrice)
}

export default function CheckoutClient() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = useMemo(() => createClient(), [])
  const fromOnboarding = searchParams.get('from') === 'onboarding'

  const [isDark,        setIsDark]        = useState(true)
  const [user,          setUser]          = useState<any>(null)
  const [profile,       setProfile]       = useState<any>(null)
  const [loading,       setLoading]       = useState(true)
  const [billing,       setBilling]       = useState<BillingCycle>(
    (searchParams.get('billing') as BillingCycle) ?? 'monthly'
  )
  const [selectedPlan,  setSelectedPlan]  = useState<string | null>(searchParams.get('plan'))
  const [paying,        setPaying]        = useState(false)
  const [error,         setError]         = useState('')
  const [goingFree,     setGoingFree]     = useState(false)

  // Theme — reads from localStorage/html attr and keeps in sync with AppThemeProvider
  useEffect(() => {
    const attr = document.documentElement.getAttribute('data-app-theme')
    if (attr === 'light' || attr === 'dark') {
      setIsDark(attr === 'dark')
    } else {
      const stored = localStorage.getItem('asc-theme')
      setIsDark(stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches)
    }
    // Listen for theme changes made by AppThemeProvider on other pages
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'asc-theme') setIsDark(e.newValue === 'dark')
    }
    // Also listen for same-page changes via custom event
    const onThemeChange = () => {
      const a = document.documentElement.getAttribute('data-app-theme')
      if (a === 'light' || a === 'dark') setIsDark(a === 'dark')
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('asc-theme-change', onThemeChange)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('asc-theme-change', onThemeChange)
    }
  }, [])

  // Auth + profile
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login?redirect=/checkout'); return }
      setUser(user)
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
      setLoading(false)
    }
    load()
  }, [supabase, router])

  // Derived subscription state
  // Normalise legacy plan names (basic→explorer, standard→builder, premium→climber)
  // so PLANS.find() and PLAN_RANK always resolve correctly regardless of what's in the DB.
  const PLAN_ALIAS: Record<string, string> = {
    basic: 'explorer', standard: 'builder', premium: 'climber',
  }
  const rawPlan       = profile?.subscription_plan || 'free'
  const currentPlan   = PLAN_ALIAS[rawPlan] ?? rawPlan
  const subStatus     = profile?.subscription_status
  const subEnd        = profile?.subscription_end
  const isActivePaid  = ['active', 'trialing'].includes(subStatus) &&
    (!subEnd || new Date(subEnd) > new Date()) &&
    currentPlan !== 'free'
  const currentRank   = PLAN_RANK[currentPlan] ?? 0
  const isTopTier     = currentPlan === 'climber' && isActivePaid

  function getDisplayPrice(plan: Plan): number {
    return billing === 'monthly' ? plan.monthlyPrice : plan.yearlyMonthly
  }

  async function handleSelectPlan(planId: string) {
    if (!user) { router.push('/login?redirect=/checkout'); return }
    setSelectedPlan(planId)
    setPaying(true)
    setError('')

    try {
      const res = await fetch('/api/pay/start', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ planId, billing }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Payment setup failed (${res.status})`)
      }

      const { authorizationUrl, error: apiError } = await res.json()
      if (apiError) throw new Error(apiError)
      if (!authorizationUrl) throw new Error('No payment URL returned. Please try again.')

      window.location.href = authorizationUrl

    } catch (err: any) {
      console.error('[checkout]', err)
      setError(err.message || 'Something went wrong. Please try again.')
      setPaying(false)
      setSelectedPlan(null)
    }
  }

  function handleContinueFree() {
    setGoingFree(true)
    router.push('/dashboard')
  }

  // ── Paid user view ─────────────────────────────────────────────
  if (!loading && isActivePaid) {
    const upgradePlans = PLANS.filter(p => PLAN_RANK[p.id] > currentRank)
    const currentMeta  = PLANS.find(p => p.id === currentPlan)

    return (
      <>
        <style>{checkoutStyles(isDark)}</style>
        <div className="co-root" data-co-theme={isDark ? 'dark' : 'light'}>
          <nav className="co-nav">
            <Link href="/dashboard" className="co-back-btn">← Dashboard</Link>
          </nav>

          <div className="co-hero">
            <div className="co-hero-badge" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#10B981' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#10B981' }} />
              {subStatus === 'trialing' ? 'Trial Active' : 'Subscription Active'}
            </div>
            <h1 className="co-hero-heading">
              You're on <em style={{ color: currentMeta?.stageColor }}>{currentMeta?.name || currentPlan}</em>
            </h1>
            <p className="co-hero-sub">
              {isTopTier
                ? "You're at the top tier. Manage your subscription in account settings."
                : "Ready to unlock more? Upgrade your plan below."}
            </p>
          </div>

          {isTopTier ? (
            <div style={{ textAlign: 'center', padding: '40px 24px' }}>
              <Link href="/account"
                className="co-cta"
                style={{ display: 'inline-block', width: 'auto', padding: '14px 40px', background: '#E8A020', color: '#0C0B08', borderRadius: 10, fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                Manage Subscription
              </Link>
            </div>
          ) : (
            <>
              {/* Current plan card */}
              {currentMeta && (
                <div style={{ maxWidth: 400, margin: '0 auto 32px', padding: '0 24px' }}>
                  <div className="co-plan" style={{ border: `2px solid ${currentMeta.stageColor}50`, opacity: 0.7 }}>
                    <div className="co-stage" style={{ background: `${currentMeta.stageColor}12`, border: `1px solid ${currentMeta.stageColor}25` }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: currentMeta.stageColor }} />
                      <span style={{ color: currentMeta.stageColor }}>CURRENT PLAN</span>
                    </div>
                    <h3 className="co-plan-name" style={{ color: currentMeta.stageColor }}>{currentMeta.name}</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace", letterSpacing: '0.04em' }}>
                      {subEnd ? `Access until ${new Date(subEnd).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Active'}
                    </p>
                  </div>
                </div>
              )}

              {/* Billing toggle */}
              <div className="co-hero" style={{ paddingTop: 0, paddingBottom: 24 }}>
                <div className="co-billing">
                  {(['monthly', 'annual'] as BillingCycle[]).map(c => (
                    <button key={c} onClick={() => setBilling(c)} className={`co-billing-btn ${billing === c ? 'on' : 'off'}`}>
                      {c === 'monthly' ? 'Monthly' : 'Annual'}
                      {c === 'annual' && <span className="co-save-pill">SAVE 20%</span>}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="co-alerts"><div className="co-error">{error}</div></div>
              )}

              {/* Upgrade plan cards */}
              <div className="co-plans" style={{ maxWidth: upgradePlans.length === 1 ? 460 : 900 }}>
                {upgradePlans.map(plan => {
                  const spinning = paying && selectedPlan === plan.id
                  return (
                    <div key={plan.id} className={`co-plan ${plan.highlighted ? 'co-plan-hl' : ''}`}>
                      <div className="co-plan-glow" style={{ background: `radial-gradient(circle, ${plan.stageColor}22, transparent 70%)` }} />
                      {plan.highlighted && <div className="co-popular">Most Popular</div>}
                      <div className="co-stage" style={{ background: `${plan.stageColor}12`, border: `1px solid ${plan.stageColor}25` }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: plan.stageColor }} />
                        <span style={{ color: plan.stageColor }}>{plan.stage}</span>
                      </div>
                      <h3 className="co-plan-name">{plan.name}</h3>
                      <p className="co-plan-desc">{plan.description}</p>
                      <div style={{ marginBottom: 24 }}>
                        <div className="co-price-row">
                          <span className="co-price-sym">&#8358;</span>
                          <span className="co-price-num">{getDisplayPrice(plan).toLocaleString()}</span>
                          <span className="co-price-per">/mo</span>
                        </div>
                        {billing === 'annual' && (
                          <p className="co-price-note">&#8358;{plan.yearlyPrice.toLocaleString()} BILLED ANNUALLY · SAVE &#8358;{yearlySavings(plan).toLocaleString()}</p>
                        )}
                      </div>
                      <ul className="co-features">
                        {plan.features.map((f, i) => (
                          <li key={i} className="co-feature">
                            <span className="co-feat-chk" style={{ background: `${plan.stageColor}12`, color: plan.stageColor }}>✓</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                      <button
                        className="co-cta"
                        onClick={() => handleSelectPlan(plan.id)}
                        disabled={spinning}
                        style={{ background: plan.highlighted ? '#E8A020' : `${plan.stageColor}18`, color: plan.highlighted ? '#0C0B08' : plan.stageColor, border: plan.highlighted ? 'none' : `1px solid ${plan.stageColor}30` }}
                      >
                        {spinning ? 'Redirecting...' : `Upgrade to ${plan.name}`}
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          <TrustBar />
        </div>
      </>
    )
  }

  // ── Free / new user view ───────────────────────────────────────
  return (
    <>
      <style>{checkoutStyles(isDark)}</style>
      <div className="co-root" data-co-theme={isDark ? 'dark' : 'light'}>

        <nav className="co-nav">
          <Link href="/" className="co-nav-logo">
            <LogoImg isDark={isDark} />
            <span className="co-logo-text">Ascentor</span>
          </Link>
          {!fromOnboarding && (
            <Link href="/dashboard" className="co-back-btn">← Dashboard</Link>
          )}
          <button
            onClick={() => {
              const next = isDark ? 'light' : 'dark'
              setIsDark(!isDark)
              localStorage.setItem('asc-theme', next)
              document.documentElement.setAttribute('data-app-theme', next)
              window.dispatchEvent(new Event('asc-theme-change'))
            }}
            className="co-theme-btn"
          >
            {isDark
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
          </button>
        </nav>

        <div className="co-hero">
          {fromOnboarding && (
            <div className="co-hero-badge">
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#14B8A6' }} />
              Step 3 of 3 — Choose Your Plan
            </div>
          )}
          <h1 className="co-hero-heading">
            Everyone who made it<br/>had <em>someone.</em>
          </h1>
          <p className="co-hero-sub">
            Sage, expert sessions, and peer accountability — for ambitious professionals. Start free, upgrade when ready.
          </p>

          <div className="co-billing">
            {(['monthly', 'annual'] as BillingCycle[]).map(c => (
              <button key={c} onClick={() => setBilling(c)} className={`co-billing-btn ${billing === c ? 'on' : 'off'}`}>
                {c === 'monthly' ? 'Monthly' : 'Annual'}
                {c === 'annual' && <span className="co-save-pill">SAVE 20%</span>}
              </button>
            ))}
          </div>

          {billing === 'monthly' && (
            <p style={{ fontSize: 12, color: '#7A7260', marginTop: 10 }}>
              Switch to annual and save up to{' '}
              <span style={{ color: '#E8A020', fontWeight: 600 }}>&#8358;{MAX_YEARLY_SAVINGS.toLocaleString()}/year</span>
            </p>
          )}
        </div>

        {error && (
          <div className="co-alerts"><div className="co-error">{error}</div></div>
        )}

        <div className="co-plans">
          {PLANS.map(plan => {
            const spinning = paying && selectedPlan === plan.id

            return (
              <div key={plan.id} className={`co-plan ${plan.highlighted ? 'co-plan-hl' : ''}`}>
                <div className="co-plan-glow" style={{ background: `radial-gradient(circle, ${plan.stageColor}22, transparent 70%)` }} />
                {plan.highlighted && <div className="co-popular">Most Popular</div>}

                <div className="co-stage" style={{ background: `${plan.stageColor}12`, border: `1px solid ${plan.stageColor}25` }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: plan.stageColor }} />
                  <span style={{ color: plan.stageColor }}>{plan.stage}</span>
                </div>

                <h3 className="co-plan-name">{plan.name}</h3>
                <p className="co-plan-desc">{plan.description}</p>

                <div style={{ marginBottom: 24 }}>
                  <div className="co-price-row">
                    <span className="co-price-sym">&#8358;</span>
                    <span className="co-price-num">{getDisplayPrice(plan).toLocaleString()}</span>
                    <span className="co-price-per">/mo</span>
                  </div>
                  {billing === 'annual' && (
                    <p className="co-price-note">&#8358;{plan.yearlyPrice.toLocaleString()} BILLED ANNUALLY</p>
                  )}
                  {billing === 'annual' && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '3px 10px', borderRadius: 20, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <span style={{ color: '#10B981', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', fontFamily: "'DM Mono', monospace" }}>
                        ✓ SAVE &#8358;{yearlySavings(plan).toLocaleString()}/YR
                      </span>
                    </div>
                  )}
                </div>

                <ul className="co-features">
                  {plan.features.map((f, i) => (
                    <li key={i} className="co-feature">
                      <span className="co-feat-chk" style={{ background: `${plan.stageColor}12`, color: plan.stageColor }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="co-trial-box">
                  <strong>7-day free trial.</strong> No charge until Day 8.<br/>Cancel before then and pay nothing.
                </div>

                <button
                  className="co-cta"
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={spinning}
                  style={
                    plan.highlighted
                      ? { background: '#E8A020', color: '#0C0B08' }
                      : { background: `${plan.stageColor}14`, color: plan.stageColor, border: `1px solid ${plan.stageColor}25` }
                  }
                >
                  {spinning ? 'Redirecting to payment…' : 'Start 7-day trial'}
                </button>
                <p className="co-cta-note">7-DAY FREE TRIAL · CANCEL ANYTIME</p>
              </div>
            )
          })}
        </div>

        {/* Free escape hatch — always visible */}
        <div style={{ textAlign: 'center', marginTop: 8, marginBottom: 40, position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            padding: '16px 28px', borderRadius: 12,
            background: 'var(--bg2)', border: '1px solid var(--bord)',
          }}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Free Plan Includes
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-mid)' }}>
              Sage AI (3 sessions) · 1 mentorship circle · Goal tracking
            </p>
            <button
              onClick={handleContinueFree}
              disabled={goingFree}
              style={{
                marginTop: 4, background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: '0.05em',
                color: '#7A7260', textDecoration: 'underline',
                opacity: goingFree ? 0.5 : 1,
              }}
            >
              {goingFree ? 'Going to dashboard…' : 'Continue with free plan →'}
            </button>
          </div>
        </div>

        <TrustBar />
      </div>
    </>
  )
}

// ── Shared components ──────────────────────────────────────────

function LogoImg({ isDark }: { isDark: boolean }) {
  return (
    <img
      src={isDark ? '/ascentor-color-for-dark-pages.svg' : '/ascentor-color-for-light-pages.svg'}
      alt="Ascentor"
      onError={(e) => { (e.target as HTMLImageElement).src = '/ascentor-color-for-dark-pages.svg'; }}
      style={{ height: 30, width: 'auto' }}
    />
  )
}

function TrustBar() {
  return (
    <div className="co-trust">
      <div className="co-trust-items">
        {[
          { icon: '🔒', text: 'PAYSTACK SECURED' },
          { icon: '↩', text: 'CANCEL ANYTIME' },
          { icon: '💳', text: 'CARD · BANK · USSD' },
          { icon: '🎁', text: '7-DAY FREE TRIAL' },
        ].map((t, i) => (
          <div key={i} className="co-trust-item">{t.icon} {t.text}</div>
        ))}
      </div>
      <p className="co-trust-note">
        Prices in NGN · Questions?{' '}
        <a href="mailto:hello@ascentorbi.com" className="co-trust-link">hello@ascentorbi.com</a>
      </p>
    </div>
  )
}

function checkoutStyles(isDark: boolean): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600;1,700&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    .co-root[data-co-theme="dark"] {
      --bg: #0C0B08; --bg2: #1E1C17; --card: #141310;
      --text: #D4CFC3; --text-mid: #A09880; --text-muted: #7A7260; --text-faint: #4A4438;
      --bord: #2E2A22; --bord-med: #3E3A32;
      --toggle-bg: #1E1C17; --price: #FFFFFF; --heading: #FFFFFF;
      --glow: rgba(232,160,32,0.045); --grid: rgba(232,160,32,0.02); --shadow: none;
    }
    .co-root[data-co-theme="light"] {
      --bg: #FAF7F2; --bg2: #F2EDE4; --card: #FFFFFF;
      --text: #2A2820; --text-mid: #4A4438; --text-muted: #6B6456; --text-faint: #9A9080;
      --bord: rgba(42,40,32,0.1); --bord-med: rgba(42,40,32,0.18);
      --toggle-bg: #EDE9E0; --price: #0C0B08; --heading: #0C0B08;
      --glow: rgba(232,160,32,0.08); --grid: rgba(232,160,32,0.04);
      --shadow: 0 2px 16px rgba(42,40,32,0.04);
    }

    .co-root {
      min-height: 100vh; background: var(--bg);
      font-family: 'Syne', sans-serif; color: var(--text);
      position: relative; overflow-x: hidden;
    }
    .co-root::before {
      content: ''; position: fixed; top: -200px; left: 50%; transform: translateX(-50%);
      width: 900px; height: 900px;
      background: radial-gradient(circle, var(--glow) 0%, transparent 60%);
      pointer-events: none; z-index: 0;
    }
    .co-root::after {
      content: ''; position: fixed; inset: 0;
      background-image: linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px);
      background-size: 48px 48px; pointer-events: none; z-index: 0;
    }

    .co-nav {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 32px; border-bottom: 1px solid var(--bord);
      background: var(--bg); position: sticky; top: 0; z-index: 20;
    }
    .co-nav-logo {
      display: flex; align-items: center; gap: 10px; text-decoration: none;
    }
    .co-logo-text {
      font-family: 'Cormorant Garamond', serif; font-weight: 700;
      font-size: 20px; color: var(--heading);
    }
    .co-back-btn {
      font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.08em;
      color: var(--text-muted); text-decoration: none;
      padding: 7px 14px; border-radius: 8px; border: 1px solid var(--bord);
    }
    .co-theme-btn {
      background: none; border: 1px solid var(--bord); border-radius: 8px;
      padding: 7px 10px; cursor: pointer; color: var(--text-muted);
      display: flex; align-items: center;
    }

    .co-hero {
      max-width: 680px; margin: 0 auto; padding: 56px 24px 0; text-align: center; position: relative; z-index: 1;
    }
    .co-hero-badge {
      display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px;
      border-radius: 100px; margin-bottom: 28px;
      font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
      background: rgba(20,184,166,0.08); border: 1px solid rgba(20,184,166,0.2); color: #14B8A6;
    }
    .co-hero-heading {
      font-family: 'Cormorant Garamond', serif; font-weight: 700;
      font-size: clamp(34px, 6vw, 52px); line-height: 1.05;
      color: var(--heading); margin-bottom: 16px;
    }
    .co-hero-heading em { font-style: italic; color: #E8A020; }
    .co-hero-sub {
      font-size: 15px; color: var(--text-muted); line-height: 1.65;
      max-width: 460px; margin: 0 auto 36px;
    }

    .co-billing {
      display: inline-flex; background: var(--toggle-bg); border: 1px solid var(--bord);
      border-radius: 12px; padding: 4px; margin-bottom: 48px;
    }
    .co-billing-btn {
      padding: 10px 24px; border-radius: 9px; border: none; cursor: pointer;
      font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 600; transition: all 0.2s;
    }
    .co-billing-btn.on  { background: #E8A020; color: #0C0B08; }
    .co-billing-btn.off { background: transparent; color: var(--text-muted); }
    .co-save-pill {
      display: inline-block; margin-left: 6px; padding: 2px 8px;
      border-radius: 4px; font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.08em;
    }
    .on  .co-save-pill { background: rgba(12,11,8,0.25); color: #0C0B08; }
    .off .co-save-pill { background: rgba(232,160,32,0.1); color: #E8A020; }

    .co-alerts { max-width: 440px; margin: 0 auto 20px; padding: 0 24px; position: relative; z-index: 1; }
    .co-error {
      padding: 13px 16px; border-radius: 10px;
      background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.2);
      color: #EF4444; font-size: 13px;
    }

    .co-plans {
      max-width: 1080px; margin: 0 auto; padding: 0 24px 48px;
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; position: relative; z-index: 1;
    }
    @media (max-width: 860px) { .co-plans { grid-template-columns: 1fr; max-width: 460px; } }

    .co-plan {
      background: var(--card); border-radius: 20px; border: 1px solid var(--bord);
      padding: 32px 28px; display: flex; flex-direction: column;
      position: relative; overflow: visible; transition: transform 0.22s; box-shadow: var(--shadow);
      margin-top: 14px;
    }
    .co-plan:hover { transform: translateY(-4px); }
    .co-plan-hl   { border: 2px solid rgba(232,160,32,0.35) !important; }
    .co-plan-glow {
      position: absolute; top: -80px; right: -80px; width: 200px; height: 200px;
      border-radius: 50%; filter: blur(60px); pointer-events: none;
      overflow: hidden;
    }
    .co-popular {
      position: absolute; top: -13px; left: 50%; transform: translateX(-50%);
      padding: 4px 16px; border-radius: 100px; white-space: nowrap;
      font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase;
      background: #E8A020; color: #0C0B08;
    }
    .co-stage {
      display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px;
      border-radius: 100px; margin-bottom: 20px; width: fit-content;
      font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase;
    }
    .co-plan-name {
      font-family: 'Cormorant Garamond', serif; font-weight: 700;
      font-size: 28px; color: var(--heading); margin-bottom: 6px;
    }
    .co-plan-desc { font-size: 13px; color: var(--text-muted); margin-bottom: 24px; line-height: 1.5; }

    .co-price-row { display: flex; align-items: baseline; gap: 3px; }
    .co-price-sym {
      font-family: 'Cormorant Garamond', serif; font-size: 20px; font-weight: 600;
      color: #7A7260; align-self: flex-start; margin-top: 6px;
    }
    .co-price-num {
      font-family: 'Cormorant Garamond', serif; font-size: 48px; font-weight: 700;
      color: var(--price); line-height: 1; letter-spacing: -1px;
    }
    .co-price-per { font-size: 13px; color: var(--text-muted); align-self: flex-end; margin-bottom: 4px; }
    .co-price-note {
      font-size: 11px; color: var(--text-faint); margin-top: 5px;
      font-family: 'DM Mono', monospace; letter-spacing: 0.04em;
    }

    .co-features {
      list-style: none; flex: 1; display: flex; flex-direction: column;
      gap: 10px; margin-bottom: 28px;
    }
    .co-feature { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: var(--text-mid); line-height: 1.5; }
    .co-feat-chk {
      width: 17px; height: 17px; border-radius: 5px; flex-shrink: 0; margin-top: 1px;
      display: flex; align-items: center; justify-content: center;
      font-size: 9px; font-weight: 700;
    }

    .co-trial-box {
      text-align: center; padding: 14px 20px; margin-bottom: 14px; border-radius: 10px;
      background: var(--toggle-bg); border: 1px solid var(--bord);
      font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.06em;
      color: var(--text-muted); line-height: 1.6;
    }
    .co-trial-box strong { color: var(--heading); }

    .co-cta {
      padding: 14px 24px; border-radius: 10px; border: none;
      font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700;
      cursor: pointer; width: 100%; transition: all 0.2s;
    }
    .co-cta:disabled { opacity: 0.4; cursor: not-allowed; }
    .co-cta-note {
      font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.06em;
      color: #4A4438; text-align: center; margin-top: 8px;
    }

    .co-trust {
      max-width: 680px; margin: 0 auto; padding: 28px 24px 72px;
      text-align: center; position: relative; z-index: 1; border-top: 1px solid var(--bord);
    }
    .co-trust-items {
      display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; margin-bottom: 18px;
    }
    .co-trust-item {
      display: flex; align-items: center; gap: 7px;
      font-family: 'DM Mono', monospace; font-size: 10px;
      letter-spacing: 0.06em; color: var(--text-muted);
    }
    .co-trust-note { font-size: 12px; color: var(--text-muted); line-height: 1.65; }
    .co-trust-link { color: #E8A020; text-decoration: none; }
  `
}
