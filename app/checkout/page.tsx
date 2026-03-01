'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

type BillingCycle = 'monthly' | 'yearly';

interface Plan {
  id: string;
  name: string;
  description: string;
  stage: string;
  stageColor: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  highlighted?: boolean;
  cta: string;
}

const PLANS: Plan[] = [
  {
    id: 'basic',
    name: 'Explorer',
    description: 'Start your journey with guided AI mentorship.',
    stage: 'EXPLORER',
    stageColor: '#14B8A6',
    monthlyPrice: 15,
    yearlyPrice: 120,
    features: [
      '10 AI coaching sessions/month',
      'Community cohort access',
      'Course library',
      'Goal tracking (3 active goals)',
      'Weekly reflection prompts',
      'Coaching session summaries',
    ],
    cta: 'Start Free Trial',
  },
  {
    id: 'standard',
    name: 'Builder',
    description: 'Unlimited coaching for the serious professional.',
    stage: 'BUILDER',
    stageColor: '#E8A020',
    monthlyPrice: 25,
    yearlyPrice: 200,
    features: [
      'Unlimited AI coaching sessions',
      'Full course library',
      'Expert session recordings',
      'Unlimited goal tracking',
      'Advanced coaching summaries',
      'Priority community support',
      'Export coaching history',
      'Analytics dashboard',
    ],
    highlighted: true,
    cta: 'Start Free Trial',
  },
  {
    id: 'premium',
    name: 'Climber',
    description: 'For leaders building teams and legacies.',
    stage: 'CLIMBER',
    stageColor: '#8B5CF6',
    monthlyPrice: 49,
    yearlyPrice: 396,
    features: [
      'Everything in Builder',
      'Team dashboard (25 seats)',
      'Custom coaching frameworks',
      'Dedicated account manager',
      'SSO integration',
      'API access',
      'Custom branding',
      'Quarterly strategy reviews',
    ],
    cta: 'Start Free Trial',
  },
];

const PROMO_CODES: Record<string, { discount: number; label: string; appliesTo: string[] }> = {
  'FOUNDER50':  { discount: 0.50, label: '50% off — Founders Discount', appliesTo: ['basic', 'standard', 'premium'] },
  'ASCENTOR50': { discount: 0.50, label: '50% off — Early Access',      appliesTo: ['basic', 'standard', 'premium'] },
  'EARLYBIRD':  { discount: 0.50, label: '50% off — Early Bird',        appliesTo: ['basic', 'standard', 'premium'] },
  'TESTER100':  { discount: 1.00, label: 'Free Access — Beta Tester',   appliesTo: ['basic', 'standard'] },
  'BETATESTER': { discount: 1.00, label: 'Free Access — Beta Tester',   appliesTo: ['basic', 'standard'] },
  'FREEACCESS': { discount: 1.00, label: 'Free Access',                 appliesTo: ['basic', 'standard'] },
};

const NGN_PER_USD = 1600;

