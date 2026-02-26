'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type BillingCycle = 'monthly' | 'yearly';

interface Plan {
  id: string;
  name: string;
  description: string;
  icon: string;
  monthlyPrice: number;
  yearlyPrice: number;
  paystackPlanCode?: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
  accentColor: string;
  accentGlow: string;
}

const PLANS: Plan[] = [
  {
    id: 'basic',
    name: 'Basic',
    description: 'Essential coaching for emerging leaders',
    icon: '🌱',
    monthlyPrice: 15,
    yearlyPrice: 120,
    accentColor: '#A6A2FF',
    accentGlow: 'rgba(166,162,255,0.12)',
    features: [
      '10 AI coaching sessions/month',
      'Access to community cohorts',
      'Course library access',
      'Goal tracking (3 active goals)',
      'Weekly reflection prompts',
      'Coaching session summaries',
    ],
    cta: 'Start Free Trial',
  },
  {
    id: 'standard',
    name: 'Standard',
    description: 'Unlimited coaching for serious leaders',
    icon: '🚀',
    monthlyPrice: 25,
    yearlyPrice: 200,
    accentColor: '#6662FF',
    accentGlow: 'rgba(102,98,255,0.18)',
    features: [
      'Unlimited AI coaching sessions',
      'Full course library access',
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
    name: 'Premium',
    description: 'For teams building leaders at scale',
    icon: '🏛️',
    monthlyPrice: 49,
    yearlyPrice: 396,
    accentColor: '#CFFF5E',
    accentGlow: 'rgba(207,255,94,0.10)',
    features: [
      'Everything in Standard',
      'Team dashboard (up to 25 seats)',
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
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        email: user.email, amount: amountKobo, currency: 'NGN', ref: reference,
        metadata: { custom_fields: [
          { display_name: 'Plan', variable_name: 'plan', value: planId },
          { display_name: 'Billing', variable_name: 'billing', value: billing },
          ...(promoApplied ? [{ display_name: 'Promo', variable_name: 'promo', value: promoCode.trim().toUpperCase() }] : []),
        ], user_id: user.id, plan: planId, billing_cycle: billing, promo_code: promoCode.trim().toUpperCase() || null, is_trial: true },
        onSuccess: async (transaction: any) => {
          try {
            const res = await fetch('/api/payment/verify', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reference: transaction.reference, userId: user.id, plan: planId, billing }),
            });
            const data = await res.json();
            if (data.success) { setSuccess("Payment confirmed! Let's set up your profile."); setTimeout(() => router.push('/onboarding'), 2000); }
            else setError('Payment received but verification failed. Contact support.');
          } catch { setError('Payment may have succeeded. If not reflected, contact support.'); }
          setLoading(false);
        },
        onCancel: () => { setLoading(false); setSelectedPlan(null); },
      });
    } catch (err) {
      setError('Payment system unavailable. Please try again later.');
      setLoading(false);
    }
  };

  const isCurrentPlan = (planId: string) => profile?.subscription_plan === planId;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        .checkout-root {
          min-height: 100vh;
          background: #0F0F14;
          color: #F0EFF8;
          font-family: 'Inter', sans-serif;
        }

        /* Nav bar */
        .checkout-nav {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 24px; border-bottom: 1px solid #1E1E2E;
          background: rgba(15,15,20,0.92);
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          position: sticky; top: 0; z-index: 10;
        }
        .checkout-nav-logo {
          display: flex; align-items: center; gap: 10px; text-decoration: none;
        }
        .checkout-nav-logo-text {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 17px; font-weight: 700; color: #F0EFF8; letter-spacing: -0.01em;
        }
        .checkout-back {
          font-size: 13px; color: #5E5C7A; text-decoration: none;
          padding: 6px 12px; border-radius: 8px; border: 1px solid #1E1E2E;
          transition: all 0.18s; font-family: 'Inter', sans-serif;
        }
        .checkout-back:hover { color: #F0EFF8; border-color: #2A2A3E; }

        /* Hero */
        .checkout-hero {
          max-width: 1120px; margin: 0 auto;
          padding: 56px 24px 0; text-align: center;
        }
        .checkout-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 7px 18px; border-radius: 100px; margin-bottom: 24px;
          font-size: 13px; font-weight: 600;
          background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25);
          color: #10B981; font-family: 'Inter', sans-serif;
        }
        .checkout-title {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: clamp(28px, 5vw, 46px); font-weight: 800;
          line-height: 1.1; letter-spacing: -0.02em; margin-bottom: 14px;
        }
        .checkout-title-gradient {
          background: linear-gradient(135deg, #F0EFF8 0%, #A6A2FF 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .checkout-subtitle {
          font-size: 17px; color: #9896B8; max-width: 520px; margin: 0 auto 36px;
          line-height: 1.65; font-family: 'Inter', sans-serif;
        }

        /* Billing toggle */
        .billing-toggle {
          display: inline-flex;
          background: #16161F; border: 1px solid #1E1E2E;
          border-radius: 12px; padding: 4px; margin-bottom: 48px;
        }
        .billing-btn {
          padding: 10px 24px; border-radius: 9px; border: none; cursor: pointer;
          font-size: 14px; font-weight: 600; transition: all 0.2s;
          font-family: 'Inter', sans-serif;
        }
        .billing-btn.active {
          background: #6662FF; color: #fff;
          box-shadow: 0 4px 12px rgba(102,98,255,0.35);
        }
        .billing-btn.inactive { background: transparent; color: #5E5C7A; }
        .billing-save {
          margin-left: 6px; font-size: 10px; padding: 2px 7px;
          border-radius: 4px; font-weight: 700; letter-spacing: 0.02em;
        }
        .billing-btn.active .billing-save { background: rgba(255,255,255,0.15); color: #fff; }
        .billing-btn.inactive .billing-save { background: rgba(102,98,255,0.12); color: #A6A2FF; }

        /* Plan cards */
        .plans-grid {
          max-width: 1120px; margin: 0 auto 40px;
          padding: 0 24px;
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
        }
        @media (max-width: 900px) { .plans-grid { grid-template-columns: 1fr; max-width: 480px; } }

        .plan-card {
          background: #16161F; border-radius: 20px; padding: 32px 28px;
          display: flex; flex-direction: column; position: relative; overflow: hidden;
          transition: transform 0.22s, box-shadow 0.22s;
        }
        .plan-card:hover { transform: translateY(-4px); }
        .plan-card .card-glow-orb {
          position: absolute; top: -60px; right: -60px;
          width: 160px; height: 160px; border-radius: 50%;
          filter: blur(50px); pointer-events: none; opacity: 0.7;
        }

        .popular-badge {
          position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
          padding: 4px 16px; border-radius: 100px;
          font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
          background: #6662FF; color: #fff;
          box-shadow: 0 4px 16px rgba(102,98,255,0.45);
          font-family: 'Inter', sans-serif; white-space: nowrap;
        }

        .plan-icon-wrap {
          width: 48px; height: 48px; border-radius: 12px; margin-bottom: 16px;
          display: flex; align-items: center; justify-content: center; font-size: 22px;
        }
        .plan-name {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 22px; font-weight: 800; color: #F0EFF8;
          margin-bottom: 4px; letter-spacing: -0.01em;
        }
        .plan-desc { font-size: 13px; color: #5E5C7A; margin-bottom: 24px; font-family: 'Inter', sans-serif; }

        .plan-price-big {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 42px; font-weight: 800; color: #F0EFF8;
          line-height: 1; letter-spacing: -0.02em;
        }
        .plan-price-per { font-size: 15px; color: #5E5C7A; margin-left: 4px; font-family: 'Inter', sans-serif; }
        .plan-price-note { font-size: 12px; color: #5E5C7A; margin-top: 5px; font-family: 'Inter', sans-serif; }
        .plan-price-strike { color: #2A2A3E; }
        .plan-price-promo { font-size: 12px; margin-top: 4px; font-family: 'Inter', sans-serif; }

        .plan-features { list-style: none; padding: 0; margin: 24px 0 28px; flex: 1; display: flex; flex-direction: column; gap: 10px; }
        .plan-feature {
          display: flex; align-items: flex-start; gap: 10px;
          font-size: 13.5px; color: #9896B8; line-height: 1.5; font-family: 'Inter', sans-serif;
        }
        .plan-feature-check {
          width: 18px; height: 18px; border-radius: 5px; flex-shrink: 0; margin-top: 1px;
          display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800;
        }

        .plan-btn {
          padding: 13px 24px; border-radius: 11px; border: none;
          font-size: 15px; font-weight: 800; cursor: pointer; width: 100%;
          transition: all 0.2s; font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .plan-btn-note {
          font-size: 11px; color: #5E5C7A; text-align: center;
          margin-top: 8px; font-family: 'Inter', sans-serif;
        }

        /* Promo section */
        .promo-section {
          max-width: 440px; margin: 0 auto 24px; padding: 0 24px;
        }
        .promo-card {
          background: #16161F; border: 1px solid #1E1E2E;
          border-radius: 14px; padding: 20px;
        }
        .promo-label {
          font-size: 13px; font-weight: 600; color: #F0EFF8;
          margin-bottom: 12px; font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .promo-row { display: flex; gap: 8px; }
        .promo-input {
          flex: 1; padding: 10px 14px; border-radius: 9px;
          border: 1px solid #1E1E2E; background: #13131B;
          color: #F0EFF8; font-size: 14px; outline: none;
          text-transform: uppercase; font-family: 'Inter', sans-serif;
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .promo-input:focus { border-color: #6662FF; box-shadow: 0 0 0 3px rgba(102,98,255,0.15); }
        .promo-apply-btn {
          padding: 10px 18px; border-radius: 9px; border: none;
          background: #6662FF; color: #fff;
          font-weight: 700; font-size: 14px; cursor: pointer;
          font-family: 'Inter', sans-serif; transition: opacity 0.18s;
        }
        .promo-apply-btn:hover { opacity: 0.85; }
        .promo-success { font-size: 13px; color: #10B981; margin-top: 8px; font-family: 'Inter, sans-serif'; }
        .promo-error   { font-size: 13px; color: #EF4444; margin-top: 8px; font-family: 'Inter, sans-serif'; }

        /* Alert banners */
        .alert-wrap { max-width: 480px; margin: 0 auto 20px; padding: 0 24px; }
        .alert-error   { padding: 13px 16px; border-radius: 10px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); color: #EF4444; font-size: 14px; font-family: 'Inter', sans-serif; }
        .alert-success { padding: 13px 16px; border-radius: 10px; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.25); color: #10B981; font-size: 14px; font-family: 'Inter', sans-serif; }

        /* Trust row */
        .trust-section {
          max-width: 680px; margin: 0 auto;
          padding: 32px 24px 64px; text-align: center;
        }
        .trust-items { display: flex; justify-content: center; gap: 28px; flex-wrap: wrap; margin-bottom: 20px; }
        .trust-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #5E5C7A; font-family: 'Inter', sans-serif; }
        .trust-note { font-size: 13px; color: #5E5C7A; line-height: 1.65; font-family: 'Inter', sans-serif; }
        .trust-link { color: #A6A2FF; text-decoration: none; }
        .trust-link:hover { color: #6662FF; }
      `}</style>

      <div className="checkout-root">
        {/* Nav */}
        <nav className="checkout-nav">
          <a href="/" className="checkout-nav-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 3L22 20H2L12 3Z" fill="#6662FF" fillOpacity="0.12" stroke="#6662FF" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M12 8L18 20H6L12 8Z" fill="#6662FF" fillOpacity="0.35"/>
              <path d="M9 20H15" stroke="#A6A2FF" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="checkout-nav-logo-text">Ascentor</span>
          </a>
          <a href="/dashboard" className="checkout-back">← Dashboard</a>
        </nav>

        {/* Hero */}
        <div className="checkout-hero">
          <div className="checkout-eyebrow">
            <span>🎉</span>
            All plans include a 7-day free trial — no charge until day 8
          </div>
          <h1 className="checkout-title">
            <span className="checkout-title-gradient">Invest in your leadership</span>
          </h1>
          <p className="checkout-subtitle">
            AI-powered coaching built for African professionals. Choose the plan that matches your ambition.
          </p>

          {/* Billing toggle */}
          <div className="billing-toggle">
            {(['monthly', 'yearly'] as BillingCycle[]).map(cycle => (
              <button
                key={cycle}
                onClick={() => setBilling(cycle)}
                className={`billing-btn ${billing === cycle ? 'active' : 'inactive'}`}
              >
                {cycle === 'monthly' ? 'Monthly' : 'Yearly'}
                {cycle === 'yearly' && (
                  <span className="billing-save">Save 33%</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Plans */}
        <div className="plans-grid">
          {PLANS.map(plan => {
            const price   = getPrice(plan);
            const current = isCurrentPlan(plan.id);
            const isHL    = plan.highlighted;
            const promoKey = promoCode.trim().toUpperCase();
            const hasPromo = promoApplied && PROMO_CODES[promoKey]?.appliesTo.includes(plan.id);

            return (
              <div
                key={plan.id}
                className="plan-card"
                style={{
                  border: `${isHL ? '2px' : '1px'} solid ${isHL ? 'rgba(102,98,255,0.45)' : '#1E1E2E'}`,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = isHL
                    ? `0 20px 56px ${plan.accentGlow}`
                    : '0 16px 40px rgba(0,0,0,0.3)';
                }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
              >
                {/* Glow orb */}
                <div className="card-glow-orb" style={{ background: `radial-gradient(circle, ${plan.accentGlow.replace('0.18', '0.5').replace('0.12', '0.5').replace('0.10', '0.5')}, transparent 70%)` }} />

                {isHL && <div className="popular-badge">Most Popular</div>}

                {/* Icon */}
                <div className="plan-icon-wrap" style={{ background: `${plan.accentColor}15`, border: `1px solid ${plan.accentColor}25` }}>
                  {plan.icon}
                </div>

                <h3 className="plan-name">{plan.name}</h3>
                <p className="plan-desc">{plan.description}</p>

                {/* Price display */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline' }}>
                    <span className="plan-price-big">
                      ${billing === 'monthly' ? price : Math.round(price / 12)}
                    </span>
                    <span className="plan-price-per">/month</span>
                  </div>
                  {billing === 'yearly' && (
                    <p className="plan-price-note">
                      ${price} billed annually
                      {hasPromo && (
                        <span style={{ color: plan.accentColor, marginLeft: 6 }}>
                          (was ${plan.yearlyPrice})
                        </span>
                      )}
                    </p>
                  )}
                  {billing === 'monthly' && hasPromo && price < plan.monthlyPrice && (
                    <p className="plan-price-promo" style={{ color: plan.accentColor }}>
                      <s className="plan-price-strike">${plan.monthlyPrice}</s>
                      {' '}{promoApplied!.label}
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="plan-features">
                  {plan.features.map((f, i) => (
                    <li key={i} className="plan-feature">
                      <span className="plan-feature-check" style={{ background: `${plan.accentColor}15`, color: plan.accentColor }}>
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={current || (loading && selectedPlan === plan.id)}
                  className="plan-btn"
                  style={{
                    background: current
                      ? 'transparent'
                      : isHL
                        ? '#6662FF'
                        : `${plan.accentColor}18`,
                    color: current
                      ? '#5E5C7A'
                      : isHL
                        ? '#fff'
                        : plan.accentColor,
                    border: current ? '1px solid #1E1E2E' : 'none',
                    boxShadow: isHL && !current ? '0 6px 20px rgba(102,98,255,0.35)' : 'none',
                    cursor: current ? 'default' : 'pointer',
                    opacity: loading && selectedPlan === plan.id ? 0.7 : 1,
                  }}
                  onMouseEnter={e => {
                    if (!current) {
                      (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                      if (isHL) (e.target as HTMLElement).style.boxShadow = '0 8px 28px rgba(102,98,255,0.5)';
                    }
                  }}
                  onMouseLeave={e => {
                    (e.target as HTMLElement).style.transform = 'translateY(0)';
                    if (isHL) (e.target as HTMLElement).style.boxShadow = '0 6px 20px rgba(102,98,255,0.35)';
                  }}
                >
                  {loading && selectedPlan === plan.id
                    ? 'Processing…'
                    : current
                      ? '✓ Current Plan'
                      : plan.cta}
                </button>

                {!current && (
                  <p className="plan-btn-note">7-day free trial · Cancel anytime</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Promo code */}
        <div className="promo-section">
          <div className="promo-card">
            <p className="promo-label">🎟️ Have a promo code?</p>
            <div className="promo-row">
              <input
                type="text"
                value={promoCode}
                onChange={e => { setPromoCode(e.target.value); setPromoError(''); if (!e.target.value) setPromoApplied(null); }}
                placeholder="ENTER CODE"
                className="promo-input"
                onKeyDown={e => e.key === 'Enter' && applyPromo()}
              />
              <button onClick={applyPromo} className="promo-apply-btn">Apply</button>
            </div>
            {promoApplied && <p className="promo-success">✓ {promoApplied.label}</p>}
            {promoError   && <p className="promo-error">✗ {promoError}</p>}
          </div>
        </div>

        {/* Error / success banners */}
        {error   && <div className="alert-wrap"><div className="alert-error">{error}</div></div>}
        {success && <div className="alert-wrap"><div className="alert-success">✓ {success}</div></div>}

        {/* Trust signals */}
        <div className="trust-section">
          <div className="trust-items">
            {[
              { icon: '🎁', text: '7-day free trial on all plans' },
              { icon: '🔒', text: 'Secure payments via Paystack' },
              { icon: '↩️', text: 'Cancel anytime, no questions' },
              { icon: '💳', text: 'Cards, bank transfer, USSD' },
            ].map((t, i) => (
              <div key={i} className="trust-item">
                <span>{t.icon}</span>{t.text}
              </div>
            ))}
          </div>
          <p className="trust-note">
            Prices shown in USD. You&apos;ll be charged in NGN at the current exchange rate.
            <br />
            Questions? Email{' '}
            <a href="mailto:hello@ascentorbi.com" className="trust-link">hello@ascentorbi.com</a>
          </p>
        </div>
      </div>
    </>
  );
}
