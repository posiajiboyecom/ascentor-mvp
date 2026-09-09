'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PasswordInput from '@/components/PasswordInput';
import { OAuthButton } from '@/lib/sso';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (searchParams.get('reason') === 'session_expired') {
      setSessionExpired(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const plan = searchParams.get('plan');
    const billing = searchParams.get('billing');
    if (plan && typeof window !== 'undefined') {
      const existing = localStorage.getItem('ascentor_plan_intent');
      if (!existing) {
        localStorage.setItem('ascentor_plan_intent', JSON.stringify({ planName: plan, billing: billing || 'monthly' }));
      }
    }
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

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

  async function onSubmit(data: LoginFormData) {
    setLoading(true);
    setError(null);

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/security-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authData.session?.user.id }),
      });
      const check = await res.json();
      if (!check.allowed) {
        await supabase.auth.signOut();
        setError(check.message);
        setLoading(false); return;
      }
    } catch { }

    await routeAfterAuth(authData.session!.user.id);
    setLoading(false);
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #FAFAF8 !important; color: #0F0F0E !important; }

        .auth-split {
          min-height: 100dvh;
          display: grid;
          grid-template-columns: 1fr;
          background: #FAFAF8;
        }
        @media (min-width: 1024px) {
          .auth-split { grid-template-columns: 1fr 1fr; }
        }

        .auth-image {
          display: none;
          width: 100%;
          height: 100%;
          position: relative;
          overflow: hidden;
        }
        .auth-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          position: absolute;
          inset: 0;
        }
        @media (min-width: 1024px) { .auth-image { display: block; } }

        .auth-form-panel {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          background: #FAFAF8;
        }
        .auth-form-inner {
          width: 100%;
          max-width: 420px;
        }

        .auth-input {
          width: 100%;
          padding: 0.875rem 1rem;
          background: #FFFFFF;
          border: 1.5px solid #E8E6E1;
          border-radius: 0.625rem;
          color: #0F0F0E;
          font-family: Metropolis;
          font-size: 0.9375rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .auth-input::placeholder { color: #9CA3AF; }
        .auth-input:focus { border-color: #C8A96E; }
        .auth-input.error { border-color: #DC2626; }

        .auth-btn {
          width: 100%;
          padding: 0.875rem;
          border-radius: 0.625rem;
          border: none;
          cursor: pointer;
          background: #0F0F0E;
          color: #FAFAF8;
          font-family: Metropolis;
          font-size: 1rem;
          font-weight: 700;
          transition: background 0.15s, opacity 0.15s;
        }
        .auth-btn:hover:not(:disabled) { background: #2A2A29; }
        .auth-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .auth-divider {
          display: flex; align-items: center; gap: 16px; margin: 1.5rem 0;
        }
        .auth-divider-line { flex: 1; height: 1px; background: #E8E6E1; }

        .field-error {
          color: #DC2626;
          font-size: 0.8125rem;
          margin-top: 0.375rem;
          line-height: 1.4;
        }

        .auth-error {
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          background: rgba(220,38,38,0.05);
          border: 1px solid rgba(220,38,38,0.2);
          color: #DC2626;
          font-size: 0.875rem;
          line-height: 1.5;
          margin-bottom: 0.5rem;
        }
      `}</style>

      <div className="auth-split">
        {/* Left: Image */}
        <div className="auth-image">
          <img src="/images/login-hero.jpg" alt="" />
        </div>

        {/* Right: Form */}
        <div className="auth-form-panel">
          <div className="auth-form-inner">
            {/* Mobile logo */}
            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Link href="/" style={{ textDecoration: 'none' }}>
                <img src="/ascentor-color-for-light-pages.svg" alt="Ascentor" style={{ height: 24, width: 'auto' }} />
              </Link>
              <Link href="/signup" style={{ fontSize: '0.875rem', color: '#6B7280', textDecoration: 'none' }}>
                New here? <span style={{ color: '#C8A96E', fontWeight: 600 }}>Join</span>
              </Link>
            </div>

            <h1 style={{
              fontFamily: 'Metropolis',
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
              <OAuthButton provider="google" onError={setError} />
              <OAuthButton provider="linkedin_oidc" onError={setError} />
            </div>

            {/* Divider */}
            <div className="auth-divider">
              <div className="auth-divider-line" />
              <span style={{ fontSize: '0.75rem', color: '#9CA3AF', whiteSpace: 'nowrap', fontWeight: 500 }}>
                or continue with email
              </span>
              <div className="auth-divider-line" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <input
                  type="email"
                  {...register('email')}
                  placeholder="Email address"
                  className={`auth-input ${errors.email ? 'error' : ''}`}
                  disabled={loading}
                />
                {errors.email && <p className="field-error">{errors.email.message}</p>}
              </div>
              <div>
                <PasswordInput
                  {...register('password')}
                  placeholder="Password"
                  className={errors.password ? 'error' : ''}
                />
                {errors.password && <p className="field-error">{errors.password.message}</p>}
              </div>
              {error && <div className="auth-error">{error}</div>}
              <button type="submit" disabled={loading} className="auth-btn" style={{ marginTop: '0.25rem' }}>
                {loading ? 'Signing in...' : 'Sign In'}
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
                  Join Ascentor
                </Link>
              </p>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
