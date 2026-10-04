'use client';

import { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PasswordInput from '@/components/PasswordInput';
import { OAuthButton } from '@/lib/sso';
import { createClient } from '@/lib/supabase/client';
import CheckInbox from '@/components/auth/CheckInbox';

const signupSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

type SignupFormData = z.infer<typeof signupSchema>;

function callbackNextFor(isFree: boolean, plan: string | null, billing: string, currency: string): string {
  if (isFree || !plan) return '/onboarding';
  return `/checkout?plan=${plan}&billing=${billing}&currency=${currency}`;
}

function SignUpForm() {
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const planParam = searchParams.get('plan');
  const billingParam = searchParams.get('billing') ?? 'monthly';
  const currencyParam = searchParams.get('currency') ?? 'ngn';
  const isFree = planParam === 'free' || !planParam;
  const refCode = searchParams.get('ref');
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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  async function onSubmit(data: SignupFormData) {
    setLoading(true);
    setError(null);

    const callbackNext = callbackNextFor(isFree, planParam, billingParam, currencyParam);

    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(callbackNext)}`,
      },
    });

    if (error) {
      setError(error.message);
    } else if (!authData.session) {
      // Email confirmation is required: there is no session yet. Show the
      // "check your inbox" screen (with resend) instead of sending an
      // unauthenticated visitor into /onboarding or /checkout.
      setPendingEmail(data.email);
    } else if (planParam && !isFree) {
      // The welcome email is sent once, at the end of onboarding.
      router.push(`/checkout?plan=${planParam}&billing=${billingParam}&currency=${currencyParam}`);
    } else {
      router.push('/onboarding');
    }
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
        .auth-image::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(15, 15, 14, 0.15) 0%, rgba(15, 15, 14, 0.55) 100%);
          pointer-events: none;
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
          <img src="/images/signup-hero.jpg" alt="" />
        </div>

        {/* Right: Form */}
        <div className="auth-form-panel">
          <div className="auth-form-inner">
            {pendingEmail ? (
              <CheckInbox email={pendingEmail} next={callbackNextFor(isFree, planParam, billingParam, currencyParam)} />
            ) : (
            <>
            {/* Mobile logo */}
            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Link href="/" style={{ textDecoration: 'none' }}>
                <img src="/ascentor-color-for-light-pages.svg" alt="Ascentor" style={{ height: 24, width: 'auto' }} />
              </Link>
              <Link href="/login" style={{ fontSize: '0.875rem', color: '#6B7280', textDecoration: 'none' }}>
                Have an account? <span style={{ color: '#C8A96E', fontWeight: 600 }}>Sign in →</span>
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
              Join the movement.
            </h1>
            <p style={{ fontSize: '0.9375rem', color: '#6B7280', margin: '0 0 1.75rem', lineHeight: 1.6 }}>
              Your ascent begins here. Free to join.
            </p>

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
                  placeholder="Create a password (min 8 chars)"
                  className={errors.password ? 'error' : ''}
                  light
                />
                {errors.password && <p className="field-error">{errors.password.message}</p>}
              </div>

              {/* Referral code - shown only if present */}
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

              {error && <div className="auth-error">{error}</div>}

              <button type="submit" disabled={loading} className="auth-btn" style={{ marginTop: '0.25rem' }}>
                {loading ? 'Creating account...' : 'Join Ascentor'}
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

            </>
            )}
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
