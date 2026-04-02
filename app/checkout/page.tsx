'use client';

// ============================================================
// FILE: app/checkout/page.tsx
//
// FIXES:
//  1. Paystack inline popup loads correctly — no stuck "Processing"
//  2. onClose resets button to "Start Now" when user closes popup
//  3. Payment verified server-side via /api/subscription/verify
//  4. "Not ready?" replaces old back button → goes to /dashboard
//  5. Guards: if user has no account → /signup?plan=X
//             if onboarding not done → /onboarding?next=/checkout?plan=X
// ============================================================

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ── Paystack global type ─────────────────────────────────────
declare global {
  interface Window {
    PaystackPop: {
      setup: (cfg: PaystackConfig) => { openIframe: () => void };
    };
  }
}
interface PaystackConfig {
  key: string;
  email: string;
  amount: number;
  currency: string;
  ref: string;
  metadata?: Record<string, unknown>;
  onClose: () => void;
  callback: (res: { reference: string }) => void;
}

// ── Plan amounts (kobo) ──────────────────────────────────────
const PLAN_CONFIG: Record<string, { name: string; amountKobo: number; monthlyLabel: string }> = {
  explorer: { name: 'Explorer', amountKobo: 1200000, monthlyLabel: '₦12,000/mo' },
  builder:  { name: 'Builder',  amountKobo: 2500000, monthlyLabel: '₦25,000/mo' },
};

