'use client';

// ============================================================
// FILE: app/pricing/page.tsx
//
// FIXES:
//  1. "Start 7-day trial" → /signup?plan=X  (no infinite load)
//  2. "Get started free"  → /dashboard      (skip checkout entirely)
//  3. Paid plans after login → /checkout?plan=X
//
// ONBOARDING: NOT skipped.
//   signup/page.tsx → /onboarding → /checkout (paid) or /dashboard (free)
//   The onboarding redirect lives in signup, not here.
// ============================================================

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const PLANS = [
  {
    id: 'free',
    label: 'FREE',
    name: 'Free',
    tagline: 'Start exploring Ascentor.',
    priceLabel: '₦0',
    annualLabel: null,
    topBadge: null,
    cta: 'Get started free',
    isFree: true,
    features: [
      { text: 'Sage — 3 sessions/month', included: true },
      { text: 'Community access', included: true },
      { text: 'Basic goal tracking', included: true },
      { text: 'Expert sessions', included: false },
      { text: 'Cohort access', included: false },
    ],
  },
  {
    id: 'explorer',
    label: 'POPULAR',
    name: 'Explorer',
    tagline: 'For professionals 22–32 building their career edge.',
    priceLabel: '₦12,000',
    annualLabel: '₦115,200/yr if billed annually',
    topBadge: null,
    cta: 'Start 7-day free trial',
    isFree: false,
    features: [
      { text: 'Unlimited AI coaching', included: true },
      { text: 'Full community + cohorts', included: true },
      { text: 'All courses', included: true },
      { text: 'Personal brand agent', included: false },
      { text: 'Expert sessions', included: false },
      { text: 'Priority support', included: false },
    ],
  },
  {
    id: 'builder',
    label: 'RECOMMENDED',
    name: 'Builder',
    tagline: 'For professionals ready to lead at the highest level.',
    priceLabel: '₦25,000',
    annualLabel: '₦240,000/yr if billed annually',
    topBadge: 'MOST VALUE',
    cta: 'Start 7-day free trial',
    isFree: false,
    features: [
      { text: 'Sage — 10 sessions/month', included: true },
      { text: '1 mentorship circle', included: true },
      { text: 'Mentor session recordings', included: true },
      { text: 'Playbooks & frameworks library', included: true },
      { text: 'Goal tracking (3 active goals)', included: true },
      { text: 'Weekly reflection prompts', included: true },
    ],
  },
];

export default function PricingPage() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handlePlanSelect = async (plan: typeof PLANS[0]) => {
    if (loadingPlan) return;
    setLoadingPlan(plan.id);

    // Free plan: check if already logged in
    // If yes → dashboard. If no → signup (onboarding included in signup flow).
    if (plan.isFree) {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push('/dashboard');
      } else {
        router.push('/signup?plan=free');
      }
      return;
    }

    // Paid plan: check if already logged in
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // Already has account — check if onboarding was completed
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single();

      if (!profile?.onboarding_completed) {
        // Must complete onboarding first, then come back to checkout
        router.push(`/onboarding?next=/checkout?plan=${plan.id}`);
      } else {
        router.push(`/checkout?plan=${plan.id}`);
      }
    } else {
      // New user — signup → onboarding → checkout
      router.push(`/signup?plan=${plan.id}`);
    }
  };

  return (
    <div className="min-h-screen py-16 px-4" style={{ background: 'var(--bg)' }}>
      <div className="text-center mb-12">
        <h1
          className="text-4xl font-semibold mb-3"
          style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}
        >
          Choose your plan
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          All paid plans start with a 7-day free trial. Cancel before Day 7 and you won't be charged.
        </p>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isLoading = loadingPlan === plan.id;
          const isHighlighted = plan.id === 'builder';

          return (
            <div
              key={plan.id}
              className="relative rounded-2xl p-6 flex flex-col"
              style={{
                background: isHighlighted ? 'var(--card-highlight, #1a1a12)' : 'var(--card)',
                border: isHighlighted ? '1.5px solid var(--accent)' : '1px solid var(--border)',
              }}
            >
              {plan.topBadge && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold"
                  style={{ background: 'var(--accent)', color: '#000' }}
                >
                  {plan.topBadge}
                </div>
              )}

              <span className="text-xs font-semibold tracking-widest mb-2" style={{ color: 'var(--accent)' }}>
                • {plan.label}
              </span>

              <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text)' }}>
                {plan.name}
              </h2>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                {plan.tagline}
              </p>

              <div className="mb-1">
                <span
                  className="text-4xl font-bold"
                  style={{ color: isHighlighted ? 'var(--accent)' : 'var(--text)' }}
                >
                  {plan.priceLabel}
                </span>
                {!plan.isFree && (
                  <span className="text-sm ml-1" style={{ color: 'var(--text-muted)' }}>/mo</span>
                )}
              </div>
              {plan.annualLabel && (
                <p className="text-xs mb-5" style={{ color: 'var(--teal, #14b8a6)' }}>
                  {plan.annualLabel}
                </p>
              )}

              <ul className="flex-1 space-y-3 mb-6 mt-2">
                {plan.features.map((f) => (
                  <li key={f.text} className="flex items-start gap-2 text-sm">
                    <span style={{ color: f.included ? 'var(--teal, #14b8a6)' : 'var(--text-muted)', marginTop: 2, flexShrink: 0 }}>
                      {f.included ? '✓' : '—'}
                    </span>
                    <span style={{ color: f.included ? 'var(--text)' : 'var(--text-muted)', textDecoration: f.included ? 'none' : 'line-through' }}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>

              {!plan.isFree && (
                <div
                  className="rounded-xl p-4 mb-4 text-center text-xs leading-relaxed"
                  style={{ background: 'var(--card-muted, rgba(255,255,255,0.04))', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                >
                  <strong style={{ color: 'var(--text)' }}>Start today — explore free.</strong>
                  <br />
                  You will not be billed until your 7-day trial ends.
                  <br />
                  Cancel any time before Day 7 and you will not be charged.
                </div>
              )}

              <button
                onClick={() => handlePlanSelect(plan)}
                disabled={!!loadingPlan}
                className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: isHighlighted || plan.isFree ? 'var(--accent)' : 'transparent',
                  color: isHighlighted || plan.isFree ? '#000' : 'var(--text)',
                  border: isHighlighted || plan.isFree ? 'none' : '1px solid var(--border)',
                  opacity: loadingPlan && !isLoading ? 0.5 : 1,
                  cursor: loadingPlan ? 'not-allowed' : 'pointer',
                }}
              >
                {isLoading ? 'One moment...' : plan.cta}
              </button>

              {!plan.isFree && (
                <p className="text-center text-xs mt-3 tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  7-DAY FREE TRIAL · CANCEL ANYTIME
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
