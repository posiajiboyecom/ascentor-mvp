'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PasswordInput from '@/components/PasswordInput';
import { OAuthButton } from '@/lib/sso';

export default function LoginPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const supabase     = createClient();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (searchParams.get('reason') === 'session_expired') {
      setSessionExpired(true);
    }
  }, [searchParams]);

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

      if (completedStep2) {
        try {
          const { data: setting } = await supabase
            .from('platform_settings')
            .select('value')
            .eq('key', 'checkout_enabled')
            .single();
          const checkoutOn = setting ? setting.value === 'true' : true;
          router.push(checkoutOn ? '/checkout' : '/dashboard');
        } catch {
          router.push('/dashboard');
        }
        return;
      }
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
        body { background: #FAFAF8 !important; color: #0F0F0E !important; }

        .login-page {
          min-height: 100dvh;
          display: flex;
          background: #FAFAF8;
          overflow-y: auto;
        }

        /* ── Left brand panel ── */
        .login-brand {
          display: none;
          width: 440px;
          flex-shrink: 0;
          background: #0F0F0E;
          padding: 60px 48px;
          flex-direction: column;
          justify-content: space-between;
        }
        @media (min-width: 1024px) { .login-brand { display: flex; } }

        /* ── Right form panel ── */
        .login-form-panel {
          flex: 1;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 40px 24px;
          background: #FAFAF8;
          overflow-y: auto;
        }
        .login-form-inner {
          width: 100%;
          max-width: 420px;
        }

        .login-input {
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
        .login-input::placeholder { color: #9CA3AF; }
        .login-input:focus { border-color: #C8A96E; }

        .login-btn {
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
        .login-btn:hover:not(:disabled) { background: #2A2A29; }
        .login-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .login-divider {
          display: flex; align-items: center; gap: 16px; margin: 1.5rem 0;
        }
        .login-divider-line { flex: 1; height: 1px; background: #E8E6E1; }

        .login-error {
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          background: rgba(220,38,38,0.05);
          border: 1px solid rgba(220,38,38,0.2);
          color: #DC2626;
          font-size: 0.875rem;
          line-height: 1.5;
          margin-bottom: 0.5rem;
        }

        .dimension-pill {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0.75rem 0;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .dimension-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #C8A96E;
          flex-shrink: 0;
        }
      `}</style>

      <div className="login-page">

        {/* ── Left Brand Panel ── */}
        <div className="login-brand">
          <div>
            {/* Logo */}
            <Link href="/" style={{ textDecoration: 'none' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ascentor-color-for-dark-pages.svg" alt="Ascentor" style={{ height: 28, width: 'auto' }} />
            </Link>

            {/* Headline */}
            <div style={{ marginTop: '3rem' }}>
              <p style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#C8A96E',
                marginBottom: '1rem',
              }}>The Elevation Summit Platform</p>
              <h2 style={{
                fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
                fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
                fontWeight: 800,
                color: '#FAFAF8',
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
                marginBottom: '1rem',
              }}>
                Welcome back.<br />
                <span style={{ color: '#C8A96E' }}>The ascent continues.</span>
              </h2>
              <p style={{ fontSize: '0.9375rem', color: '#6B7280', lineHeight: 1.75 }}>
                Every day you show up is a day you choose direction over drift.
              </p>
            </div>

            {/* The Total Person dimensions */}
            <div style={{ marginTop: '2.5rem' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4B5563', marginBottom: '1rem' }}>
                Built across six dimensions
              </p>
              {['Mind', 'Character', 'Vocation', 'Relationships', 'Community', 'Legacy'].map((dim) => (
                <div key={dim} className="dimension-pill">
                  <div className="dimension-dot" />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#D1D5DB' }}>{dim}</span>
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
              "An unbuilt person cannot build anything that lasts."
            </p>
            <span style={{ fontSize: '0.7rem', color: '#4B5563', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
              The Founding Conviction
            </span>
          </div>
        </div>

        {/* ── Right Form Panel ── */}
        <div className="login-form-panel">
          <div className="login-form-inner">

            {/* Mobile logo */}
            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Link href="/" style={{ textDecoration: 'none' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/ascentor-color-for-light-pages.svg" alt="Ascentor" style={{ height: 24, width: 'auto' }} />
              </Link>
              <Link href="/signup" style={{ fontSize: '0.875rem', color: '#6B7280', textDecoration: 'none' }}>
                New here? <span style={{ color: '#C8A96E', fontWeight: 600 }}>Join →</span>
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
              Sign in
            </h1>
            <p style={{ fontSize: '0.9375rem', color: '#6B7280', margin: '0 0 1.75rem', lineHeight: 1.6 }}>
              Continue your ascent.
            </p>

            {/* Session expired notice */}
            {sessionExpired && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.625rem',
                padding: '0.875rem 1rem',
                borderRadius: '0.625rem',
                background: 'rgba(200,169,110,0.08)',
                border: '1px solid rgba(200,169,110,0.25)',
                marginBottom: '1.25rem',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C8A96E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#92700A', margin: '0 0 0.125rem' }}>
                    Session expired
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: '#A07820', margin: 0, lineHeight: 1.5 }}>
                    You were signed out after 24 hours of inactivity. Please sign in again to continue.
                  </p>
                </div>
              </div>
            )}

            {/* Gold rule */}
            <div style={{ height: '2px', background: 'linear-gradient(90deg, #C8A96E 0%, transparent 100%)', borderRadius: '2px', marginBottom: '1.75rem' }} />

            {/* OAuth */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <OAuthButton provider="google"        onError={setError} />
              <OAuthButton provider="linkedin_oidc" onError={setError} />
            </div>

            {/* Divider */}
            <div className="login-divider">
              <div className="login-divider-line" />
              <span style={{ fontSize: '0.75rem', color: '#9CA3AF', whiteSpace: 'nowrap', fontWeight: 500 }}>
                or continue with email
              </span>
              <div className="login-divider-line" />
            </div>

            {/* Form */}
            <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="email" required
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Email address"
                className="login-input"
              />
              <PasswordInput value={password} onChange={setPassword} placeholder="Password" />
              {error && <div className="login-error">{error}</div>}
              <button type="submit" disabled={loading} className="login-btn" style={{ marginTop: '0.25rem' }}>
                {loading ? 'Signing in...' : 'Sign In →'}
              </button>
            </form>

            {/* Forgot password */}
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <Link href="/forgot-password" style={{ fontSize: '0.875rem', color: '#9CA3AF', textDecoration: 'none' }}>
                Forgot your password?
              </Link>
            </div>

            {/* Bottom */}
            <div style={{
              marginTop: '2rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid #E8E6E1',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: 0 }}>
                Not yet part of the movement?{' '}
                <Link href="/signup" style={{ color: '#C8A96E', fontWeight: 700, textDecoration: 'none' }}>
                  Join Ascentor →
                </Link>
              </p>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}
