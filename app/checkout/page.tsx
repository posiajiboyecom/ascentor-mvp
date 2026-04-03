'use client'

// ================================================================
// app/checkout/page.tsx  — PAYMENT SYSTEM v3
// ================================================================
// Flow:  /onboarding → /checkout → PaystackPop popup → /dashboard
//
// API calls:
//   POST /api/pay/start   → { accessCode, reference }
//   POST /api/pay/confirm → { success, plan }
//
// Plan IDs (match profiles.subscription_plan):
//   explorer | builder | climber
// ================================================================

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { PLAN_PRICING, MAX_YEARLY_SAVINGS } from '@/lib/pricing'

type BillingCycle = 'monthly' | 'annual'

interface Plan {
  id:           string   // matches profiles.subscription_plan
  name:         string   // display name
  description:  string
  stage:        string
  stageColor:   string
  monthlyPrice: number
  yearlyPrice:  number
  features:     string[]
  highlighted?: boolean
}

// Plan order: explorer → builder → climber
// Prices pulled from lib/pricing.ts (single source of truth)
const PLANS: Plan[] = [
  {
    id:           'explorer',
    name:         'Explorer',
    description:  'For those just starting to find their path.',
    stage:        'EXPLORER',
    stageColor:   '#14B8A6',
    monthlyPrice: PLAN_PRICING[0].monthlyPrice,
    yearlyPrice:  PLAN_PRICING[0].yearlyPrice,
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
    id:           'builder',
    name:         'Builder',
    description:  'For professionals building their career edge.',
    stage:        'BUILDER',
    stageColor:   '#E8A020',
    monthlyPrice: PLAN_PRICING[1].monthlyPrice,
    yearlyPrice:  PLAN_PRICING[1].yearlyPrice,
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
    id:           'climber',
    name:         'Climber',
    description:  'For leaders scaling teams and building legacy.',
    stage:        'CLIMBER',
    stageColor:   '#8B5CF6',
    monthlyPrice: PLAN_PRICING[2].monthlyPrice,
    yearlyPrice:  PLAN_PRICING[2].yearlyPrice,
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

declare global {
  interface Window {
    PaystackPop?: {
      setup: (cfg: Record<string, unknown>) => { openIframe: () => void }
    }
  }
}

function yearlySavings(plan: Plan) {
  return Math.round(plan.monthlyPrice * 12 - plan.yearlyPrice)
}

export default function CheckoutPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = useRef(createClient()).current

  // ── State ──────────────────────────────────────────────────────
  const [isDark,       setIsDark]       = useState(true)
  const [user,         setUser]         = useState<any>(null)
  const [profile,      setProfile]      = useState<any>(null)
  const [billing,      setBilling]      = useState<BillingCycle>(
    (searchParams.get('billing') as BillingCycle) ?? 'monthly'
  )
  const [selectedPlan, setSelectedPlan] = useState<string | null>(
    searchParams.get('plan')
  )
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState('')
  const [goingFree,    setGoingFree]    = useState(false)

  // ── Theme sync ─────────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem('asc-theme')
    setIsDark(stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'asc-theme') setIsDark(e.newValue === 'dark')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // ── Auth + profile ─────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login?redirect=/checkout'); return }
      setUser(user)
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
    }
    load()
  }, [supabase, router])

  // ── Preload Paystack script ────────────────────────────────────
  useEffect(() => {
    if (!document.getElementById('ps-script')) {
      const s = document.createElement('script')
      s.id = 'ps-script'; s.src = 'https://js.paystack.co/v1/inline.js'; s.async = true
      document.head.appendChild(s)
    }
  }, [])

  // ── Price helpers ──────────────────────────────────────────────
  function getMonthlyDisplay(plan: Plan): number {
    return billing === 'monthly' ? plan.monthlyPrice : Math.round(plan.yearlyPrice / 12)
  }

  // ── Main payment handler ───────────────────────────────────────
  async function handleSelectPlan(planId: string) {
    if (!user) { router.push('/login?redirect=/checkout'); return }

    setSelectedPlan(planId)
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // ── Step 1: Initialize on server ─────────────────────────────
      const startRes = await fetch('/api/pay/start', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ planId, billing }),
      })

      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}))
        throw new Error(err.error || `Payment setup failed (${startRes.status})`)
      }

      const { accessCode, reference } = await startRes.json()

      if (!accessCode || !reference) {
        throw new Error('Payment setup returned incomplete data. Please try again.')
      }

      // ── Step 2: Wait for Paystack script ─────────────────────────
      if (!window.PaystackPop) {
        await new Promise<void>((resolve, reject) => {
          const el = document.getElementById('ps-script') as HTMLScriptElement | null
          if (!el) { reject(new Error('Paystack script not found')); return }
          el.onload = () => resolve()
          el.onerror = () => reject(new Error('Paystack script failed to load'))
        })
      }

      if (!window.PaystackPop) {
        throw new Error('Payment system unavailable. Please refresh and try again.')
      }

      // ── Step 3: Open Paystack inline popup ───────────────────────
      const handler = window.PaystackPop.setup({
        key:         process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
        access_code: accessCode,
        ref:         reference,

        onClose: () => {
          setLoading(false)
          setSelectedPlan(null)
          setError("Payment was not completed. Try again whenever you're ready.")
        },

        callback: async (response: { reference: string }) => {
          // ── Step 4: Confirm on server ─────────────────────────────
          try {
            const confirmRes = await fetch('/api/pay/confirm', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({ reference: response.reference }),
            })
            const confirmData = await confirmRes.json()

            if (confirmRes.ok && confirmData.success) {
              setSuccess('Payment confirmed! Taking you to your dashboard…')
              setTimeout(() => router.push('/dashboard?welcome=1'), 1500)
            } else {
              // Payment went through but confirm had an issue.
              // Webhook will reconcile — send user to dashboard.
              router.push('/dashboard?payment=processing')
            }
          } catch {
            // Same — webhook is the safety net
            router.push('/dashboard?payment=processing')
          } finally {
            setLoading(false)
          }
        },
      })

      handler.openIframe()

    } catch (err: any) {
      console.error('[checkout]', err)
      setError(err.message || 'Something went wrong. Please try again.')
      setLoading(false)
      setSelectedPlan(null)
    }
  }

  const isCurrentPlan = (planId: string) => profile?.subscription_plan === planId

  // ── Render ─────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600;1,700&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .co-root[data-co-theme="dark"] {
          --bg: #0C0B08; --bg2: #1E1C17; --card: #141310;
          --text: #D4CFC3; --text-mid: #A09880; --text-muted: #7A7260; --text-faint: #4A4438;
          --bord: #2E2A22; --bord-med: #3E3A32;
          --input-bg: #1E1C17; --input-text: #D4CFC3;
          --toggle-bg: #1E1C17; --price: #FFFFFF; --heading: #FFFFFF;
          --glow: rgba(232,160,32,0.045); --grid: rgba(232,160,32,0.02);
          --shadow: none;
        }
        .co-root[data-co-theme="light"] {
          --bg: #FAF7F2; --bg2: #F2EDE4; --card: #FFFFFF;
          --text: #2A2820; --text-mid: #4A4438; --text-muted: #6B6456; --text-faint: #9A9080;
          --bord: rgba(42,40,32,0.1); --bord-med: rgba(42,40,32,0.18);
          --input-bg: #FAF7F2; --input-text: #0C0B08;
          --toggle-bg: #EDE9E0; --price: #0C0B08; --heading: #0C0B08;
          --glow: rgba(232,160,32,0.08); --grid: rgba(232,160,32,0.04);
          --shadow: 0 2px 16px rgba(42,40,32,0.04);
        }

        .co-root {
          min-height: 100vh; background: var(--bg); font-family: 'Syne', sans-serif;
          color: var(--text); position: relative; overflow-x: hidden;
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
        .co-hero { max-width: 680px; margin: 0 auto; padding: 64px 24px 0; text-align: center; position: relative; z-index: 1; }
        .co-hero-badge {
          display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px;
          border-radius: 100px; margin-bottom: 28px;
          font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
          background: rgba(20,184,166,0.08); border: 1px solid rgba(20,184,166,0.2); color: #14B8A6;
        }
        .co-hero-heading {
          font-family: 'Cormorant Garamond', serif; font-weight: 700;
          font-size: clamp(36px, 6vw, 54px); line-height: 1.05;
          color: var(--heading); margin-bottom: 16px;
        }
        .co-hero-heading em { font-style: italic; color: #E8A020; }
        .co-hero-sub { font-size: 15px; color: var(--text-muted); line-height: 1.65; max-width: 460px; margin: 0 auto 40px; }

        .co-billing {
          display: inline-flex; background: var(--toggle-bg); border: 1px solid var(--bord);
          border-radius: 12px; padding: 4px; margin-bottom: 56px;
        }
        .co-billing-btn {
          padding: 10px 24px; border-radius: 9px; border: none; cursor: pointer;
          font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 600; transition: all 0.2s;
        }
        .co-billing-btn.on  { background: #E8A020; color: #0C0B08; }
        .co-billing-btn.off { background: transparent; color: var(--text-muted); }
        .co-save-pill { display: inline-block; margin-left: 6px; padding: 2px 8px; border-radius: 4px; font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.08em; }
        .on  .co-save-pill { background: rgba(12,11,8,0.25); color: #0C0B08; }
        .off .co-save-pill { background: rgba(232,160,32,0.1); color: #E8A020; }

        .co-plans {
          max-width: 1080px; margin: 0 auto; padding: 0 24px 48px;
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; position: relative; z-index: 1;
        }
        @media (max-width: 860px) { .co-plans { grid-template-columns: 1fr; max-width: 460px; } }

        .co-plan {
          background: var(--card); border-radius: 20px; border: 1px solid var(--bord);
          padding: 32px 28px; display: flex; flex-direction: column;
          position: relative; overflow: hidden; transition: transform 0.22s; box-shadow: var(--shadow);
        }
        .co-plan:hover { transform: translateY(-4px); }
        .co-plan-hl    { border: 2px solid rgba(232,160,32,0.35) !important; }
        .co-plan-glow  { position: absolute; top: -80px; right: -80px; width: 200px; height: 200px; border-radius: 50%; filter: blur(60px); pointer-events: none; }
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
        .co-plan-name { font-family: 'Cormorant Garamond', serif; font-weight: 700; font-size: 28px; color: var(--heading); margin-bottom: 6px; }
        .co-plan-desc { font-size: 13px; color: var(--text-muted); margin-bottom: 24px; line-height: 1.5; }

        .co-price-row { display: flex; align-items: baseline; gap: 3px; }
        .co-price-sym { font-family: 'Cormorant Garamond', serif; font-size: 20px; font-weight: 600; color: #7A7260; align-self: flex-start; margin-top: 6px; }
        .co-price-num { font-family: 'Cormorant Garamond', serif; font-size: 48px; font-weight: 700; color: var(--price); line-height: 1; letter-spacing: -1px; }
        .co-price-per { font-size: 13px; color: var(--text-muted); align-self: flex-end; margin-bottom: 4px; }
        .co-price-note { font-size: 11px; color: var(--text-faint); margin-top: 5px; font-family: 'DM Mono', monospace; letter-spacing: 0.04em; }

        .co-features { list-style: none; flex: 1; display: flex; flex-direction: column; gap: 10px; margin-bottom: 28px; }
        .co-feature  { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: var(--text-mid); line-height: 1.5; }
        .co-feat-chk { width: 17px; height: 17px; border-radius: 5px; flex-shrink: 0; margin-top: 1px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; }

        .co-trial-box {
          text-align: center; padding: 14px 20px; margin-bottom: 14px; border-radius: 10px;
          background: var(--toggle-bg); border: 1px solid var(--bord);
          font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.06em; color: var(--text-muted); line-height: 1.6;
        }
        .co-trial-box strong { color: var(--heading); }

        .co-cta {
          padding: 14px 24px; border-radius: 10px; border: none;
          font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700;
          cursor: pointer; width: 100%; transition: all 0.2s;
        }
        .co-cta:disabled { opacity: 0.4; cursor: not-allowed; }
        .co-cta-note { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.06em; color: #4A4438; text-align: center; margin-top: 8px; }

        .co-alerts { max-width: 440px; margin: 0 auto 20px; padding: 0 24px; position: relative; z-index: 1; }
        .co-error   { padding: 13px 16px; border-radius: 10px; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.2); color: #EF4444; font-size: 13px; }
        .co-success { padding: 13px 16px; border-radius: 10px; background: rgba(20,184,166,0.06); border: 1px solid rgba(20,184,166,0.2); color: #14B8A6; font-size: 13px; }

        .co-trust { max-width: 680px; margin: 0 auto; padding: 28px 24px 72px; text-align: center; position: relative; z-index: 1; border-top: 1px solid var(--bord); }
        .co-trust-items { display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; margin-bottom: 18px; }
        .co-trust-item  { display: flex; align-items: center; gap: 7px; font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.06em; color: var(--text-muted); }
        .co-trust-note  { font-size: 12px; color: var(--text-muted); line-height: 1.65; }
        .co-trust-link  { color: #E8A020; text-decoration: none; }
      `}</style>

      <div className="co-root" data-co-theme={isDark ? 'dark' : 'light'}>

        {/* Nav */}
        <nav className="co-nav">
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <path d="M4 26L16 6l12 20H4z" stroke="#E8A020" strokeWidth="1.8" strokeLinejoin="round"/>
              <path d="M8 26L16 12l8 14H8z" stroke="#E8A020" strokeWidth="1.2" strokeLinejoin="round" fill="rgba(232,160,32,0.1)"/>
              <path d="M4 26h24" stroke="#E8A020" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 20, color: 'var(--heading)' }}>
              Ascentor
            </span>
          </Link>
          <a href="/onboarding" style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-muted)', textDecoration: 'none', padding: '7px 14px', borderRadius: 8, border: '1px solid var(--bord)' }}>
            Back
          </a>
          <button
            onClick={() => { const n = isDark ? 'light' : 'dark'; setIsDark(!isDark); localStorage.setItem('asc-theme', n) }}
            style={{ background: 'none', border: '1px solid var(--bord)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
          >
            {isDark
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
          </button>
        </nav>

        {/* Hero */}
        <div className="co-hero">
          <div className="co-hero-badge">
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#14B8A6' }} />
            Start today — cancel anytime
          </div>
          <h1 className="co-hero-heading">
            Everyone who made it<br/>had <em>someone.</em>
          </h1>
          <p className="co-hero-sub">
            Sage, expert sessions, and peer accountability — for ambitious professionals. Choose your stage.
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

        {/* Alerts */}
        {(error || success) && (
          <div className="co-alerts">
            {error   && <div className="co-error">{error}</div>}
            {success && <div className="co-success">&#10003; {success}</div>}
          </div>
        )}

        {/* Plans */}
        <div className="co-plans">
          {PLANS.map(plan => {
            const monthly  = getMonthlyDisplay(plan)
            const current  = isCurrentPlan(plan.id)
            const spinning = loading && selectedPlan === plan.id

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

                {/* Price */}
                <div style={{ marginBottom: 24 }}>
                  <div className="co-price-row">
                    <span className="co-price-sym">&#8358;</span>
                    <span className="co-price-num">{monthly.toLocaleString()}</span>
                    <span className="co-price-per">/mo</span>
                  </div>
                  {billing === 'annual' && (
                    <p className="co-price-note">&#8358;{plan.yearlyPrice.toLocaleString()} BILLED ANNUALLY</p>
                  )}
                  {billing === 'annual' && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '3px 10px', borderRadius: 20, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <span style={{ color: '#10B981', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', fontFamily: "'DM Mono', monospace" }}>
                        &#10003; SAVE &#8358;{yearlySavings(plan).toLocaleString()}/YR
                      </span>
                    </div>
                  )}
                </div>

                {/* Features */}
                <ul className="co-features">
                  {plan.features.map((f, i) => (
                    <li key={i} className="co-feature">
                      <span className="co-feat-chk" style={{ background: `${plan.stageColor}12`, color: plan.stageColor }}>&#10003;</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Trial notice */}
                <div className="co-trial-box">
                  <strong>7-day free trial.</strong> No charge until Day 8.<br/>Cancel before then and pay nothing.
                </div>

                <button
                  className="co-cta"
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={current || spinning}
                  style={
                    current ? { background: 'transparent', color: '#4A4438', border: '1px solid #2E2A22' }
                    : plan.highlighted ? { background: '#E8A020', color: '#0C0B08' }
                    : { background: `${plan.stageColor}14`, color: plan.stageColor, border: `1px solid ${plan.stageColor}25` }
                  }
                >
                  {spinning ? 'Opening payment…' : current ? '&#10003; Current Plan' : 'Start 7-day trial'}
                </button>

                {!current && <p className="co-cta-note">7-DAY FREE TRIAL · CANCEL ANYTIME</p>}
              </div>
            )
          })}
        </div>

        {/* Free escape hatch */}
        {(!profile?.subscription_plan || profile?.subscription_plan === 'free') && (
          <div style={{ textAlign: 'center', marginTop: 20, marginBottom: 32, position: 'relative', zIndex: 1 }}>
            <button
              onClick={() => { setGoingFree(true); router.push('/dashboard') }}
              disabled={goingFree}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: '0.05em', color: '#4A4438', textDecoration: 'underline', opacity: goingFree ? 0.5 : 1 }}
            >
              {goingFree ? 'Going to dashboard…' : 'Not ready yet? Continue with the free plan'}
            </button>
          </div>
        )}

        {/* Trust bar */}
        <div className="co-trust">
          <div className="co-trust-items">
            {[
              { icon: '🎁', text: '7-DAY MONEY BACK' },
              { icon: '🔒', text: 'PAYSTACK SECURED' },
              { icon: '↩', text: 'CANCEL ANYTIME' },
              { icon: '💳', text: 'CARD · BANK · USSD' },
            ].map((t, i) => (
              <div key={i} className="co-trust-item">{t.icon} {t.text}</div>
            ))}
          </div>
          <p className="co-trust-note">
            Prices in NGN · 7-day money-back guarantee.{' '}
            Questions? <a href="mailto:hello@ascentorbi.com" className="co-trust-link">hello@ascentorbi.com</a>
          </p>
        </div>

      </div>
    </>
  )
}