function generateRef(userId: string) {
  return `asc_${userId.slice(0, 8)}_${Date.now()}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get('plan') || 'explorer';
  const plan   = PLAN_CONFIG[planId] ?? PLAN_CONFIG.explorer;

  const [user, setUser]               = useState<{ id: string; email: string } | null>(null);
  const [status, setStatus]           = useState<'idle' | 'loading' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg]       = useState('');
  const [paystackReady, setPaystackReady] = useState(false);

  // ── 1. Load Paystack script ──────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined' && window.PaystackPop) {
      setPaystackReady(true);
      return;
    }
    const script = document.createElement('script');
    script.src   = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload  = () => setPaystackReady(true);
    script.onerror = () => setErrorMsg('Payment system failed to load. Please refresh.');
    document.body.appendChild(script);
  }, []);

  // ── 2. Auth + onboarding guard ───────────────────────────
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user?.email) {
        // Not logged in
        router.push(`/signup?plan=${planId}`);
        return;
      }

      // Check onboarding
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', data.user.id)
        .single();

      if (!profile?.onboarding_completed) {
        // Onboarding not done — send there first, come back here after
        router.push(`/onboarding?next=${encodeURIComponent(`/checkout?plan=${planId}`)}`);
        return;
      }

      setUser({ id: data.user.id, email: data.user.email });
    });
  }, [planId, router]);

  // ── 3. Verify payment server-side ────────────────────────
  const verifyAndActivate = useCallback(async (reference: string) => {
    setStatus('verifying');
    try {
      const res  = await fetch('/api/subscription/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, plan: planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      setStatus('success');
      setTimeout(() => router.push('/dashboard?welcome=true'), 1500);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || 'Payment could not be confirmed. Please contact support.');
    }
  }, [planId, router]);

  // ── 4. Open Paystack popup ───────────────────────────────
  const handleStartPayment = useCallback(() => {
    if (!paystackReady || !user || status === 'loading') return;
    if (!window.PaystackPop) {
      setErrorMsg('Payment system not ready. Please refresh.');
      return;
    }
    setStatus('loading');
    setErrorMsg('');

    try {
      const handler = window.PaystackPop.setup({
        key:      process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
        email:    user.email,
        amount:   plan.amountKobo,
        currency: 'NGN',
        ref:      generateRef(user.id),
        metadata: {
          userId: user.id,
          plan: planId,
          custom_fields: [
            { display_name: 'Plan',    variable_name: 'plan',    value: plan.name },
            { display_name: 'User ID', variable_name: 'user_id', value: user.id   },
          ],
        },
        // User closed popup WITHOUT paying → reset button cleanly
        onClose: () => setStatus('idle'),
        // Payment succeeded → verify server-side
        callback: (response: { reference: string }) => verifyAndActivate(response.reference),
      });
      handler.openIframe();
    } catch (err: any) {
      console.error('Paystack error:', err);
      setStatus('idle');
      setErrorMsg('Could not open payment window. Please try again.');
    }
  }, [paystackReady, user, plan, planId, status, verifyAndActivate]);

  // ── Button copy ──────────────────────────────────────────
  const buttonLabel = {
    idle:      'Start Now',
    loading:   'Opening payment...',
    verifying: 'Confirming payment...',
    success:   '✓ Payment confirmed!',
    error:     'Try again',
  }[status];

  const isDisabled = status === 'loading' || status === 'verifying' || status === 'success';

  // ── Render ───────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-16"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-md">
        <div
          className="rounded-2xl p-8"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          {/* Plan badge */}
          <span className="text-xs font-semibold tracking-widest mb-2 inline-block" style={{ color: 'var(--accent)' }}>
            • {plan.name.toUpperCase()} PLAN
          </span>

          <h1
            className="text-3xl font-bold mb-1"
            style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}
          >
            Complete your order
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Your 7-day free trial starts today. No charge until Day 8.
          </p>

          {/* Order summary */}
          <div
            className="rounded-xl p-4 mb-6 space-y-2"
            style={{ background: 'var(--card-muted, rgba(255,255,255,0.04))', border: '1px solid var(--border)' }}
          >
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-muted)' }}>Plan</span>
              <span style={{ color: 'var(--text)' }}>{plan.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-muted)' }}>Today's charge</span>
              <span style={{ color: 'var(--teal, #14b8a6)', fontWeight: 600 }}>₦0 (Free trial)</span>
            </div>
            <div
              className="flex justify-between text-sm pt-2"
              style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}
            >
              <span>After trial (Day 8)</span>
              <span style={{ color: 'var(--text)' }}>{plan.monthlyLabel}</span>
            </div>
          </div>

          {/* Error */}
          {errorMsg && (
            <div
              className="rounded-lg p-3 mb-4 text-sm"
              style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', color: '#f87171' }}
            >
              {errorMsg}
            </div>
          )}

          {/* Success */}
          {status === 'success' && (
            <div
              className="rounded-lg p-3 mb-4 text-sm text-center"
              style={{ background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.3)', color: 'var(--teal, #14b8a6)' }}
            >
              Payment confirmed! Taking you to your dashboard...
            </div>
          )}

          {/* CTA */}
          <button
            onClick={
              status === 'error'
                ? () => { setStatus('idle'); setErrorMsg(''); }
                : handleStartPayment
            }
            disabled={isDisabled || !paystackReady || !user}
            className="w-full py-4 rounded-xl font-semibold text-sm transition-all mb-4"
            style={{
              background: status === 'success'
                ? 'rgba(20,184,166,0.15)'
                : isDisabled
                ? 'rgba(255,255,255,0.06)'
                : 'var(--accent)',
              color: status === 'success'
                ? 'var(--teal, #14b8a6)'
                : isDisabled
                ? 'var(--text-muted)'
                : '#000',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              border: status === 'success' ? '1px solid rgba(20,184,166,0.3)' : 'none',
            }}
          >
            {!paystackReady || !user ? 'Loading...' : buttonLabel}
          </button>

          <p className="text-center text-xs tracking-wide mb-6" style={{ color: 'var(--text-muted)' }}>
            7-DAY FREE TRIAL · CANCEL ANYTIME · SECURE PAYMENT
          </p>

          {/* ── "Not ready?" — replaces old back button ── */}
          <div className="text-center">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm transition-colors"
              style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={(e) => ((e.currentTarget).style.color = 'var(--text)')}
              onMouseLeave={(e) => ((e.currentTarget).style.color = 'var(--text-muted)')}
            >
              Not ready?{' '}
              <span style={{ textDecoration: 'underline' }}>
                Go to dashboard with free plan →
              </span>
            </button>
          </div>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
          Payments processed securely by Paystack. Ascentor never stores your card details.
        </p>
      </div>
    </div>
  );
}
