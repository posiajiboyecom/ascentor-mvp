'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Gift } from 'lucide-react';
import PasswordInput from '@/components/PasswordInput';
import { OAuthButton } from '@/lib/sso';
import OtpVerify from '@/components/auth/OtpVerify';
import AuthModal, { type AuthModalAction } from '@/components/auth/AuthModal';
import { ProviderIcon, PROVIDER_NAME } from '@/components/auth/ProviderIcon';
import { signInWithSSO } from '@/lib/sso';
import Turnstile from '@/components/auth/Turnstile';
import { PASSWORD_MIN } from '@/lib/auth/password-policy';

const signupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Please enter your full name')
    .max(80, 'That name is too long'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

type SignupFormData = z.infer<typeof signupSchema>;

function callbackNextFor(isFree: boolean, plan: string | null, billing: string, currency: string): string {
  if (isFree || !plan) return '/onboarding';
  return `/checkout?plan=${plan}&billing=${billing}&currency=${currency}`;
}

export default function SignupClient({ inviter }: { inviter?: { firstName: string; code: string } | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [pendingPassword, setPendingPassword] = useState('');
  const [modal, setModal] = useState<{ title: string; message: string; actions: AuthModalAction[] } | null>(null);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);
  const [showEmail, setShowEmail] = useState(!inviter);

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

  /** Clear, actionable explanations in a dialog (not a line of red text). */
  function showProblem(result: { error?: string; code?: string; provider?: string }, email: string) {
    const provider = result.provider ?? '';
    const name = PROVIDER_NAME[provider] ?? 'your provider';
    if (result.code === 'use_oauth') {
      setModal({
        title: `Please continue with ${name}`,
        message: result.error || `${email} is registered with ${name}.`,
        actions: [
          { label: `Continue with ${name}`, icon: <ProviderIcon provider={provider} />, onClick: () => void signInWithSSO(provider === 'linkedin' ? 'linkedin_oidc' : (provider as 'google' | 'linkedin_oidc')) },
        ],
      });
    } else if (result.code === 'account_exists') {
      setModal({
        title: 'You already have an account',
        message: result.error || `${email} is already registered.`,
        actions: [
          { label: 'Sign in', href: '/login' },
          { label: 'Reset my password', href: '/forgot-password', variant: 'secondary' },
        ],
      });
    } else if (result.code === 'weak_password') {
      setModal({ title: 'Choose a stronger password', message: result.error || 'That password is not strong enough.', actions: [] });
    } else if (result.code === 'rate_limited') {
      setModal({ title: 'Please wait a little', message: result.error || 'Too many attempts.', actions: [] });
    } else {
      setModal({ title: 'We could not create your account', message: result.error || 'Something went wrong. Please try again.', actions: [] });
    }
  }

  async function onSubmit(data: SignupFormData) {
    setLoading(true);
    setError(null);

    const callbackNext = callbackNextFor(isFree, planParam, billingParam, currencyParam);

    // Server-side sign-up: password policy (incl. breached-password check),
    // rate limiting and CAPTCHA are enforced there, not in the browser.
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: data.fullName, email: data.email, password: data.password, captchaToken, next: callbackNext }),
      });
      const result = await res.json().catch(() => ({}));

      if (res.ok || result.needsVerification) {
        // A six-digit code has been emailed: ask for it. Existing members never see this step.
        setPendingPassword(data.password);
        setPendingEmail(data.email);
        if (result.code === 'email_failed') setError(result.error);
      } else {
        showProblem(result, data.email);
        setCaptchaToken('');
        setCaptchaReset((n) => n + 1);
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
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

      {modal && (
        <AuthModal open title={modal.title} message={modal.message} actions={modal.actions} onClose={() => setModal(null)} />
      )}
      <div className="auth-split">
        {/* Left: Image */}
        <div className="auth-image">
          <img src="/images/signup-hero.jpg" alt="" />
        </div>

        {/* Right: Form */}
        <div className="auth-form-panel">
          <div className="auth-form-inner">
            {pendingEmail ? (
              <OtpVerify
                email={pendingEmail}
                password={pendingPassword}
                next={callbackNextFor(isFree, planParam, billingParam, currencyParam)}
                captchaToken={captchaToken}
                onBack={() => { setPendingEmail(null); setPendingPassword(''); }}
              />
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

            {inviter ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 52, height: 52, borderRadius: '50%', background: '#8D5A3B', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 16, flex: 'none' }}>
                    {inviter.firstName.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, color: '#5F6672' }}>Invited by</p>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{inviter.firstName}</p>
                  </div>
                </div>
                <h1 style={{ fontFamily: 'Metropolis', fontWeight: 800, fontSize: 'clamp(1.75rem, 4vw, 2.25rem)', color: '#0F0F0E', margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                  Join {inviter.firstName} on Ascentor
                </h1>
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55 }}>
                  Small daily practices, a Circle of people who know your goals, and mentors who show up. The daily home of The Elevation Summit.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#FFFFFF', border: '1px solid #E6E3DD', borderRadius: 12, padding: '14px 16px' }}>
                  <Gift aria-hidden style={{ width: 24, height: 24, color: '#8A6D12', flex: 'none' }} />
                  <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55 }}><b>7 extra days free</b> for both of you when you subscribe after your trial.</p>
                </div>
              </div>
            ) : (
              <>
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
              </>
            )}

            {/* OAuth */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <OAuthButton provider="google" onError={setError} />
              {!inviter && <OAuthButton provider="linkedin_oidc" onError={setError} />}
              {inviter && !showEmail && (
                <button type="button" onClick={() => setShowEmail(true)} className="auth-btn" style={{ background: 'transparent', color: '#0F0F0E', border: '1px solid #CFCAC2' }}>Sign up with email</button>
              )}
            </div>

            {/* Divider */}
            {showEmail && !inviter && (<div className="auth-divider">
              <div className="auth-divider-line" />
              <span style={{ fontSize: '0.75rem', color: '#9CA3AF', whiteSpace: 'nowrap', fontWeight: 500 }}>
                or continue with email
              </span>
              <div className="auth-divider-line" />
            </div>)}

            {/* Form */}
            {showEmail && (<form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <input
                  type="text"
                  {...register('fullName')}
                  placeholder="Full name"
                  autoComplete="name"
                  className={`auth-input ${errors.fullName ? 'error' : ''}`}
                  disabled={loading}
                />
                {errors.fullName && <p className="field-error">{errors.fullName.message}</p>}
              </div>
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
                  placeholder="Create a password (min 10 chars)"
                  className={errors.password ? 'error' : ''}
                  light
                />
                {errors.password && <p className="field-error">{errors.password.message}</p>}
              </div>

              {/* Referral code - shown only if present */}
              {referralCode && !inviter && (
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

              <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} />
              {error && <div className="auth-error">{error}</div>}

              <button type="submit" disabled={loading} className="auth-btn" style={{ marginTop: '0.25rem' }}>
                {loading ? 'Creating account...' : 'Join Ascentor'}
              </button>
            </form>)}

            {inviter && (
              <p style={{ fontSize: 14, color: '#5F6672', margin: '1rem 0 0' }}>Invite code <span style={{ display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 12px', borderRadius: 8, border: '1px dashed #CAA228', color: '#8A6D12', fontWeight: 700, letterSpacing: '.06em', fontSize: 12 }}>{inviter.code}</span> is applied for you.</p>
            )}

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

