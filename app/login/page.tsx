'use client';

import { useState, useEffect } from 'react';
import { LOGIN_ERRORS, type GoogleLoginError } from '@/lib/auth/google-login-errors';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import OtpVerify from '@/components/auth/OtpVerify';
import AuthModal, { type AuthModalAction } from '@/components/auth/AuthModal';
import { ProviderIcon, PROVIDER_NAME } from '@/components/auth/ProviderIcon';
import { signInWithSSO } from '@/lib/sso';
import Turnstile from '@/components/auth/Turnstile';
import { AuthShell, AuthPassword } from '@/components/auth/AuthShell';
import { safeNext } from '@/lib/auth/safe-next';

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
  const searchParams = useSearchParams();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [unconfirmedPassword, setUnconfirmedPassword] = useState('');
  const [modal, setModal] = useState<{ title: string; message: string; actions: AuthModalAction[] } | null>(null);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);
  const [oauthBusy, setOauthBusy] = useState(false);

  useEffect(() => {
    if (searchParams.get('reason') === 'session_expired') {
      setSessionExpired(true);
    }
    const err = searchParams.get('error');
    if (err === 'auth_failed') setError('We couldn’t complete that sign-in. The link may have expired. Please try again.');
    if (err === 'login_blocked') setError('For your security that sign-in was blocked because it looked unusual. Please try again in a few minutes.');
    if (err && err in LOGIN_ERRORS) setError(LOGIN_ERRORS[err as GoogleLoginError]);
    if (err === 'session_missing') setError('Your session didn’t start. Please sign in again.');
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

  // Where to go after sign-in. The proxy adds ?redirect=<path> when it bounces
  // a signed-out visitor; safeNext() keeps it to same-site paths.
  const destination = safeNext(searchParams.get('redirect') ?? searchParams.get('next'), '/dashboard');

  async function onSubmit(data: LoginFormData) {
    setLoading(true);
    setError(null);

    // Server-side sign-in: rate limited, CAPTCHA-checked, location-assessed.
    let res: Response;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password: data.password, captchaToken }),
      });
    } catch {
      setError('Network error. Please check your connection and try again.');
      setLoading(false);
      return;
    }
    const result = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (result.code === 'email_not_confirmed') {
        // Sign-up was never finished: the server has just sent a fresh code (it holds the verified CAPTCHA token).
        setUnconfirmedPassword(data.password);
        setUnconfirmedEmail(data.email);
      } else if (result.code === 'use_oauth') {
        const provider: string = result.provider ?? 'google';
        const name = PROVIDER_NAME[provider] ?? 'your provider';
        setModal({
          title: `Please continue with ${name}`,
          message: result.error,
          actions: [
            { label: `Continue with ${name}`, icon: <ProviderIcon provider={provider} />, onClick: () => void signInWithSSO(provider === 'linkedin' ? 'linkedin_oidc' : (provider as 'google' | 'linkedin_oidc')) },
          ],
        });
      } else {
        setError(result.error || 'Something went wrong. Please try again.');
      }
      setCaptchaToken('');
      setCaptchaReset((n) => n + 1);
      setLoading(false);
      return;
    }

    // Full navigation so the new session cookie is sent. /auth/continue applies
    // the same routing rules as the OAuth callback (onboarding, checkout, next).
    window.location.assign(`/auth/continue?next=${encodeURIComponent(destination)}`);
  }

  async function oauth(provider: 'google' | 'linkedin_oidc') {
    setOauthBusy(true);
    setError(null);
    const r = await signInWithSSO(provider);
    if (!r.success) { setError(r.error || 'Sign-in failed'); setOauthBusy(false); }
  }

  const art = { title: 'Welcome back.', sub: 'Pick up where you left off.' };

  if (unconfirmedEmail) {
    return (
      <AuthShell title={art.title} sub={art.sub}>
        {modal && <AuthModal open title={modal.title} message={modal.message} actions={modal.actions} onClose={() => setModal(null)} />}
        <div className="ax-lightcard">
          <OtpVerify email={unconfirmedEmail} password={unconfirmedPassword} next={destination} initialNotice="Your email is not confirmed yet. We sent you a new code." onBack={() => setUnconfirmedEmail(null)} />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={art.title} sub={art.sub}>
      {modal && <AuthModal open title={modal.title} message={modal.message} actions={modal.actions} onClose={() => setModal(null)} />}
      <form className="ax-st" onSubmit={handleSubmit(onSubmit)} noValidate>
        <h1 className="ax-h2">Sign in</h1>

        {sessionExpired && (
          <p className="ax-banner warn" role="status">
            <b>Session expired.</b> You were signed out after 24 hours of inactivity. Please sign in again to continue.
          </p>
        )}

        <button type="button" className="ax-sso" onClick={() => void oauth('google')} disabled={oauthBusy}>
          <ProviderIcon provider="google" size={20} />Continue with Google
        </button>
        <button type="button" className="ax-sso" onClick={() => void oauth('linkedin_oidc')} disabled={oauthBusy}>
          <ProviderIcon provider="linkedin_oidc" size={20} />Continue with LinkedIn
        </button>

        <p className="ax-orline">or with email</p>

        <div className="ax-fld">
          <label htmlFor="sie">Email</label>
          <input id="sie" className="ax-in" type="email" autoComplete="email" disabled={loading} aria-invalid={Boolean(errors.email)} {...register('email')} />
          {errors.email && <p className="ax-ferr">{errors.email.message}</p>}
        </div>
        <div className="ax-fld">
          <div className="ax-sb">
            <label htmlFor="sip">Password</label>
            <Link href="/forgot-password" className="ax-lk sm rust">Forgot password?</Link>
          </div>
          <AuthPassword id="sip" placeholder="Your password" autoComplete="current-password" disabled={loading} aria-invalid={Boolean(errors.password)} {...register('password')} />
          {errors.password && <p className="ax-ferr">{errors.password.message}</p>}
        </div>

        <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} />
        {error && <p className="ax-banner err" role="alert">{error}</p>}

        <button type="submit" disabled={loading} className="ax-btn bp bw">{loading ? 'Signing in...' : 'Sign in'}</button>
        <p className="ax-sm" style={{ textAlign: 'center' }}>
          New to Ascentor?{' '}
          <Link href="/signup" className="ax-lk sm rust">Create an account</Link>
        </p>
      </form>
    </AuthShell>
  );
}
