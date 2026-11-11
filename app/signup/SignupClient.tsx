'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Gift } from 'lucide-react';
import { AuthShell, AuthPassword } from '@/components/auth/AuthShell';
import { useAuthUrlError } from '@/components/auth/useAuthUrlError';
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

function callbackNextFor(isFree: boolean, plan: string | null, billing: string, currency: string, invite?: string | null): string {
  if (invite && invite.startsWith('/facilitator/') && /^\/facilitator\/[A-Za-z0-9_-]+$/.test(invite)) return invite; // a personal Leader invite link
  if (isFree || !plan) return '/onboarding';
  return `/checkout?plan=${plan}&billing=${billing}&currency=${currency}`;
}

export default function SignupClient({ inviter }: { inviter?: { firstName: string; code: string } | null }) {
  const searchParams = useSearchParams();

  const [error, setError] = useAuthUrlError();
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

    const callbackNext = callbackNextFor(isFree, planParam, billingParam, currencyParam, searchParams.get('redirect'));

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

  const callbackNext = callbackNextFor(isFree, planParam, billingParam, currencyParam, searchParams.get('redirect'));
  const [oauthBusy, setOauthBusy] = useState(false);

  async function oauth(provider: 'google' | 'linkedin_oidc') {
    setOauthBusy(true);
    setError(null);
    const r = await signInWithSSO(provider, undefined, { next: callbackNext });
    if (!r.success) { setError(r.error || 'Sign-in failed'); setOauthBusy(false); }
  }

  const art = inviter
    ? { title: 'Stop drifting. Start becoming.', sub: `${inviter.firstName} thinks you’d like it here.` }
    : { title: 'Join the movement.', sub: 'Your ascent begins here. Free to join.' };

  if (pendingEmail) {
    return (
      <AuthShell title={art.title} sub={art.sub}>
        {modal && <AuthModal open title={modal.title} message={modal.message} actions={modal.actions} onClose={() => setModal(null)} />}
        <div className="ax-lightcard">
          <OtpVerify email={pendingEmail} password={pendingPassword} next={callbackNext} captchaToken={captchaToken} onBack={() => { setPendingEmail(null); setPendingPassword(''); }} />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={art.title} sub={art.sub}>
      {modal && <AuthModal open title={modal.title} message={modal.message} actions={modal.actions} onClose={() => setModal(null)} />}
      <div className="ax-st">
        {inviter ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="ax-inv-av" aria-hidden="true">{inviter.firstName.charAt(0).toUpperCase()}</span>
              <div>
                <p className="ax-sm" style={{ color: 'var(--ax-muted)' }}>Invited by</p>
                <p className="ax-h3">{inviter.firstName}</p>
              </div>
            </div>
            <h1 className="ax-h2">Join {inviter.firstName} on Ascentor</h1>
            <p style={{ margin: 0 }}>Small daily practices, a Circle of people who know your goals, and mentors who show up. The daily home of The Elevation Summit.</p>
            <div className="ax-inv-gift">
              <Gift aria-hidden="true" />
              <p style={{ margin: 0 }}>Start with <b>7 days free</b> on any plan. Cancel before day 8 and you pay nothing.</p>
            </div>
          </>
        ) : (
          <h1 className="ax-h2">Create your account</h1>
        )}

        <button type="button" className="ax-sso" onClick={() => void oauth('google')} disabled={oauthBusy}>
          <ProviderIcon provider="google" size={20} />Continue with Google
        </button>
        {!inviter && (
          <button type="button" className="ax-sso" onClick={() => void oauth('linkedin_oidc')} disabled={oauthBusy}>
            <ProviderIcon provider="linkedin_oidc" size={20} />Continue with LinkedIn
          </button>
        )}
        {inviter && !showEmail && (
          <button type="button" className="ax-btn bs bw" onClick={() => setShowEmail(true)}>Sign up with email</button>
        )}

        {showEmail && !inviter && <p className="ax-orline">or with email</p>}

        {showEmail && (
          <form className="ax-st" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="ax-fld">
              <label htmlFor="suf">Full name</label>
              <input id="suf" className="ax-in" type="text" autoComplete="name" disabled={loading} aria-invalid={Boolean(errors.fullName)} {...register('fullName')} />
              {errors.fullName && <p className="ax-ferr">{errors.fullName.message}</p>}
            </div>
            <div className="ax-fld">
              <label htmlFor="sue">Email</label>
              <input id="sue" className="ax-in" type="email" autoComplete="email" disabled={loading} aria-invalid={Boolean(errors.email)} {...register('email')} />
              {errors.email && <p className="ax-ferr">{errors.email.message}</p>}
            </div>
            <div className="ax-fld">
              <label htmlFor="sup">Password</label>
              <AuthPassword id="sup" placeholder={`At least ${PASSWORD_MIN} characters`} autoComplete="new-password" disabled={loading} aria-invalid={Boolean(errors.password)} {...register('password')} />
              {errors.password && <p className="ax-ferr">{errors.password.message}</p>}
            </div>

            {referralCode && !inviter && <p className="ax-banner ok" role="status">Referral code applied: <b>{referralCode}</b></p>}

            <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} />
            {error && <p className="ax-banner err" role="alert">{error}</p>}

            <button type="submit" disabled={loading} className="ax-btn bp bw">{loading ? 'Creating account...' : 'Join Ascentor'}</button>
          </form>
        )}
        {!showEmail && error && <p className="ax-banner err" role="alert">{error}</p>}

        {inviter && <p className="ax-sm">Invite code <span className="ax-code">{inviter.code}</span> is applied for you.</p>}

        <p className="ax-sm" style={{ color: 'var(--ax-muted)' }}>
          By joining, you agree to our <Link href="/terms" className="ax-lk sm dim" style={{ textDecoration: 'underline' }}>Terms</Link> and <Link href="/privacy" className="ax-lk sm dim" style={{ textDecoration: 'underline' }}>Privacy Policy</Link>.
        </p>
        <p className="ax-sm" style={{ textAlign: 'center' }}>
          Already part of the movement?{' '}
          <Link href="/login" className="ax-lk sm rust">Sign in</Link>
        </p>
      </div>
    </AuthShell>
  );
}