export default function CheckoutPage() {
  const [billing, setBilling]           = useState<BillingCycle>('monthly');
  const [promoCode, setPromoCode]       = useState('');
  const [promoApplied, setPromoApplied] = useState<{ discount: number; label: string } | null>(null);
  const [promoError, setPromoError]     = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);
  const [user, setUser]                 = useState<any>(null);
  const [profile, setProfile]           = useState<any>(null);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');

  const router   = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login?redirect=/checkout'); return; }
      setUser(user);
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(profile);
    };
    loadUser();
  }, [supabase, router]);

  useEffect(() => {
    if (typeof window !== 'undefined' && !document.getElementById('paystack-script')) {
      const s = document.createElement('script');
      s.id = 'paystack-script'; s.src = 'https://js.paystack.co/v2/inline.js'; s.async = true;
      document.head.appendChild(s);
    }
  }, []);

  const applyPromo = () => {
    setPromoError(''); setPromoApplied(null);
    const code = promoCode.trim().toUpperCase();
    const promo = PROMO_CODES[code];
    if (!promo) { setPromoError('Invalid promo code'); return; }
    setPromoApplied({ discount: promo.discount, label: promo.label });
  };

  const getPrice = (plan: Plan) => {
    const base = billing === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
    if (promoApplied && PROMO_CODES[promoCode.trim().toUpperCase()]?.appliesTo.includes(plan.id)) {
      return Math.round(base * (1 - promoApplied.discount) * 100) / 100;
    }
    return base;
  };

  const handleSelectPlan = async (planId: string) => {
    if (!user) { router.push('/login?redirect=/checkout'); return; }
    setSelectedPlan(planId); setLoading(true); setError(''); setSuccess('');
    const plan = PLANS.find(p => p.id === planId)!;
    const finalPrice = getPrice(plan);

    if (finalPrice === 0 && promoApplied?.discount === 1) {
      try {
        const res = await fetch('/api/payment/initialize', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, userId: user.id, promoCode: promoCode.trim().toUpperCase() }),
        });
        const data = await res.json();
        if (data.free) { setSuccess('Account activated! Setting up your profile…'); setTimeout(() => router.push('/onboarding'), 2000); }
        else setError(data.error || 'Failed to activate promo');
      } catch { setError('Failed to process. Please try again.'); }
      setLoading(false); return;
    }

    const amountKobo = Math.round(finalPrice * NGN_PER_USD * 100);
    const reference = `asc_${user.id.slice(0, 8)}_${Date.now()}`;
    try {
      // @ts-ignore
      const paystack = new window.PaystackPop();
      paystack.newTransaction({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
        email: user.email, amount: amountKobo, currency: 'NGN', ref: reference,
        metadata: {
          user_id: user.id, plan: planId, billing_cycle: billing,
          promo_code: promoCode.trim().toUpperCase() || null, is_trial: true,
        },
        onSuccess: async (transaction: any) => {
          try {
            const res = await fetch('/api/payment/verify', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reference: transaction.reference, userId: user.id, plan: planId, billing }),
            });
            const data = await res.json();
            if (data.success) { setSuccess("Payment confirmed! Let's set up your profile."); setTimeout(() => router.push('/onboarding'), 2000); }
            else setError('Payment received but verification failed. Contact support.');
          } catch { setError('Payment may have succeeded. Contact support if not reflected.'); }
          setLoading(false);
        },
        onCancel: () => { setLoading(false); setSelectedPlan(null); },
      });
    } catch {
      setError('Payment system unavailable. Please try again later.');
      setLoading(false);
    }
  };

  const isCurrentPlan = (planId: string) => profile?.subscription_plan === planId;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600;1,700&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .co-root {
          min-height: 100vh;
          background: #0C0B08;
          font-family: 'Syne', sans-serif;
          color: #D4CFC3;
          position: relative;
          overflow-x: hidden;
        }

        /* Ambient glow */
        .co-root::before {
          content: '';
          position: fixed;
          top: -200px; left: 50%;
          transform: translateX(-50%);
          width: 900px; height: 900px;
          background: radial-gradient(circle, rgba(232,160,32,0.045) 0%, transparent 60%);
          pointer-events: none; z-index: 0;
        }
        /* Grid texture */
        .co-root::after {
          content: '';
          position: fixed; inset: 0;
          background-image:
            linear-gradient(rgba(232,160,32,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(232,160,32,0.02) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none; z-index: 0;
        }

        /* ── NAV ── */
        .co-nav {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 32px;
          border-bottom: 1px solid #2E2A22;
          background: rgba(12,11,8,0.9);
          backdrop-filter: blur(16px);
          position: sticky; top: 0; z-index: 20;
        }
        .co-nav-logo {
          display: flex; align-items: center; gap: 10px; text-decoration: none;
        }
        .co-nav-logo-text {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 700; font-size: 20px; color: #fff;
        }
        .co-nav-back {
          font-family: 'DM Mono', monospace;
          font-size: 11px; letter-spacing: 0.08em;
          color: #4A4438; text-decoration: none;
          padding: 7px 14px; border-radius: 8px;
          border: 1px solid #2E2A22;
          transition: color 0.2s, border-color 0.2s;
        }
        .co-nav-back:hover { color: #D4CFC3; border-color: #4A4438; }

        /* ── HERO ── */
        .co-hero {
          max-width: 680px; margin: 0 auto;
          padding: 64px 24px 0;
          text-align: center;
          position: relative; z-index: 1;
        }
        .co-hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 16px; border-radius: 100px; margin-bottom: 28px;
          font-family: 'DM Mono', monospace;
          font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
          background: rgba(20,184,166,0.08);
          border: 1px solid rgba(20,184,166,0.2);
          color: #14B8A6;
        }
        .co-hero-badge-dot {
          width: 5px; height: 5px; border-radius: 50%; background: #14B8A6;
        }
        .co-hero-heading {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 700; font-size: clamp(36px, 6vw, 54px);
          line-height: 1.05; letter-spacing: -0.5px;
          color: #fff; margin-bottom: 16px;
        }
        .co-hero-heading em {
          font-style: italic; color: #E8A020;
        }
        .co-hero-sub {
          font-size: 15px; color: #7A7260; line-height: 1.65;
          max-width: 460px; margin: 0 auto 40px;
        }

        /* ── BILLING TOGGLE ── */
        .co-billing {
          display: inline-flex;
          background: #1E1C17;
          border: 1px solid #2E2A22;
          border-radius: 12px; padding: 4px;
          margin-bottom: 56px;
        }
        .co-billing-btn {
          padding: 10px 24px; border-radius: 9px; border: none; cursor: pointer;
          font-family: 'Syne', sans-serif;
          font-size: 13px; font-weight: 600;
          transition: all 0.2s;
        }
        .co-billing-btn.active {
          background: #E8A020; color: #0C0B08;
        }
        .co-billing-btn.inactive {
          background: transparent; color: #4A4438;
        }
        .co-save-pill {
          display: inline-block;
          margin-left: 6px; padding: 2px 8px;
          border-radius: 4px;
          font-family: 'DM Mono', monospace;
          font-size: 9px; letter-spacing: 0.08em; font-weight: 500;
        }
        .active .co-save-pill { background: rgba(12,11,8,0.25); color: #0C0B08; }
        .inactive .co-save-pill { background: rgba(232,160,32,0.1); color: #E8A020; }

        /* ── PLANS GRID ── */
        .co-plans {
          max-width: 1080px; margin: 0 auto;
          padding: 0 24px 48px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          position: relative; z-index: 1;
        }
        @media (max-width: 860px) {
          .co-plans { grid-template-columns: 1fr; max-width: 460px; }
        }

        .co-plan {
          background: #141310;
          border-radius: 20px;
          padding: 32px 28px;
          display: flex; flex-direction: column;
          position: relative; overflow: hidden;
          transition: transform 0.22s, box-shadow 0.22s;
        }
        .co-plan:hover { transform: translateY(-4px); }
        .co-plan-highlighted {
          border: 2px solid rgba(232,160,32,0.35) !important;
        }
        .co-plan-glow {
          position: absolute; top: -80px; right: -80px;
          width: 200px; height: 200px; border-radius: 50%;
          filter: blur(60px); pointer-events: none;
        }

        .co-popular {
          position: absolute; top: -13px; left: 50%; transform: translateX(-50%);
          padding: 4px 16px; border-radius: 100px; white-space: nowrap;
          font-family: 'DM Mono', monospace;
          font-size: 9px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase;
          background: #E8A020; color: #0C0B08;
        }

        /* Stage pill */
        .co-stage {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 10px; border-radius: 100px; margin-bottom: 20px;
          width: fit-content;
          font-family: 'DM Mono', monospace;
          font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase;
        }
        .co-stage-dot { width: 5px; height: 5px; border-radius: 50%; }

        .co-plan-name {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 700; font-size: 28px; color: #fff;
          letter-spacing: -0.3px; margin-bottom: 6px;
        }
        .co-plan-desc { font-size: 13px; color: #7A7260; margin-bottom: 24px; line-height: 1.5; }

        /* Price */
        .co-price-wrap { margin-bottom: 24px; }
        .co-price-main {
          display: flex; align-items: baseline; gap: 3px;
        }
        .co-price-dollar {
          font-family: 'Cormorant Garamond', serif;
          font-size: 20px; font-weight: 600; color: #7A7260;
          align-self: flex-start; margin-top: 6px;
        }
        .co-price-num {
          font-family: 'Cormorant Garamond', serif;
          font-size: 48px; font-weight: 700; color: #fff;
          line-height: 1; letter-spacing: -1px;
        }
        .co-price-per { font-size: 13px; color: #4A4438; align-self: flex-end; margin-bottom: 4px; }
        .co-price-note { font-size: 11px; color: #4A4438; margin-top: 5px; font-family: 'DM Mono', monospace; letter-spacing: 0.04em; }
        .co-price-promo { font-size: 12px; margin-top: 6px; }

        /* Features */
        .co-features {
          list-style: none; flex: 1;
          display: flex; flex-direction: column; gap: 10px;
          margin-bottom: 28px;
        }
        .co-feature {
          display: flex; align-items: flex-start; gap: 10px;
          font-size: 13px; color: #7A7260; line-height: 1.5;
        }
        .co-feature-check {
          width: 17px; height: 17px; border-radius: 5px; flex-shrink: 0; margin-top: 1px;
          display: flex; align-items: center; justify-content: center;
          font-size: 9px; font-weight: 700;
        }

        /* CTA */
        .co-cta {
          padding: 14px 24px; border-radius: 10px; border: none;
          font-family: 'Syne', sans-serif;
          font-size: 14px; font-weight: 700; letter-spacing: 0.02em;
          cursor: pointer; width: 100%; transition: all 0.2s;
        }
        .co-cta:disabled { opacity: 0.4; cursor: not-allowed; }
        .co-cta-note {
          font-family: 'DM Mono', monospace;
          font-size: 10px; letter-spacing: 0.06em; color: #4A4438;
          text-align: center; margin-top: 8px;
        }

        /* ── PROMO ── */
        .co-promo-wrap {
          max-width: 440px; margin: 0 auto 28px; padding: 0 24px;
          position: relative; z-index: 1;
        }
        .co-promo-card {
          background: #141310; border: 1px solid #2E2A22;
          border-radius: 14px; padding: 20px 22px;
        }
        .co-promo-label {
          font-family: 'DM Mono', monospace;
          font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
          color: #4A4438; margin-bottom: 12px;
        }
        .co-promo-row { display: flex; gap: 8px; }
        .co-promo-input {
          flex: 1; padding: 11px 14px; border-radius: 9px;
          border: 1px solid #2E2A22; background: #1E1C17;
          color: #D4CFC3; font-family: 'DM Mono', monospace;
          font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase;
          outline: none; transition: border-color 0.2s;
        }
        .co-promo-input::placeholder { color: #4A4438; }
        .co-promo-input:focus { border-color: rgba(232,160,32,0.4); }
        .co-promo-btn {
          padding: 11px 18px; border-radius: 9px; border: none;
          background: #E8A020; color: #0C0B08;
          font-family: 'Syne', sans-serif;
          font-size: 13px; font-weight: 700; cursor: pointer;
          transition: background 0.2s;
        }
        .co-promo-btn:hover { background: #F5C55A; }
        .co-promo-success { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.06em; color: #14B8A6; margin-top: 8px; }
        .co-promo-error   { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.06em; color: #EF4444; margin-top: 8px; }

        /* ── ALERTS ── */
        .co-alert-wrap { max-width: 440px; margin: 0 auto 20px; padding: 0 24px; position: relative; z-index: 1; }
        .co-alert-error   { padding: 13px 16px; border-radius: 10px; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.2); color: #EF4444; font-size: 13px; }
        .co-alert-success { padding: 13px 16px; border-radius: 10px; background: rgba(20,184,166,0.06); border: 1px solid rgba(20,184,166,0.2); color: #14B8A6; font-size: 13px; }

        /* ── TRUST ── */
        .co-trust {
          max-width: 680px; margin: 0 auto;
          padding: 28px 24px 72px; text-align: center;
          position: relative; z-index: 1;
          border-top: 1px solid #1E1C17;
        }
        .co-trust-items {
          display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; margin-bottom: 18px;
        }
        .co-trust-item {
          display: flex; align-items: center; gap: 7px;
          font-family: 'DM Mono', monospace;
          font-size: 10px; letter-spacing: 0.06em; color: #4A4438;
        }
        .co-trust-note { font-size: 12px; color: #4A4438; line-height: 1.65; }
        .co-trust-link { color: #E8A020; text-decoration: none; }
        .co-trust-link:hover { color: #F5C55A; }
      `}</style>

      <div className="co-root">

        {/* NAV */}
        <nav className="co-nav">
          <Link href="/" className="lp-nav-logo">
  <img
    src="/ascentor-color-for-dark-pages.svg"
    alt="Ascentor"
    style={{ height: '32px', width: 'auto' }}
  />
</Link>
          <a href="/dashboard" className="co-nav-back">← Dashboard</a>
        </nav>

        {/* HERO */}
        <div className="co-hero">
          <div className="co-hero-badge">
            <div className="co-hero-badge-dot" />
            7-day free trial — no charge until day 8
          </div>
          <h1 className="co-hero-heading">
            Everyone who made it<br/>
            had <em>someone.</em>
          </h1>
          <p className="co-hero-sub">
            AI mentorship, expert sessions, and peer accountability — built for the African professional. Choose your stage.
          </p>

          {/* Billing toggle */}
          <div className="co-billing">
            {(['monthly', 'yearly'] as BillingCycle[]).map(cycle => (
              <button
                key={cycle}
                onClick={() => setBilling(cycle)}
                className={`co-billing-btn ${billing === cycle ? 'active' : 'inactive'}`}
              >
                {cycle === 'monthly' ? 'Monthly' : 'Yearly'}
                {cycle === 'yearly' && <span className="co-save-pill">SAVE 33%</span>}
              </button>
            ))}
          </div>
        </div>

        {/* PLANS */}
        <div className="co-plans">
          {PLANS.map(plan => {
            const price    = getPrice(plan);
            const current  = isCurrentPlan(plan.id);
            const isHL     = plan.highlighted;
            const promoKey = promoCode.trim().toUpperCase();
            const hasPromo = promoApplied && PROMO_CODES[promoKey]?.appliesTo.includes(plan.id);
            const monthlyDisplay = billing === 'monthly' ? price : Math.round(price / 12);

            return (
              <div
                key={plan.id}
                className={`co-plan ${isHL ? 'co-plan-highlighted' : ''}`}
                style={{ border: `1px solid ${isHL ? 'rgba(232,160,32,0.3)' : '#2E2A22'}` }}
              >
                {/* Glow */}
                <div className="co-plan-glow" style={{ background: `radial-gradient(circle, ${plan.stageColor}22, transparent 70%)` }} />

                {isHL && <div className="co-popular">Most Popular</div>}

                {/* Stage pill */}
                <div className="co-stage" style={{ background: `${plan.stageColor}12`, border: `1px solid ${plan.stageColor}25` }}>
                  <div className="co-stage-dot" style={{ background: plan.stageColor }} />
                  <span style={{ color: plan.stageColor }}>{plan.stage}</span>
                </div>

                <h3 className="co-plan-name">{plan.name}</h3>
                <p className="co-plan-desc">{plan.description}</p>

                {/* Price */}
                <div className="co-price-wrap">
                  <div className="co-price-main">
                    <span className="co-price-dollar">$</span>
                    <span className="co-price-num">{monthlyDisplay}</span>
                    <span className="co-price-per">/mo</span>
                  </div>
                  {billing === 'yearly' && (
                    <p className="co-price-note">${price} BILLED ANNUALLY</p>
                  )}
                  {hasPromo && price < (billing === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice) && (
                    <p className="co-price-promo" style={{ color: plan.stageColor, fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: '0.06em' }}>
                      ✓ {promoApplied!.label}
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="co-features">
                  {plan.features.map((f, i) => (
                    <li key={i} className="co-feature">
                      <span className="co-feature-check" style={{ background: `${plan.stageColor}12`, color: plan.stageColor }}>
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  className="co-cta"
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={current || (loading && selectedPlan === plan.id)}
                  style={
                    current ? {
                      background: 'transparent',
                      color: '#4A4438',
                      border: '1px solid #2E2A22',
                    } : isHL ? {
                      background: '#E8A020',
                      color: '#0C0B08',
                    } : {
                      background: `${plan.stageColor}14`,
                      color: plan.stageColor,
                      border: `1px solid ${plan.stageColor}25`,
                    }
                  }
                >
                  {loading && selectedPlan === plan.id
                    ? 'Processing…'
                    : current
                      ? '✓ Current Plan'
                      : plan.cta}
                </button>

                {!current && (
                  <p className="co-cta-note">7-DAY FREE TRIAL · CANCEL ANYTIME</p>
                )}
              </div>
            );
          })}
        </div>

        {/* PROMO */}
        <div className="co-promo-wrap">
          <div className="co-promo-card">
            <p className="co-promo-label">Have a promo code?</p>
            <div className="co-promo-row">
              <input
                type="text"
                value={promoCode}
                onChange={e => { setPromoCode(e.target.value); setPromoError(''); if (!e.target.value) setPromoApplied(null); }}
                placeholder="ENTER CODE"
                className="co-promo-input"
                onKeyDown={e => e.key === 'Enter' && applyPromo()}
              />
              <button onClick={applyPromo} className="co-promo-btn">Apply</button>
            </div>
            {promoApplied && <p className="co-promo-success">✓ {promoApplied.label}</p>}
            {promoError   && <p className="co-promo-error">✗ {promoError}</p>}
          </div>
        </div>

        {/* Alerts */}
        {error   && <div className="co-alert-wrap"><div className="co-alert-error">{error}</div></div>}
        {success && <div className="co-alert-wrap"><div className="co-alert-success">✓ {success}</div></div>}

        {/* Trust */}
        <div className="co-trust">
          <div className="co-trust-items">
            {[
              { icon: '🎁', text: '7-DAY FREE TRIAL' },
              { icon: '🔒', text: 'PAYSTACK SECURED' },
              { icon: '↩', text: 'CANCEL ANYTIME' },
              { icon: '💳', text: 'CARD · BANK · USSD' },
            ].map((t, i) => (
              <div key={i} className="co-trust-item">
                <span>{t.icon}</span>{t.text}
              </div>
            ))}
          </div>
          <p className="co-trust-note">
            Prices in USD · charged in NGN at current rate.{' '}
            Questions?{' '}
            <a href="mailto:asamuel@ascentorbi.com" className="co-trust-link">hello@ascentorbi.com</a>
          </p>
        </div>

      </div>
    </>
  );
}
