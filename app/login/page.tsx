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
  success:     '#10B981',
  successMuted:'rgba(16,185,129,0.08)',
};

export default function LoginPage() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const supabase    = createClient();

  // Mode: login or signup — driven by ?mode=signup or /signup redirect
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [fullName,  setFullName]  = useState('');
  const [error,     setError]     = useState<string | null>(null);
  const [success,   setSuccess]   = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);

  // Read mode and plan intent from URL on mount
  useEffect(() => {
    const urlMode = searchParams.get('mode');
    if (urlMode === 'signup') setMode('signup');

    // Preserve plan+billing params into localStorage if passed via URL
    // (set by useCheckout when user isn't logged in)
    const plan    = searchParams.get('plan');
    const billing = searchParams.get('billing');
    if (plan && typeof window !== 'undefined') {
      const existing = localStorage.getItem('ascentor_plan_intent');
      if (!existing) {
        // Only set if not already set — don't overwrite richer intent from useCheckout
        localStorage.setItem('ascentor_plan_intent', JSON.stringify({ planName: plan, billing: billing || 'monthly' }));
      }
    }
  }, [searchParams]);

  // ── Smart post-auth routing ────────────────────────────────────
  // Mirrors auth/callback logic exactly:
  // onboarding_completed → /dashboard
  // paid, not onboarded → /dashboard
  // step 2 done, not paid → /checkout
  // step 1 done → /onboarding?step=2
  // fresh → /onboarding
  async function routeAfterAuth(userId: string) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed, subscription_status, full_name, current_role, goal_role, industry')
        .eq('id', userId)
        .single();

      if (profile?.onboarding_completed === true) {
        router.push('/dashboard'); return;
      }

      const hasPaid =
        profile?.subscription_status === 'active' ||
        profile?.subscription_status === 'trialing';

      if (hasPaid) { router.push('/dashboard'); return; }

      const completedStep1 = !!(profile?.full_name && profile?.current_role);
      const completedStep2 = !!(
        profile?.full_name && profile?.current_role &&
        profile?.goal_role && profile?.industry
      );

      if (completedStep2)      { router.push('/checkout'); return; }
      if (completedStep1)      { router.push('/onboarding?step=2'); return; }
      router.push('/onboarding');
    } catch {
      router.push('/dashboard');
    }
  }

  // ── Login ──────────────────────────────────────────────────────
  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false); return;
    }

    // Security check
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

  // ── Signup ─────────────────────────────────────────────────────
  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setSuccess(null);

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      setLoading(false); return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      setLoading(false); return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim() },
        // After email confirmation, callback routes them correctly
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false); return;
    }

    // If email confirmation is disabled in Supabase (common in dev/early prod),
    // user is immediately active — route them directly
    if (data.session) {
      // Also create/update profile with full_name immediately
      try {
        await supabase.from('profiles').upsert({
          id:         data.session.user.id,
          full_name:  fullName.trim(),
          email:      email,
          updated_at: new Date().toISOString(),
        });
      } catch {}

      await routeAfterAuth(data.session.user.id);
      setLoading(false); return;
    }

    // Email confirmation required — show message
    setSuccess(
      `Check your inbox at ${email}. Click the confirmation link to activate your account.`
    );
    setLoading(false);
  }

  const isSignup = mode === 'signup';

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
        .asc-page::before {
          content: '';
          position: fixed;
          top: -20vh; left: 50%;
          transform: translateX(-50%);
          width: 600px; height: 600px;
          background: radial-gradient(ellipse at center, rgba(232,160,32,0.07) 0%, transparent 70%);
          pointer-events: none; z-index: 0;
        }
        .asc-brand-panel {
          display: none;
          width: 420px; flex-shrink: 0;
          background: ${B.dark700};
          border-right: 1px solid ${B.border};
          padding: 60px 48px;
          flex-direction: column;
          justify-content: space-between;
          position: relative; overflow: hidden;
        }
        .asc-brand-panel::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0; height: 50%;
          background: linear-gradient(to top, rgba(232,160,32,0.04), transparent);
          pointer-events: none;
        }
        @media (min-width: 1024px) { .asc-brand-panel { display: flex; } }

        .asc-form-panel {
          flex: 1; display: flex;
          flex-direction: column;
          align-items: center; justify-content: center;
          padding: 40px 24px;
          position: relative; z-index: 1;
        }
        .asc-form-inner {
          width: 100%; max-width: 400px;
          display: flex; flex-direction: column; gap: 0;
        }
        .asc-rule {
          height: 1px;
          background: linear-gradient(90deg, ${B.gold} 0%, transparent 70%);
          margin: 28px 0;
        }
        .asc-input {
          width: 100%; padding: 13px 16px;
          border-radius: 10px;
          border: 1px solid ${B.border};
          background: ${B.dark700};
          color: ${B.dark50};
          font-family: ${B.fontUI}; font-size: 14px;
          outline: none; transition: border-color 0.15s;
        }
        .asc-input::placeholder { color: ${B.dark500}; }
        .asc-input:focus        { border-color: ${B.goldBorder}; }
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
          margin-bottom: 12px;
        }
        .asc-success {
          padding: 10px 14px; border-radius: 8px;
          background: ${B.successMuted};
          border: 1px solid rgba(16,185,129,0.2);
          color: ${B.success};
          font-family: ${B.fontUI}; font-size: 13px; line-height: 1.5;
          margin-bottom: 12px;
        }
        .asc-oauth { display: flex; flex-direction: column; gap: 10px; }

        /* Mode toggle tabs */
        .asc-mode-toggle {
          display: flex;
          background: ${B.dark700};
          border: 1px solid ${B.border};
          border-radius: 10px; padding: 4px;
          margin-bottom: 28px; gap: 4px;
        }
        .asc-mode-btn {
          flex: 1; padding: 9px 16px;
          border-radius: 7px; border: none; cursor: pointer;
          font-family: ${B.fontUI}; font-size: 13px; font-weight: 600;
          transition: all 0.15s;
        }
        .asc-mode-btn.active  { background: ${B.gold}; color: ${B.dark}; }
        .asc-mode-btn.inactive { background: transparent; color: ${B.dark400}; }
        .asc-mode-btn.inactive:hover { color: ${B.dark200}; }
      `}</style>

      <div className="asc-page">

        {/* ── LEFT BRAND PANEL ── */}
        <div className="asc-brand-panel">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '48px' }}>
              <Link href="/" className="lp-nav-logo">
                <img src="/ascentor-color-for-dark-pages.svg" alt="Ascentor" style={{ height: '32px', width: 'auto' }} />
              </Link>
            </div>
            <h2 style={{ fontFamily: B.fontDisplay, fontStyle: 'italic', fontWeight: 600, fontSize: '36px', color: B.dark50, lineHeight: 1.25, margin: '0 0 20px' }}>
              Everyone who made it had someone.
            </h2>
            <p style={{ fontFamily: B.fontUI, fontSize: '14px', color: B.dark400, lineHeight: 1.7, margin: 0 }}>
              Africa's mentorship platform — AI guidance, human expertise,
              and peer accountability built for your reality.
            </p>
          </div>
          <div style={{ borderLeft: `3px solid ${B.gold}`, paddingLeft: '16px' }}>
            <p style={{ fontFamily: B.fontDisplay, fontStyle: 'italic', fontWeight: 600, fontSize: '16px', color: B.dark200, lineHeight: 1.5, margin: '0 0 8px' }}>
              "I went from stuck to promoted in 90 days. The mentor saw what I couldn't."
            </p>
            <span style={{ fontFamily: B.fontMono, fontSize: '10px', color: B.dark500, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
              BUILDER · LAGOS · FINTECH
            </span>
          </div>
        </div>

        {/* ── RIGHT FORM PANEL ── */}
        <div className="asc-form-panel">
          <div className="asc-form-inner">

            {/* Mobile logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '36px' }} className="lg:hidden">
              <Link href="/" className="lp-nav-logo">
                <img src="/ascentor-color-for-dark-pages.svg" alt="Ascentor" style={{ height: '32px', width: 'auto' }} />
              </Link>
            </div>

            {/* Headline — changes with mode */}
            <h1 style={{ fontFamily: B.fontDisplay, fontWeight: 700, fontSize: 'clamp(28px, 4vw, 36px)', color: B.dark50, margin: '0 0 6px', lineHeight: 1.15 }}>
              {isSignup ? 'Start your ascent.' : 'Welcome back.'}
            </h1>
            <p style={{ fontFamily: B.fontUI, fontSize: '14px', color: B.dark400, margin: '0 0 28px', lineHeight: 1.6 }}>
              {isSignup ? 'Create your account — it takes 60 seconds.' : 'Your mentor is waiting.'}
            </p>

            <div className="asc-rule" />

            {/* Mode toggle */}
            <div className="asc-mode-toggle">
              <button className={`asc-mode-btn ${!isSignup ? 'active' : 'inactive'}`} onClick={() => { setMode('login'); setError(null); setSuccess(null); }}>
                Log In
              </button>
              <button className={`asc-mode-btn ${isSignup ? 'active' : 'inactive'}`} onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}>
                Sign Up
              </button>
            </div>

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

            {/* ── LOGIN FORM ── */}
            {!isSignup && (
              <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className="asc-input" />
                <PasswordInput value={password} onChange={setPassword} placeholder="Enter your password" />
                {error   && <div className="asc-error">{error}</div>}
                <button type="submit" disabled={loading} className="asc-btn-primary" style={{ marginTop: '4px' }}>
                  {loading ? 'Logging in…' : 'Log In'}
                </button>
              </form>
            )}

            {/* ── SIGNUP FORM ── */}
            {isSignup && (
              <form onSubmit={handleEmailSignup} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full name" className="asc-input" />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className="asc-input" />
                <PasswordInput value={password} onChange={setPassword} placeholder="Create a password (8+ chars)" />
                {error   && <div className="asc-error">{error}</div>}
                {success && <div className="asc-success">{success}</div>}
                {!success && (
                  <button type="submit" disabled={loading} className="asc-btn-primary" style={{ marginTop: '4px' }}>
                    {loading ? 'Creating account…' : 'Create Account →'}
                  </button>
                )}
                <p style={{ fontFamily: B.fontMono, fontSize: '10px', color: B.dark500, textAlign: 'center', letterSpacing: '0.04em', margin: '4px 0 0' }}>
                  7-DAY FREE TRIAL · NO CARD UNTIL DAY 8 · CANCEL ANYTIME
                </p>
              </form>
            )}

            {/* Forgot password — login only */}
            {!isSignup && (
              <div style={{ textAlign: 'center', marginTop: '14px' }}>
                <Link href="/forgot-password" style={{ fontFamily: B.fontUI, fontSize: '13px', color: B.dark400, textDecoration: 'none' }}>
                  Forgot your password?
                </Link>
              </div>
            )}

            {/* Bottom CTA — switches context */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '28px', paddingTop: '24px', borderTop: `1px solid ${B.border}` }}>
              <p style={{ fontFamily: B.fontUI, fontSize: '13px', color: B.dark400, margin: 0 }}>
                {isSignup ? 'Already have an account? ' : "Don't have an account? "}
                <button
                  onClick={() => { setMode(isSignup ? 'login' : 'signup'); setError(null); setSuccess(null); }}
                  style={{ background: 'none', border: 'none', padding: 0, color: B.gold, fontWeight: 600, fontFamily: B.fontUI, fontSize: '13px', cursor: 'pointer' }}
                >
                  {isSignup ? 'Log in →' : 'Sign up →'}
                </button>
              </p>
            </div>

            <div style={{ textAlign: 'center', marginTop: '32px' }}>
              <span style={{ fontFamily: B.fontMono, fontSize: '10px', color: B.dark600, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                ASCENTOR · BUILT FOR AFRICA · 2026
              </span>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
