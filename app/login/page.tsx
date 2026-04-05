'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PasswordInput from '@/components/PasswordInput';
import { OAuthButton } from '@/lib/sso';

// ─────────────────────────────────────────────────────────────────
// ASCENTOR BRAND TOKENS · Brand Book v1.0 · 2026
// ─────────────────────────────────────────────────────────────────
const B = {
  fontDisplay: "'Cormorant Garamond', Georgia, serif",
  fontUI:      "'Syne', system-ui, sans-serif",
  fontMono:    "'DM Mono', 'Courier New', monospace",
  dark:        '#0C0B08',
  dark700:     '#1E1C17',
  dark600:     '#2E2A22',
  dark500:     '#4A4438',
  dark400:     '#7A7260',
  dark200:     '#D4CFC3',
  dark50:      '#F7F6F3',
  gold:        '#E8A020',
  gold600:     '#C87820',
  goldMuted:   'rgba(232,160,32,0.10)',
  goldBorder:  'rgba(232,160,32,0.25)',
  border:      'rgba(212,207,195,0.10)',
  error:       '#EF4444',
  errorMuted:  'rgba(239,68,68,0.08)',
};

export default function LoginPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const supabase     = createClient();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    const plan    = searchParams.get('plan');
    const billing = searchParams.get('billing');
    if (plan && typeof window !== 'undefined') {
      const existing = localStorage.getItem('ascentor_plan_intent');
      if (!existing) {
        localStorage.setItem('ascentor_plan_intent', JSON.stringify({ planName: plan, billing: billing || 'monthly' }));
      }
    }
  }, [searchParams]);

  async function routeAfterAuth(userId: string) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed, subscription_status, full_name, current_role, goal_role, industry')
        .eq('id', userId)
        .single();

      if (profile?.onboarding_completed === true) { router.push('/dashboard'); return; }

      const hasPaid =
        profile?.subscription_status === 'active' ||
        profile?.subscription_status === 'trialing';

      if (hasPaid) { router.push('/dashboard'); return; }

      const completedStep1 = !!(profile?.full_name && profile?.current_role);
      const completedStep2 = !!(profile?.full_name && profile?.current_role && profile?.goal_role && profile?.industry);

      if (completedStep2) { router.push('/checkout'); return; }
      if (completedStep1) { router.push('/onboarding?step=2'); return; }
      router.push('/onboarding');
    } catch {
      router.push('/dashboard');
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }

    try {
      const res   = await fetch('/api/auth/security-check', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId: data.session?.user.id }),
      });
      const check = await res.json();
      if (!check.allowed) {
        await supabase.auth.signOut();
        setError(check.message);
        setLoading(false); return;
      }
    } catch {}

    await routeAfterAuth(data.session!.user.id);
    setLoading(false);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .asc-page {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 3fr 7fr;
          background: ${B.dark};
        }
        @media (max-width: 768px) {
          .asc-page { grid-template-columns: 1fr; }
          .asc-brand-panel { display: none; }
        }

        /* ── LEFT BRAND PANEL ── */
        .asc-brand-panel {
          background: ${B.dark700};
          border-right: 1px solid ${B.border};
          padding: 48px 40px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .asc-brand-tiers {
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-top: 40px;
        }
        .asc-tier-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .asc-tier-dot {
          width: 10px; height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .asc-tier-label {
          font-family: ${B.fontUI};
          font-size: 13px;
          font-weight: 600;
          color: ${B.dark200};
          min-width: 72px;
        }
        .asc-tier-sub {
          font-family: ${B.fontMono};
          font-size: 10px;
          color: ${B.dark500};
          letter-spacing: 0.06em;
        }

        /* ── RIGHT FORM PANEL ── */
        .asc-form-panel {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 32px;
          background: ${B.dark};
        }
        .asc-form-inner {
          width: 100%;
          max-width: 440px;
        }

        .asc-rule {
          height: 2px;
          background: linear-gradient(90deg, ${B.gold} 0%, transparent 100%);
          margin-bottom: 28px;
          border-radius: 2px;
        }

        .asc-input {
          width: 100%; padding: 13px 16px;
          background: ${B.dark700};
          border: 1px solid ${B.border};
          border-radius: 10px;
          color: ${B.dark50};
          font-family: ${B.fontUI}; font-size: 14px;
          outline: none; transition: border-color 0.15s;
        }
        .asc-input::placeholder { color: ${B.dark500}; }
        .asc-input:focus { border-color: ${B.goldBorder}; }

        .asc-btn-primary {
          width: 100%; padding: 14px 24px;
          border-radius: 10px; border: none; cursor: pointer;
          background: ${B.gold}; color: ${B.dark};
          font-family: ${B.fontUI}; font-size: 14px;
          font-weight: 700; letter-spacing: 0.02em;
          transition: background 0.15s, opacity 0.15s;
        }
        .asc-btn-primary:hover:not(:disabled) { background: ${B.gold600}; }
        .asc-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .asc-divider {
          display: flex; align-items: center; gap: 16px; margin: 24px 0;
        }
        .asc-divider-line { flex: 1; height: 1px; background: ${B.border}; }

        .asc-error {
          padding: 10px 14px; border-radius: 8px;
          background: ${B.errorMuted};
          border: 1px solid rgba(239,68,68,0.2);
          color: ${B.error};
          font-family: ${B.fontUI}; font-size: 13px; line-height: 1.5;
          margin-bottom: 4px;
        }
        .asc-oauth { display: flex; flex-direction: column; gap: 10px; }
      `}</style>

      <div className="asc-page">

        {/* ── LEFT BRAND PANEL ── */}
        <div className="asc-brand-panel">
          <div>
            <div style={{ marginBottom: '48px' }}>
              <Link href="/">
                <img src="/ascentor-color-for-dark-pages.svg" alt="Ascentor" style={{ height: '32px', width: 'auto' }} />
              </Link>
            </div>

            <h2 style={{ fontFamily: B.fontDisplay, fontStyle: 'italic', fontWeight: 600, fontSize: '34px', color: B.dark50, lineHeight: 1.25, margin: '0 0 16px' }}>
              Everyone who made it had someone.
            </h2>
            <p style={{ fontFamily: B.fontUI, fontSize: '14px', color: B.dark400, lineHeight: 1.7, margin: 0 }}>
              The professionals who make it rarely do it alone —
              they had the right mentor at the right time. We make
              that available to everyone.
            </p>

            {/* Plan tier bullets — matches signup page */}
            <div className="asc-brand-tiers">
              <div className="asc-tier-row">
                <div className="asc-tier-dot" style={{ background: '#4ADE80' }} />
                <span className="asc-tier-label">Explorer</span>
                <span className="asc-tier-sub">STUDENTS 15–22</span>
              </div>
              <div className="asc-tier-row">
                <div className="asc-tier-dot" style={{ background: B.gold }} />
                <span className="asc-tier-label">Builder</span>
                <span className="asc-tier-sub">EARLY CAREER 22–32</span>
              </div>
              <div className="asc-tier-row">
                <div className="asc-tier-dot" style={{ background: '#A78BFA' }} />
                <span className="asc-tier-label">Climber</span>
                <span className="asc-tier-sub">MID-CAREER 32–50</span>
              </div>
            </div>
          </div>

          {/* Bottom quote */}
          <div style={{ borderLeft: `3px solid ${B.gold}`, paddingLeft: '16px' }}>
            <p style={{ fontFamily: B.fontDisplay, fontStyle: 'italic', fontWeight: 600, fontSize: '15px', color: B.dark200, lineHeight: 1.6, margin: '0 0 8px' }}>
              "Your manager is not going to tell you what's holding you back. We will."
            </p>
            <span style={{ fontFamily: B.fontMono, fontSize: '10px', color: B.dark500, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
              ASCENTOR PROMISE
            </span>
          </div>
        </div>

        {/* ── RIGHT FORM PANEL ── */}
        <div className="asc-form-panel">
          <div className="asc-form-inner">

            {/* Logo at top of form — matches signup */}
            <div style={{ marginBottom: '32px' }}>
              <Link href="/">
                <img src="/ascentor-color-for-dark-pages.svg" alt="Ascentor" style={{ height: '28px', width: 'auto' }} />
              </Link>
            </div>

            <h1 style={{ fontFamily: B.fontDisplay, fontWeight: 700, fontSize: 'clamp(28px, 4vw, 38px)', color: B.dark50, margin: '0 0 6px', lineHeight: 1.1 }}>
              Welcome back.
            </h1>
            <p style={{ fontFamily: B.fontUI, fontSize: '14px', color: B.dark400, margin: '0 0 28px', lineHeight: 1.6 }}>
              Your mentor is waiting.
            </p>

            <div className="asc-rule" />

            {/* OAuth */}
            <div className="asc-oauth">
              <OAuthButton provider="google"        onError={setError} />
              <OAuthButton provider="linkedin_oidc" onError={setError} />
            </div>

            {/* Divider */}
            <div className="asc-divider">
              <div className="asc-divider-line" />
              <span style={{ fontFamily: B.fontMono, fontSize: '11px', color: B.dark500, letterSpacing: '0.04em', whiteSpace: 'nowrap' as const }}>
                or continue with email
              </span>
              <div className="asc-divider-line" />
            </div>

            {/* Login form */}
            <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="email" required
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Email address"
                className="asc-input"
              />
              <PasswordInput value={password} onChange={setPassword} placeholder="Enter your password" />
              {error && <div className="asc-error">{error}</div>}
              <button type="submit" disabled={loading} className="asc-btn-primary" style={{ marginTop: '4px' }}>
                {loading ? 'Logging in…' : 'Log In'}
              </button>
            </form>

            {/* Forgot password */}
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <Link href="/forgot-password" style={{ fontFamily: B.fontUI, fontSize: '13px', color: B.dark400, textDecoration: 'none' }}>
                Forgot your password?
              </Link>
            </div>

            {/* Bottom CTA */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '28px', paddingTop: '24px', borderTop: `1px solid ${B.border}` }}>
              <p style={{ fontFamily: B.fontUI, fontSize: '13px', color: B.dark400, margin: 0 }}>
                Don't have an account?{' '}
                <Link href="/signup" style={{ color: B.gold, fontWeight: 600, fontFamily: B.fontUI, fontSize: '13px', textDecoration: 'none' }}>
                  Sign up →
                </Link>
              </p>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}
