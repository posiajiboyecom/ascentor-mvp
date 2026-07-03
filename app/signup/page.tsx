'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PasswordInput from '@/components/PasswordInput';
import { OAuthButton } from '@/lib/sso';

function SignUpForm() {
  const router       = useRouter();
  const supabase     = createClient();
  const searchParams = useSearchParams();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  const planParam     = searchParams.get('plan');
  const billingParam  = searchParams.get('billing') ?? 'monthly';
  const currencyParam = searchParams.get('currency') ?? 'ngn';
  const isFree        = planParam === 'free' || !planParam;
  const refCode       = searchParams.get('ref');
  const [referralCode, setReferralCode] = useState('');

  useEffect(() => {
    if (refCode) {
      localStorage.setItem('ascentor_referral', refCode.toUpperCase());
      setReferralCode(refCode.toUpperCase());
    } else {
      const stored = localStorage.getItem('ascentor_referral');
      if (stored) setReferralCode(stored);
    }
  }, [refCode]);

  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Default routing — community is the entry point, then onboarding
    const callbackNext = isFree
      ? '/onboarding'
      : planParam
        ? `/checkout?plan=${planParam}&billing=${billingParam}&currency=${currencyParam}`
        : '/onboarding';

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(callbackNext)}`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      const name = (data.user?.user_metadata?.full_name || email.split('@')[0]) as string;
      fetch('/api/welcome', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, name, userId: data.user?.id }),
      }).catch(() => {});

      // Route to onboarding — community is the entry point for everyone
      if (planParam && !isFree) {
        router.push(`/checkout?plan=${planParam}&billing=${billingParam}&currency=${currencyParam}`);
      } else {
        router.push('/onboarding');
      }
    }
    setLoading(false);
  }

  return (
    <>
      <style>{`
        body { background: #FAFAF8 !important; color: #0F0F0E !important; }

        .signup-page {
          min-height: 100vh;
          display: flex;
          background: #FAFAF8;
        }

        .signup-brand {
          display: none;
          width: 440px;
          flex-shrink: 0;
          background: #0F0F0E;
          padding: 60px 48px;
          flex-direction: column;
          justify-content: space-between;
        }
        @media (min-width: 1024px) { .signup-brand { display: flex; } }

        .signup-form-panel {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          background: #FAFAF8;
        }
        .signup-form-inner {
          width: 100%;
          max-width: 420px;
        }

        .signup-input {
          width: 100%;
          padding: 0.875rem 1rem;
          background: #FFFFFF;
          border: 1.5px solid #E8E6E1;
          border-radius: 0.625rem;
          color: #0F0F0E;
          font-family: var(--font-body, 'Inter', sans-serif);
          font-size: 0.9375rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .signup-input::placeholder { color: #9CA3AF; }
        .signup-input:focus { border-color: #C8A96E; }

        .signup-btn {
          width: 100%;
          padding: 0.875rem;
          border-radius: 0.625rem;
          border: none;
          cursor: pointer;
          background: #0F0F0E;
          color: #FAFAF8;
          font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
          font-size: 1rem;
          font-weight: 700;
          transition: background 0.15s, opacity 0.15s;
        }
        .signup-btn:hover:not(:disabled) { background: #2A2A29; }
        .signup-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .signup-divider {
          display: flex; align-items: center; gap: 16px; margin: 1.5rem 0;
        }
        .signup-divider-line { flex: 1; height: 1px; background: #E8E6E1; }

        .signup-error {
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          background: rgba(220,38,38,0.05);
          border: 1px solid rgba(220,38,38,0.2);
          color: #DC2626;
          font-size: 0.875rem;
          line-height: 1.5;
          margin-bottom: 0.5rem;
        }

        .stage-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 0.875rem 0;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .stage-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #C8A96E;
          flex-shrink: 0;
          margin-top: 5px;
        }
      `}</style>

      <div className="signup-page">

        {/* ── Left Brand Panel ── */}
        <div className="signup-brand">
          <div>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <span style={{
                fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
                fontSize: '1.375rem',
                fontWeight: 800,
                color: '#FAFAF8',
                letterSpacing: '-0.03em',
              }}>Ascentor</span>
            </Link>

            <div style={{ marginTop: '3rem' }}>
              <p style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#C8A96E',
                marginBottom: '1rem',
              }}>The Elevation Summit Movement</p>

              <h2 style={{
                fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
                fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
                fontWeight: 800,
                color: '#FAFAF8',
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
                marginBottom: '1rem',
              }}>
                You were not built<br />
                <span style={{ color: '#C8A96E' }}>to drift.</span>
              </h2>

              <p style={{ fontSize: '0.9375rem', color: '#6B7280', lineHeight: 1.75 }}>
                Ascentor is the daily platform of The Elevation Summit — a global community of purposeful individuals building lives of meaning, leadership, and lasting impact.
              </p>
            </div>

            {/* Ascent stages */}
            <div style={{ marginTop: '2.5rem' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4B5563', marginBottom: '1rem' }}>
                Every stage of ascent
              </p>
              {[
                { stage: 'The Seeker', sub: 'Finding purpose and direction' },
                { stage: 'The Builder', sub: 'Doing the daily work of becoming' },
                { stage: 'The Leader', sub: 'Responsible for others\' ascent' },
              ].map((item) => (
                <div key={item.stage} className="stage-card">
                  <div className="stage-dot" />
                  <div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#D1D5DB', display: 'block' }}>{item.stage}</span>
                    <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>{item.sub}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom quote */}
          <div style={{ borderLeft: '3px solid #C8A96E', paddingLeft: '1rem', marginTop: '2rem' }}>
            <p style={{
              fontFamily: 'var(--font-accent, "Playfair Display", serif)',
              fontStyle: 'italic',
              fontSize: '0.9375rem',
              color: '#9CA3AF',
              lineHeight: 1.65,
              marginBottom: '0.5rem',
            }}>
              "Every life that matters was built on purpose. Not accident. Not circumstance. Purpose."
            </p>
            <span style={{ fontSize: '0.7rem', color: '#4B5563', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
              The Founding Conviction
            </span>
          </div>
        </div>

        {/* ── Right Form Panel ── */}
        <div className="signup-form-panel">
          <div className="signup-form-inner">

            {/* Mobile logo + sign in link */}
            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Link href="/" style={{ textDecoration: 'none' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/ascentor-color-for-light-pages.svg" alt="Ascentor" style={{ height: 24, width: 'auto' }} />
              </Link>
              <Link href="/login" style={{ fontSize: '0.875rem', color: '#6B7280', textDecoration: 'none' }}>
                Have an account? <span style={{ color: '#C8A96E', fontWeight: 600 }}>Sign in →</span>
              </Link>
            </div>

            <h1 style={{
              fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
              fontWeight: 800,
              fontSize: 'clamp(1.75rem, 4vw, 2.25rem)',
              color: '#0F0F0E',
              margin: '0 0 0.375rem',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}>
              Join the movement.
            </h1>
            <p style={{ fontSize: '0.9375rem', color: '#6B7280', margin: '0 0 1.75rem', lineHeight: 1.6 }}>
              Your ascent begins here. Free to join.
            </p>

            {/* Gold rule */}
            <div style={{ height: '2px', background: 'linear-gradient(90deg, #C8A96E 0%, transparent 100%)', borderRadius: '2px', marginBottom: '1.75rem' }} />

            {/* OAuth */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <OAuthButton provider="google"        onError={setError} />
              <OAuthButton provider="linkedin_oidc" onError={setError} />
            </div>

            {/* Divider */}
            <div className="signup-divider">
              <div className="signup-divider-line" />
              <span style={{ fontSize: '0.75rem', color: '#9CA3AF', whiteSpace: 'nowrap', fontWeight: 500 }}>
                or continue with email
              </span>
              <div className="signup-divider-line" />
            </div>

            {/* Form */}
            <form onSubmit={handleEmailSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="email" required
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Email address"
                className="signup-input"
              />
              <PasswordInput value={password} onChange={setPassword} placeholder="Create a password (min 8 chars)" />

              {/* Referral code — shown only if present */}
              {referralCode && (
                <div style={{
                  padding: '0.625rem 1rem',
                  background: 'rgba(200,169,110,0.08)',
                  border: '1px solid rgba(200,169,110,0.25)',
                  borderRadius: '0.5rem',
                  fontSize: '0.8125rem',
                  color: '#C8A96E',
                  fontWeight: 600,
                }}>
                  Referral code applied: {referralCode}
                </div>
              )}

              {error && <div className="signup-error">{error}</div>}

              <button type="submit" disabled={loading} className="signup-btn" style={{ marginTop: '0.25rem' }}>
                {loading ? 'Creating account...' : 'Join Ascentor →'}
              </button>
            </form>

            {/* Terms */}
            <p style={{ fontSize: '0.75rem', color: '#9CA3AF', textAlign: 'center', marginTop: '1rem', lineHeight: 1.6 }}>
              By joining, you agree to our{' '}
              <Link href="/terms" style={{ color: '#6B7280', textDecoration: 'underline' }}>Terms</Link>
              {' '}and{' '}
              <Link href="/privacy" style={{ color: '#6B7280', textDecoration: 'underline' }}>Privacy Policy</Link>.
            </p>

            {/* Bottom */}
            <div style={{
              marginTop: '1.5rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid #E8E6E1',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: 0 }}>
                Already part of the movement?{' '}
                <Link href="/login" style={{ color: '#C8A96E', fontWeight: 700, textDecoration: 'none' }}>
                  Sign in →
                </Link>
              </p>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
