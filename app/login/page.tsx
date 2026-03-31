'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PasswordInput from '@/components/PasswordInput';
import { OAuthButton } from '@/lib/sso';

// ─────────────────────────────────────────────────────────────────
// ASCENTOR BRAND TOKENS · Brand Book v1.0 · 2026
// Display : Cormorant Garamond 700 / Italic 600
// UI      : Syne 400–800
// Mono    : DM Mono 400/500
// Gold    : #E8A020   Dark: #0C0B08
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
  const router   = useRouter();
  const supabase = createClient();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
    } else {
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
          setLoading(false);
          return;
        }
      } catch {} // Non-critical

      // ── Smart post-login routing ──────────────────────────────────────────
      // Mirror auth/callback logic so email/password login routes identically
      // to OAuth: incomplete onboarding → /onboarding, no payment → /checkout,
      // completed onboarding (free or paid) → /dashboard.
      try {
        const { data: { user: loggedInUser } } = await supabase.auth.getUser();
        if (loggedInUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('onboarding_completed, subscription_status, full_name, current_role, goal_role, industry')
            .eq('id', loggedInUser.id)
            .single();

          // Fully onboarded (free or paid) — go straight to dashboard
          if (profile?.onboarding_completed === true) {
            router.push('/dashboard');
            return;
          }

          const hasPaid =
            profile?.subscription_status === 'active' ||
            profile?.subscription_status === 'trialing';

          // Paid but flag not set yet (edge case) — let them through
          if (hasPaid) {
            router.push('/dashboard');
            return;
          }

          // Check onboarding progress
          const completedStep1 = !!(profile?.full_name && profile?.current_role);
          const completedStep2 = !!(
            profile?.full_name && profile?.current_role &&
            profile?.goal_role  && profile?.industry
          );

          if (completedStep2) {
            // Both steps done but not paid — go to checkout
            router.push('/checkout');
          } else if (completedStep1) {
            // Partial onboarding — resume at step 2
            router.push('/onboarding?step=2');
          } else {
            // Fresh or incomplete — start from beginning
            router.push('/onboarding');
          }
          return;
        }
      } catch {} // Non-critical — fall through

      router.push('/dashboard');
    }
    setLoading(false);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        body { margin: 0; }

        .asc-page {
          min-height: 100vh;
          display: flex;
          background: ${B.dark};
          font-family: ${B.fontUI};
          position: relative;
          overflow: hidden;
        }

        /* Subtle radial glow — brand atmosphere */
        .asc-page::before {
          content: '';
          position: fixed;
          top: -20vh;
          left: 50%;
          transform: translateX(-50%);
          width: 600px;
          height: 600px;
          background: radial-gradient(ellipse at center, rgba(232,160,32,0.07) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        /* Left brand panel — visible on large screens */
        .asc-brand-panel {
          display: none;
          width: 420px;
          flex-shrink: 0;
          background: ${B.dark700};
          border-right: 1px solid ${B.border};
          padding: 60px 48px;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
        }
        .asc-brand-panel::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 50%;
          background: linear-gradient(to top, rgba(232,160,32,0.04), transparent);
          pointer-events: none;
        }

        @media (min-width: 1024px) {
          .asc-brand-panel { display: flex; }
        }

        .asc-form-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          position: relative;
          z-index: 1;
        }

        .asc-form-inner {
          width: 100%;
          max-width: 400px;
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        /* Gold divider rule */
        .asc-rule {
          height: 1px;
          background: linear-gradient(90deg, ${B.gold} 0%, transparent 70%);
          margin: 28px 0;
        }

        /* Input */
        .asc-input {
          width: 100%;
          padding: 13px 16px;
          border-radius: 10px;
          border: 1px solid ${B.border};
          background: ${B.dark700};
          color: ${B.dark50};
          font-family: ${B.fontUI};
          font-size: 14px;
          font-weight: 400;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .asc-input::placeholder { color: ${B.dark500}; }
        .asc-input:focus        { border-color: ${B.goldBorder}; }

        /* Primary CTA */
        .asc-btn-primary {
          width: 100%;
          padding: 14px 24px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          background: ${B.gold};
          color: ${B.dark};
          font-family: ${B.fontUI};
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.02em;
          transition: background 0.15s ease, opacity 0.15s ease;
        }
        .asc-btn-primary:hover:not(:disabled) { background: ${B.gold600}; }
        .asc-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Divider */
        .asc-divider {
          display: flex;
          align-items: center;
          gap: 16px;
          margin: 24px 0;
        }
        .asc-divider-line {
          flex: 1;
          height: 1px;
          background: ${B.border};
        }

        /* Error */
        .asc-error {
          padding: 10px 14px;
          border-radius: 8px;
          background: ${B.errorMuted};
          border: 1px solid rgba(239,68,68,0.2);
          color: ${B.error};
          font-family: ${B.fontUI};
          font-size: 13px;
          line-height: 1.5;
          margin-bottom: 12px;
        }

        /* OAuth wrapper spacing */
        .asc-oauth { display: flex; flex-direction: column; gap: 10px; margin-bottom: 0; }
      `}</style>

      <div className="asc-page">

        {/* ── LEFT BRAND PANEL (lg+) ── */}
        <div className="asc-brand-panel">

          {/* Logo mark + wordmark */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '48px' }}>
              {/* Brand mark — triangle motif from brand book */}
              <Link href="/" className="lp-nav-logo">
                <img
                  src="/ascentor-color-for-dark-pages.svg"
                  alt="Ascentor"
                  style={{ height: '32px', width: 'auto' }}
                />
              </Link>
            </div>

            {/* Brand promise — Cormorant display */}
            <h2 style={{
              fontFamily:  B.fontDisplay,
              fontStyle:   'italic',
              fontWeight:  600,
              fontSize:    '36px',
              color:       B.dark50,
              lineHeight:  1.25,
              margin:      '0 0 20px',
            }}>
              Everyone who made it had someone.
            </h2>

            <p style={{
              fontFamily: B.fontUI,
              fontSize:   '14px',
              fontWeight: 400,
              color:      B.dark400,
              lineHeight: 1.7,
              margin:     0,
            }}>
              Africa's mentorship platform — AI guidance, human expertise,
              and peer accountability built for your reality.
            </p>
          </div>

          {/* Bottom testimonial — social proof, brand voice */}
          <div style={{
            borderLeft: `3px solid ${B.gold}`,
            paddingLeft: '16px',
          }}>
            <p style={{
              fontFamily: B.fontDisplay,
              fontStyle:  'italic',
              fontWeight: 600,
              fontSize:   '16px',
              color:      B.dark200,
              lineHeight: 1.5,
              margin:     '0 0 8px',
            }}>
              "I went from stuck to promoted in 90 days. The mentor saw what I couldn't."
            </p>
            <span style={{
              fontFamily:    B.fontMono,
              fontSize:      '10px',
              fontWeight:    500,
              color:         B.dark500,
              letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
            }}>
              BUILDER · LAGOS · FINTECH
            </span>
          </div>
        </div>

        {/* ── RIGHT FORM PANEL ── */}
        <div className="asc-form-panel">
          <div className="asc-form-inner">

            {/* Mobile logo — only shows below lg */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '36px' }} className="lg:hidden">
              <Link href="/" className="lp-nav-logo">
                <img
                  src="/ascentor-color-for-dark-pages.svg"
                  alt="Ascentor"
                  style={{ height: '32px', width: 'auto' }}
                />
              </Link>
            </div>

            {/* Headline */}
            <h1 style={{
              fontFamily: B.fontDisplay,
              fontWeight: 700,
              fontSize:   'clamp(28px, 4vw, 36px)',
              color:      B.dark50,
              margin:     '0 0 6px',
              lineHeight: 1.15,
            }}>
              Welcome back.
            </h1>
            <p style={{
              fontFamily: B.fontUI,
              fontSize:   '14px',
              color:      B.dark400,
              margin:     '0 0 28px',
              lineHeight: 1.6,
            }}>
              Your mentor is waiting.
            </p>

            {/* Gold rule */}
            <div className="asc-rule" />

            {/* OAuth */}
            <div className="asc-oauth">
              <OAuthButton provider="google"        onError={setError} />
              <OAuthButton provider="linkedin_oidc" onError={setError} />
            </div>

            {/* Divider */}
            <div className="asc-divider">
              <div className="asc-divider-line" />
              <span style={{
                fontFamily:    B.fontMono,
                fontSize:      '11px',
                fontWeight:    400,
                color:         B.dark500,
                letterSpacing: '0.04em',
                whiteSpace:    'nowrap' as const,
              }}>
                or continue with email
              </span>
              <div className="asc-divider-line" />
            </div>

            {/* Email form */}
            <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email address"
                className="asc-input"
              />

              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder="Enter your password"
              />

              {error && <div className="asc-error">{error}</div>}

              <button type="submit" disabled={loading} className="asc-btn-primary" style={{ marginTop: '4px' }}>
                {loading ? 'Logging in…' : 'Log In'}
              </button>
            </form>

            {/* Forgot password */}
            <div style={{ textAlign: 'center', marginTop: '14px' }}>
              <Link
                href="/forgot-password"
                style={{
                  fontFamily: B.fontUI,
                  fontSize:   '13px',
                  color:      B.dark400,
                  textDecoration: 'none',
                }}
              >
                Forgot your password?
              </Link>
            </div>

            {/* Sign up link */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '28px', paddingTop: '24px', borderTop: `1px solid ${B.border}` }}>
              <p style={{ fontFamily: B.fontUI, fontSize: '13px', color: B.dark400, margin: 0 }}>
                Don't have an account?{' '}
                <Link
                  href="/signup"
                  style={{ color: B.gold, fontWeight: 600, textDecoration: 'none' }}
                >
                  Sign up →
                </Link>
              </p>
            </div>

            {/* Mono footer tag — brand spec for metadata */}
            <div style={{ textAlign: 'center', marginTop: '32px' }}>
              <span style={{
                fontFamily:    B.fontMono,
                fontSize:      '10px',
                fontWeight:    400,
                color:         B.dark600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
              }}>
                ASCENTOR · BUILT FOR AFRICA · 2026
              </span>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
