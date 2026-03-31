'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { PLAN_PRICING, MAX_YEARLY_SAVINGS } from '@/lib/pricing';


// Renders SVG icon strings safely  
function SvgIcon({ html, className, style }: { html: string; className?: string; style?: React.CSSProperties }) {
  return <span className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}

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
    id: 'explorer',
    name: 'Explorer',
    description: 'For those 15–22 just starting to find their path.',
    stage: 'EXPLORER',
    stageColor: '#14B8A6',
    monthlyPrice: PLAN_PRICING[0].monthlyPrice,
    yearlyPrice: PLAN_PRICING[0].yearlyPrice,
    features: [
      'Sage — 10 sessions/month',
      '1 mentorship circle',
      'Mentor session recordings',
      'Playbooks & frameworks library',
      'Goal tracking (3 active goals)',
      'Weekly reflection prompts',
    ],
    cta: 'Start Now',
  },
  {
    id: 'builder',
    name: 'Builder',
    description: 'For professionals 22–32 building their career edge.',
    stage: 'BUILDER',
    stageColor: '#E8A020',
    monthlyPrice: PLAN_PRICING[1].monthlyPrice,
    yearlyPrice: PLAN_PRICING[1].yearlyPrice,
    features: [
      'Sage — unlimited sessions',
      'Up to 3 mentorship circles',
      'Live mentor sessions (monthly)',
      'Human mentor matching',
      'Personal development plan',
      'Career strategy templates',
      'Export session history',
      'Analytics dashboard',
    ],
    highlighted: true,
    cta: 'Start Now',
  },
  {
    id: 'climber',
    name: 'Climber',
    description: 'For leaders 32–50 scaling teams and building legacy.',
    stage: 'CLIMBER',
    stageColor: '#8B5CF6',
    monthlyPrice: PLAN_PRICING[2].monthlyPrice,
    yearlyPrice: PLAN_PRICING[2].yearlyPrice,
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
    cta: 'Start Now',
  },
];

// Promo codes are validated SERVER-SIDE ONLY (see /api/payment/initialize)
// They are intentionally NOT present in this client file — S4 security fix.

// Yearly savings computed from centralised pricing lib
function yearlySavings(plan: Plan): number {
  return Math.round(plan.monthlyPrice * 12 - plan.yearlyPrice);
}

