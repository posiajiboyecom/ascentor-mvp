'use client';

// ============================================================
// app/p/[subdomain]/login/login.tsx
//
// FILE LOCATION: app/p/[subdomain]/login/login.tsx
//
// FIX (W-16):
//   The "Access to this platform is by invite only." notice was
//   positioned BELOW the card in 11px dim text — visually buried
//   and nearly invisible on dark backgrounds. It also appeared
//   simultaneously with the error state, creating two competing
//   messages stacked below the card.
//
//   Fix:
//   - Notice moved ABOVE the card as a visible badge with a border,
//     icon, and legible 12px text.
//   - The notice is conditionally hidden when error is non-null,
//     since the error message already conveys the relevant context.
//   - Clearing an error (on new input) restores the notice.
// ============================================================

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PasswordInput from '@/components/PasswordInput';

function PartnerLoginForm() {
  const router       = useRouter();
  const supabase     = createClient();
  const params       = useParams();
  const searchParams = useSearchParams();
  const subdomain    = params.subdomain as string;

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  const redirectTo = searchParams.get('redirect') || `/p/${subdomain}/dashboard`;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(redirectTo);
    });
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    setLoading(false);
  }

  async function handleOAuth(provider: 'google' | 'linkedin_oidc') {
    const callbackUrl = new URL(`${window.location.origin}/auth/callback`);
    callbackUrl.searchParams.set('partner_subdomain', subdomain);
    callbackUrl.searchParams.set('next', redirectTo);

    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl.toString() },
    });
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', background: 'var(--bg)',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h1 style={{
            fontFamily: 'var(--font-heading)', fontSize: 'clamp(24px, 4vw, 30px)',
            fontWeight: 700, color: 'var(--text)', lineHeight: 1.2,
          }}>
            Welcome back
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 6 }}>
            Log in to access your platform
          </p>
        </div>

        {/*
          FIX W-16: Invite notice — shown ABOVE the card, hidden when error is showing.
          Previous position was below the card in tiny dim text, which was buried and
          conflicted with the error state.
        */}
        {!error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', borderRadius: 10, marginBottom: 16,
            background: 'rgba(232,160,32,0.06)',
            border: '1px solid rgba(232,160,32,0.18)',
          }}>
            <span style={{ fontSize: 14, color: 'var(--accent)', flexShrink: 0 }}>◎</span>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Access to this platform is by invite only.
            </p>
          </div>
        )}

        {/* Card */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '28px 24px',
        }}>

          {/* OAuth */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <button onClick={() => handleOAuth('google')} style={oauthBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
            <button onClick={() => handleOAuth('linkedin_oidc')} style={oauthBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#0A66C2">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              Continue with LinkedIn
            </button>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>or log in with email</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email" required value={email}
              onChange={e => { setEmail(e.target.value); setError(null); }}
              placeholder="Email address"
              style={fieldStyle}
            />
            <PasswordInput
              value={password} onChange={p => { setPassword(p); setError(null); }}
              showStrength={false} placeholder="Password"
            />

            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                color: '#EF4444', fontSize: 13, lineHeight: 1.5,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                padding: '13px 24px', borderRadius: 10, border: 'none',
                background: 'var(--accent)', color: '#000',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                opacity: loading ? 0.5 : 1, marginTop: 4,
              }}
            >
              {loading ? 'Logging in…' : 'Log in →'}
            </button>
          </form>
        </div>

        {/* Signup link */}
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-dim)', marginTop: 20 }}>
          Don't have an account?{' '}
          <Link
            href={`/p/${subdomain}/signup`}
            style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
          >
            Sign up →
          </Link>
        </p>
      </div>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  border: '1px solid var(--border)', background: 'var(--bg-input)',
  color: 'var(--text)', fontSize: 14, outline: 'none',
  fontFamily: 'var(--font-body)',
};

const oauthBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: 10, width: '100%', padding: '11px 16px', borderRadius: 9,
  border: '1px solid var(--border)', background: 'var(--bg-input)',
  color: 'var(--text)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
  fontFamily: 'var(--font-body)', transition: 'border-color 0.15s',
};

export default function PartnerLoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading…</p>
      </div>
    }>
      <PartnerLoginForm />
    </Suspense>
  );
}