export default function CheckoutPage() {
  const [isDark, setIsDark]             = useState(true); // synced with app theme
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
  const [autoPromo, setAutoPromo]       = useState<{ code: string; discount: number; label: string; expires_at: string | null } | null>(null);
  const [countdown, setCountdown]       = useState<string>('');
  const [offerExpired, setOfferExpired] = useState(false);

  const router        = useRouter();
  const searchParams  = useSearchParams();
  const upgradeReason = searchParams.get('reason');
  const fromPage      = searchParams.get('from');
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  // Sync theme with app-wide preference (same key as AppThemeProvider)
  useEffect(() => {
    const stored = localStorage.getItem('asc-theme');
    const dark = stored ? stored === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(dark);

    // Listen for theme changes from other tabs / the dashboard toggle
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'asc-theme') setIsDark(e.newValue === 'dark');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

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

  // Fetch active auto-apply promo on page load
  useEffect(() => {
    const fetchAutoPromo = async () => {
      const res  = await fetch('/api/payment/active-promo');
      const data = await res.json();
      if (data.promo) {
        setAutoPromo(data.promo);
        // Auto-apply it — pre-fill and apply
        setPromoCode(data.promo.code);
        setPromoApplied({ discount: data.promo.discount, label: data.promo.label });
      }
    };
    fetchAutoPromo();
  }, []); // eslint-disable-line

  // Live countdown ticker
  useEffect(() => {
    if (!autoPromo?.expires_at) return;

    const tick = () => {
      const now  = Date.now();
      const end  = new Date(autoPromo.expires_at!).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setOfferExpired(true);
        setCountdown('00:00:00');
        setPromoApplied(null);
        setPromoCode('');
        setAutoPromo(null);
        return;
      }

      const days    = Math.floor(diff / 86400000);
      const hours   = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000)  / 60000);
      const seconds = Math.floor((diff % 60000)    / 1000);

      const pad = (n: number) => String(n).padStart(2, '0');
      if (days > 0) {
        setCountdown(`${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
      } else {
        setCountdown(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [autoPromo]);

  // Track Paystack script readiness
  const [paystackReady, setPaystackReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // If already loaded (e.g. hot reload), mark ready immediately
    if ((window as any).PaystackPop) { setPaystackReady(true); return; }

    if (!document.getElementById('paystack-script')) {
      const s = document.createElement('script');
      s.id = 'paystack-script';
      s.src = 'https://js.paystack.co/v2/inline.js';
      s.async = true;
      s.onload = () => setPaystackReady(true);
      s.onerror = () => console.error('[checkout] Paystack script failed to load');
      document.head.appendChild(s);
    } else {
      // Script tag already in DOM but may still be loading — poll for it
      const poll = setInterval(() => {
        if ((window as any).PaystackPop) {
          setPaystackReady(true);
          clearInterval(poll);
        }
      }, 100);
      // Give up after 10s
      setTimeout(() => clearInterval(poll), 10000);
    }
  }, []);

  // S4: Promo codes are validated server-side — no client-side PROMO_CODES object
  const [promoValidating, setPromoValidating] = useState(false);

  const applyPromo = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    setPromoError(''); setPromoApplied(null); setPromoValidating(true);
    try {
      // validate=true means: check the code and return discount info only
      // — do NOT activate the account yet (that happens when user picks a plan)
      const res = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoCode: code, validateOnly: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPromoError(data.error || 'Invalid promo code');
      } else {
        setPromoApplied({ discount: data.discount, label: data.label || 'Discount applied' });
      }
    } catch {
      setPromoError('Could not validate code. Please try again.');
    } finally {
      setPromoValidating(false);
    }
  };

  const getPrice = (plan: Plan) => {
    const base = billing === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
    if (promoApplied) {
      return Math.round(base * (1 - promoApplied.discount) * 100) / 100;
    }
    return base;
  };

  const getOriginalPrice = (plan: Plan) => {
    return billing === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
  };

  const handleSelectPlan = async (planId: string) => {
    if (!user) { router.push('/login?redirect=/checkout'); return; }
    setSelectedPlan(planId); setLoading(true); setError(''); setSuccess('');
    const plan = PLANS.find(p => p.id === planId)!;
    const finalPrice = getPrice(plan);

    if (finalPrice === 0 && promoApplied?.discount === 1) {
      try {
        // userId intentionally omitted — server reads it from session (S2 fix)
        const res = await fetch('/api/payment/initialize', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promoCode: promoCode.trim().toUpperCase() }),
        });
        const data = await res.json();
        if (data.free) { setSuccess('Account activated! Taking you to your dashboard…'); setTimeout(() => router.push('/dashboard'), 2000); }
        else setError(data.error || 'Failed to activate promo');
      } catch { setError('Failed to process. Please try again.'); }
      setLoading(false); return;
    }

    // Guard: Paystack script not ready yet — script loads async on mount
    if (!paystackReady || !(window as any).PaystackPop) {
      setError('Payment system is still loading. Please wait a moment and try again.');
      setLoading(false);
      setSelectedPlan(null);
      return;
    }

    // Guard: public key must be set at build time via NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
    const paystackKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '';
    if (!paystackKey) {
      setError('Payment configuration error. Please contact support@ascentorbi.com.');
      setLoading(false);
      setSelectedPlan(null);
      return;
    }

    const amountKobo = Math.round(finalPrice * 100);
    const reference = `asc_${user.id.slice(0, 8)}_${Date.now()}`;
    try {
      // @ts-ignore
      const paystack = new (window as any).PaystackPop();
      paystack.newTransaction({
        key: paystackKey,
        email: user.email, amount: amountKobo, currency: 'NGN', ref: reference,
        metadata: {
          user_id: user.id, plan: planId, billing_cycle: billing,
          promo_code: promoCode.trim().toUpperCase() || null, is_trial: true,
        },
        onSuccess: async (transaction: any) => {
          try {
            const res = await fetch('/api/payment/verify', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              // userId intentionally omitted — server reads from session (S1 fix)
            body: JSON.stringify({ reference: transaction.reference, plan: planId, billing }),
            });
            const data = await res.json();
            if (data.success) { setSuccess('Payment confirmed! Taking you to your dashboard…'); setTimeout(() => router.push('/dashboard'), 2000); }
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

        /* ── THEME VARIABLES ── */
        .co-root[data-co-theme="light"] {
          --co-bg:        #FAF7F2;
          --co-bg2:       #F2EDE4;
          --co-card:      #FFFFFF;
          --co-nav-bg:    rgba(250,247,242,0.94);
          --co-nav-bord:  rgba(42,40,32,0.1);
          --co-text:      #2A2820;
          --co-text-mid:  #4A4438;
          --co-text-muted:#6B6456;
          --co-text-faint:#9A9080;
          --co-bord:      rgba(42,40,32,0.1);
          --co-bord-med:  rgba(42,40,32,0.18);
          --co-input-bg:  #FAF7F2;
          --co-input-text:#0C0B08;
          --co-plan-bord: rgba(42,40,32,0.1);
          --co-toggle-bg: #EDE9E0;
          --co-save-bg:   rgba(12,11,8,0.25);
          --co-save-col:  #0C0B08;
          --co-trust-bord:rgba(42,40,32,0.08);
          --co-promo-bg:  #FFFFFF;
          --co-promo-bord:rgba(42,40,32,0.1);
          --co-price-col: #0C0B08;
          --co-heading:   #0C0B08;
          --co-plan-name: #0C0B08;
          --co-grid-line: rgba(232,160,32,0.04);
          --co-glow:      rgba(232,160,32,0.08);
          --co-shadow:    0 2px 16px rgba(42,40,32,0.04);
        }
        .co-root[data-co-theme="dark"] {
          --co-bg:        #0C0B08;
          --co-bg2:       #1E1C17;
          --co-card:      #141310;
          --co-nav-bg:    rgba(12,11,8,0.9);
          --co-nav-bord:  #2E2A22;
          --co-text:      #D4CFC3;
          --co-text-mid:  #A09880;
          --co-text-muted:#7A7260;
          --co-text-faint:#4A4438;
          --co-bord:      #2E2A22;
          --co-bord-med:  #3E3A32;
          --co-input-bg:  #1E1C17;
          --co-input-text:#D4CFC3;
          --co-plan-bord: rgba(255,255,255,0.06);
          --co-toggle-bg: #1E1C17;
          --co-save-bg:   rgba(12,11,8,0.25);
          --co-save-col:  #0C0B08;
          --co-trust-bord:#1E1C17;
          --co-promo-bg:  #141310;
          --co-promo-bord:#2E2A22;
          --co-price-col: #FFFFFF;
          --co-heading:   #FFFFFF;
          --co-plan-name: #FFFFFF;
          --co-grid-line: rgba(232,160,32,0.02);
          --co-glow:      rgba(232,160,32,0.045);
          --co-shadow:    none;
        }

        .co-root {
          min-height: 100vh;
          background: var(--co-bg);
          font-family: 'Syne', sans-serif;
          color: var(--co-text);
          position: relative;
          overflow-x: hidden;
          transition: background 0.2s, color 0.2s;
        }

        /* Ambient glow */
        .co-root::before {
          content: '';
          position: fixed;
          top: -200px; left: 50%;
          transform: translateX(-50%);
          width: 900px; height: 900px;
          background: radial-gradient(circle, var(--co-glow) 0%, transparent 60%);
          pointer-events: none; z-index: 0;
        }
        /* Grid texture */
        .co-root::after {
          content: '';
          position: fixed; inset: 0;
          background-image:
            linear-gradient(var(--co-grid-line) 1px, transparent 1px),
            linear-gradient(90deg, var(--co-grid-line) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none; z-index: 0;
        }

        /* ── NAV ── */
        .co-nav {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 32px;
          border-bottom: 1px solid var(--co-nav-bord);
          background: var(--co-nav-bg);
          backdrop-filter: blur(16px);
          position: sticky; top: 0; z-index: 20;
        }
        .co-nav-logo {
          display: flex; align-items: center; gap: 10px; text-decoration: none;
        }
        .co-nav-logo-text {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 700; font-size: 20px; color: var(--co-heading);
        }
        .co-nav-back {
          font-family: 'DM Mono', monospace;
          font-size: 11px; letter-spacing: 0.08em;
          color: var(--co-text-muted); text-decoration: none;
          padding: 7px 14px; border-radius: 8px;
          border: 1px solid var(--co-bord);
          transition: color 0.2s, border-color 0.2s;
        }
        .co-nav-back:hover { color: var(--co-text); border-color: var(--co-bord-med); }

        /* ── HERO ── */
        .co-upgrade-banner {
          background: rgba(232,160,32,0.08);
          border: 1px solid rgba(232,160,32,0.25);
          border-radius: 12px;
          padding: 14px 20px;
          text-align: center;
          margin-bottom: 24px;
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          color: var(--co-text-muted);
          letter-spacing: 0.04em;
        }
        .co-upgrade-banner strong { color: var(--co-heading); }
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
          color: var(--co-heading); margin-bottom: 16px;
        }
        .co-hero-heading em {
          font-style: italic; color: #E8A020;
        }
        .co-hero-sub {
          font-size: 15px; color: var(--co-text-muted); line-height: 1.65;
          max-width: 460px; margin: 0 auto 40px;
        }

        /* ── BILLING TOGGLE ── */
        .co-billing {
          display: inline-flex;
          background: var(--co-toggle-bg);
          border: 1px solid var(--co-bord);
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
          background: transparent; color: var(--co-text-muted);
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
          background: var(--co-card);
          border-radius: 20px;
          border: 1px solid var(--co-plan-bord);
          padding: 32px 28px;
          display: flex; flex-direction: column;
          position: relative; overflow: hidden;
          transition: transform 0.22s, box-shadow 0.22s, background 0.2s;
          box-shadow: var(--co-shadow);
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
          font-weight: 700; font-size: 28px; color: var(--co-plan-name);
          letter-spacing: -0.3px; margin-bottom: 6px;
        }
        .co-plan-desc { font-size: 13px; color: var(--co-text-muted); margin-bottom: 24px; line-height: 1.5; }

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
          font-size: 48px; font-weight: 700; color: var(--co-price-col);
          line-height: 1; letter-spacing: -1px;
        }
        .co-price-per { font-size: 13px; color: var(--co-text-muted); align-self: flex-end; margin-bottom: 4px; }
        .co-price-note { font-size: 11px; color: var(--co-text-faint); margin-top: 5px; font-family: 'DM Mono', monospace; letter-spacing: 0.04em; }
        .co-price-promo { font-size: 12px; margin-top: 6px; }

        /* Features */
        .co-features {
          list-style: none; flex: 1;
          display: flex; flex-direction: column; gap: 10px;
          margin-bottom: 28px;
        }
        .co-feature {
          display: flex; align-items: flex-start; gap: 10px;
          font-size: 13px; color: var(--co-text-mid); line-height: 1.5;
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
        .co-trial-notice {
          text-align: center;
          padding: 14px 20px;
          margin: 0 auto 20px;
          max-width: 480px;
          border-radius: 10px;
          background: var(--co-toggle-bg);
          border: 1px solid var(--co-bord);
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.06em;
          color: var(--co-text-muted);
          line-height: 1.6;
        }
        .co-trial-notice strong {
          color: var(--co-heading);
          font-weight: 600;
        }
        .co-cta-note {
          font-family: 'DM Mono', monospace;
          font-size: 10px; letter-spacing: 0.06em; color: #4A4438;
          text-align: center; margin-top: 8px;
        }

        /* ── PROMO ── */
        /* ── OFFER BANNER ── */
        .co-offer-banner {
          max-width: 880px; margin: 0 auto 28px; padding: 0 24px;
          position: relative; z-index: 1;
        }
        .co-offer-inner {
          background: linear-gradient(135deg, rgba(232,160,32,0.12) 0%, rgba(232,160,32,0.06) 100%);
          border: 1.5px solid rgba(232,160,32,0.35);
          border-radius: 16px; padding: 20px 24px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 16px; flex-wrap: wrap;
          box-shadow: 0 0 32px rgba(232,160,32,0.08);
          position: relative; overflow: hidden;
        }
        .co-offer-inner::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg, rgba(232,160,32,0.04), transparent);
          pointer-events: none;
        }
        .co-offer-left { display: flex; align-items: center; gap: 14px; }
        .co-offer-badge {
          background: #E8A020; color: #0C0B08;
          font-family: 'DM Mono', monospace; font-size: 13px; font-weight: 700;
          padding: 6px 14px; border-radius: 8px; letter-spacing: 0.06em;
          white-space: nowrap; flex-shrink: 0;
        }
        .co-offer-text { flex: 1; }
        .co-offer-label {
          font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700;
          color: var(--co-heading); margin-bottom: 3px;
        }
        .co-offer-sub {
          font-family: 'DM Mono', monospace; font-size: 10px;
          color: #E8A020; letter-spacing: 0.08em; text-transform: uppercase;
        }
        .co-offer-code {
          font-family: 'DM Mono', monospace; font-size: 11px;
          color: rgba(232,160,32,0.7); letter-spacing: 0.1em;
          margin-top: 2px;
        }
        .co-offer-countdown { text-align: right; flex-shrink: 0; }
        .co-offer-timer-label {
          font-family: 'DM Mono', monospace; font-size: 9px;
          color: var(--co-text-muted); letter-spacing: 0.12em; text-transform: uppercase;
          margin-bottom: 6px;
        }
        .co-offer-timer {
          font-family: 'DM Mono', monospace; font-size: 22px; font-weight: 700;
          color: #E8A020; letter-spacing: 0.06em; line-height: 1;
        }
        .co-offer-timer.urgent { color: #EF4444; animation: co-pulse 1s ease infinite; }
        @keyframes co-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
        .co-offer-expired {
          max-width: 880px; margin: 0 auto 20px; padding: 0 24px;
        }

        .co-promo-wrap {
          max-width: 440px; margin: 0 auto 28px; padding: 0 24px;
          position: relative; z-index: 1;
        }
        .co-promo-card {
          background: var(--co-promo-bg); border: 1px solid var(--co-promo-bord);
          border-radius: 14px; padding: 20px 22px;
        }
        .co-promo-label {
          font-family: 'DM Mono', monospace;
          font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--co-text-faint); margin-bottom: 12px;
        }
        .co-promo-row { display: flex; gap: 8px; }
        .co-promo-input {
          flex: 1; padding: 11px 14px; border-radius: 9px;
          border: 1px solid var(--co-bord); background: var(--co-input-bg);
          color: var(--co-input-text); font-family: 'DM Mono', monospace;
          font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase;
          outline: none; transition: border-color 0.2s;
        }
        .co-promo-input::placeholder { color: var(--co-text-faint); }
        .co-promo-input:focus { border-color: rgba(232,160,32,0.5); }
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
          border-top: 1px solid var(--co-trust-bord);
        }
        .co-trust-items {
          display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; margin-bottom: 18px;
        }
        .co-trust-item {
          display: flex; align-items: center; gap: 7px;
          font-family: 'DM Mono', monospace;
          font-size: 10px; letter-spacing: 0.06em; color: var(--co-text-muted);
        }
        .co-trust-note { font-size: 12px; color: var(--co-text-muted); line-height: 1.65; }
        .co-trust-link { color: #E8A020; text-decoration: none; }
        .co-trust-link:hover { color: #F5C55A; }
      `}</style>

      <div className="co-root" data-co-theme={isDark ? 'dark' : 'light'}>

        {/* NAV */}
        <nav className="co-nav">
          <Link href="/" className="lp-nav-logo">
  <img
    src="/ascentor-color-for-light-pages.svg"
    alt="Ascentor"
    style={{ height: '32px', width: 'auto' }}
  />
</Link>
          <a href="/onboarding" className="co-nav-back">← Back</a>
          <button
            onClick={() => {
              const next = isDark ? 'light' : 'dark';
              setIsDark(!isDark);
              localStorage.setItem('asc-theme', next);
              document.documentElement.setAttribute('data-app-theme', next);
            }}
            aria-label="Toggle theme"
            style={{
              background: 'none', border: '1px solid var(--co-bord)',
              borderRadius: 8, padding: '7px 10px', cursor: 'pointer',
              color: 'var(--co-text-muted)', display: 'flex', alignItems: 'center',
              transition: 'border-color 0.2s',
            }}
          >
            {isDark
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
          </button>
        </nav>

        {/* HERO */}
        <div className="co-hero">
          {upgradeReason === 'upgrade_required' && (
            <div className="co-upgrade-banner">
              <strong>This feature requires a paid plan.</strong><br/>
              Choose a plan below to continue. Your 7-day trial starts today — no charge until Day 8.
            </div>
          )}
          <div className="co-hero-badge">
            <div className="co-hero-badge-dot" />
            Start today — cancel anytime
          </div>
          <h1 className="co-hero-heading">
            Everyone who made it<br/>
            had <em>someone.</em>
          </h1>
          <p className="co-hero-sub">
            Sage, expert sessions, and peer accountability — for ambitious professionals worldwide. Choose your stage.
          </p>

          {/* Billing toggle — U6: enhanced with savings callout */}
          <div className="co-billing">
            {(['monthly', 'yearly'] as BillingCycle[]).map(cycle => (
              <button
                key={cycle}
                onClick={() => setBilling(cycle)}
                className={`co-billing-btn ${billing === cycle ? 'active' : 'inactive'}`}
              >
                {cycle === 'monthly' ? 'Monthly' : 'Yearly'}
                {cycle === 'yearly' && <span className="co-save-pill">SAVE 40%</span>}
              </button>
            ))}
          </div>
          {/* U6: Nudge text below toggle when user is on monthly */}
          {billing === 'monthly' && (
            <p style={{ fontSize: 12, color: '#7A7260', marginTop: 10 }}>
              <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg> Switch to yearly and save up to{' '}
              <span style={{ color: '#E8A020', fontWeight: 600 }}>
                ₦{MAX_YEARLY_SAVINGS.toLocaleString()}/year
              </span>
            </p>
          )}
        </div>

        {/* PLANS */}
        <div className="co-plans">
          {PLANS.map(plan => {
            const price    = getPrice(plan);
            const current  = isCurrentPlan(plan.id);
            const isHL     = plan.highlighted;
            // promoApplied comes from server — applies to all plans
            const hasPromo = !!promoApplied;
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
                  {/* Strikethrough original price when promo applied */}
                  {hasPromo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontFamily: "'DM Mono', monospace", fontSize: 13,
                        color: '#4A4438', textDecoration: 'line-through', letterSpacing: '0.04em',
                      }}>
                        ₦{(billing === 'monthly'
                          ? getOriginalPrice(plan)
                          : Math.round(getOriginalPrice(plan) / 12)).toLocaleString()}/mo
                      </span>
                      <span style={{
                        fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700,
                        padding: '2px 8px', borderRadius: 20,
                        background: 'rgba(232,160,32,0.12)', color: '#E8A020',
                        border: '1px solid rgba(232,160,32,0.25)', letterSpacing: '0.06em',
                      }}>
                        -{Math.round(promoApplied!.discount * 100)}% OFF
                      </span>
                    </div>
                  )}

                  <div className="co-price-main">
                    <span className="co-price-dollar">₦</span>
                    <span className="co-price-num" style={{ color: hasPromo ? '#E8A020' : undefined }}>
                      {monthlyDisplay}
                    </span>
                    <span className="co-price-per">/mo</span>
                  </div>

                  {billing === 'yearly' && (
                    <>
                      <p className="co-price-note">
                        {hasPromo ? (
                          <>
                            <span style={{ textDecoration: 'line-through', color: '#4A4438', marginRight: 6 }}>
                              ₦{getOriginalPrice(plan).toLocaleString()}
                            </span>
                            <span style={{ color: '#E8A020' }}>₦{price.toLocaleString()} BILLED ANNUALLY</span>
                          </>
                        ) : (
                          <>₦{price.toLocaleString()} BILLED ANNUALLY</>
                        )}
                      </p>
                      {!hasPromo && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          marginTop: 6, padding: '3px 10px', borderRadius: 20,
                          background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                        }}>
                          <span style={{ color: '#10B981', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', fontFamily: "'DM Mono', monospace" }}>
                            ✓ YOU SAVE ₦{yearlySavings(plan).toLocaleString()}/YR
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {hasPromo && (
                    <div style={{
                      marginTop: 8, padding: '6px 10px', borderRadius: 8,
                      background: 'rgba(232,160,32,0.06)', border: '1px solid rgba(232,160,32,0.15)',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{ color: '#E8A020', fontSize: 10, fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}>
                        ✓ {promoApplied!.label}
                      </span>
                      <span style={{ color: '#E8A020', fontSize: 10, fontFamily: "'DM Mono', monospace", marginLeft: 'auto' }}>
                        You save ₦{Math.round((getOriginalPrice(plan) - price) * (billing === 'yearly' ? 1 : 12) * 10) / 10}/yr
                      </span>
                    </div>
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

                {/* Trial notice + CTA */}
                <div className="co-trial-notice">
                  <strong>Start today — explore free.</strong><br/>
                  You will not be billed until your 7-day trial ends.<br/>
                  Cancel any time before Day 7 and you will not be charged.
                </div>
                <button
                  className="co-cta"
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={current || (loading && selectedPlan === plan.id) || !paystackReady}
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
                    : !paystackReady
                      ? 'Loading payment…'
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

        {/* AUTO-APPLY OFFER BANNER */}
        {autoPromo && !offerExpired && (
          <div className="co-offer-banner">
            <div className="co-offer-inner">
              <div className="co-offer-left">
                <div className="co-offer-badge">
                  {Math.round(autoPromo.discount * 100)}% OFF
                </div>
                <div className="co-offer-text">
                  <div className="co-offer-label">{autoPromo.label}</div>
                  <div className="co-offer-sub">
                    {autoPromo.expires_at ? 'Limited time offer — prices shown already discounted' : 'Special offer — prices shown already discounted'}
                  </div>
                  <div className="co-offer-code">Code: {autoPromo.code}</div>
                </div>
              </div>
              {autoPromo.expires_at && countdown && (
                <div className="co-offer-countdown">
                  <div className="co-offer-timer-label">Offer expires in</div>
                  <div className={`co-offer-timer${countdown.startsWith('00:0') ? ' urgent' : ''}`}>
                    {countdown}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {offerExpired && (
          <div className="co-offer-expired">
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#EF4444', letterSpacing: '0.06em' }}>
              ✗ This offer has expired — standard pricing applies
            </div>
          </div>
        )}

        {/* PROMO — manual code entry (hidden if auto-promo already applied) */}
        {!autoPromo && (
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
                <button onClick={applyPromo} disabled={promoValidating} className="co-promo-btn">
                  {promoValidating ? '…' : 'Apply'}
                </button>
              </div>
              {promoApplied && <p className="co-promo-success">✓ {promoApplied.label}</p>}
              {promoError   && <p className="co-promo-error">✗ {promoError}</p>}
            </div>
          </div>
        )}

        {/* Alerts */}
        {error   && <div className="co-alert-wrap"><div className="co-alert-error">{error}</div></div>}
        {success && <div className="co-alert-wrap"><div className="co-alert-success">✓ {success}</div></div>}

        {/* Trust */}
        <div className="co-trust">
          <div className="co-trust-items">
            {[
              { icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>', text: '7-DAY MONEY BACK' },
              { icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>', text: 'PAYSTACK SECURED' },
              { icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>', text: 'CANCEL ANYTIME' },
              { icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>', text: 'CARD · BANK · USSD' },
            ].map((t, i) => (
              <div key={i} className="co-trust-item">
                <span dangerouslySetInnerHTML={{ __html: t.icon }} />{t.text}
              </div>
            ))}
          </div>
          <p className="co-trust-note">
            Prices in NGN · 7-day money-back guarantee.{' '}
            Questions?{' '}
            <a href="mailto:asamuel@ascentorbi.com" className="co-trust-link">hello@ascentorbi.com</a>
          </p>
        </div>

      </div>
    </>
  );
}
