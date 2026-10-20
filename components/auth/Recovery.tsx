'use client';

// components/auth/Recovery.tsx
// Password recovery, as in the design prototype: Reset your password -> Check your email -> (link) ->
// set a new password, or "This link has expired". One component so the steps can hand over to each other.
//
// The email carries a button to /reset-password?email=...&code=... The code is the same one-time code the
// server has always issued (hashed, attempt-limited, single use, 1 hour). Opening the link verifies nothing;
// the code is checked when the new password is submitted, and any failure lands on the expired screen.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Check, Mail } from 'lucide-react';
import Turnstile from '@/components/auth/Turnstile';
import { AuthShell, AuthPassword } from '@/components/auth/AuthShell';
import { rememberResetOrigin, signInPathAfterReset } from '@/lib/resetOrigin';
import { PASSWORD_MIN } from '@/lib/auth/password-policy';

type Step = 'forgot' | 'checkemail' | 'linkexpired' | 'newpassword' | 'done';

const ART: Record<Step, [string, string]> = {
  forgot: ['It happens.', 'We’ll get you back in.'],
  checkemail: ['Check your inbox.', 'The link is on its way.'],
  linkexpired: ['Let’s try again.', 'Links expire to keep your account safe.'],
  newpassword: ['Almost there.', 'Choose a password only you know.'],
  done: ['You’re set.', 'Sign in with your new password.'],
};

const COOLDOWN_S = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same masking as the prototype: first letter, three dots, then the character before @ and the domain.
function mask(em: string): string {
  const at = em.indexOf('@');
  return at > 1 ? em.charAt(0) + '•••' + em.slice(at - 1) : em;
}

function checkPassword(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters`;
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number';
  return null;
}

export default function Recovery({ mode }: { mode: 'forgot' | 'reset' }) {
  const router = useRouter();
  const params = useSearchParams();
  const urlEmail = (params.get('email') ?? '').trim().toLowerCase();
  const urlCode = (params.get('code') ?? '').trim();
  const linkOk = mode === 'reset' && EMAIL_RE.test(urlEmail) && /^\d{6}$/.test(urlCode);

  const [step, setStep] = useState<Step>(mode === 'forgot' ? 'forgot' : linkOk ? 'newpassword' : 'linkexpired');
  const [email, setEmail] = useState(mode === 'reset' && EMAIL_RE.test(urlEmail) ? urlEmail : '');
  const [sentTo, setSentTo] = useState('');
  const [signInHref, setSignInHref] = useState('/login');

  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [confirmError, setConfirmError] = useState('');

  useEffect(() => {
    rememberResetOrigin();
    setSignInHref(signInPathAfterReset());
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function go(next: Step) {
    setStep(next);
    setError('');
    setNotice('');
    setFieldError('');
  }

  /** Asks the server to email a reset link. The reply is the same whether or not the account exists. */
  async function sendReset(address: string, resend = false) {
    const target = address.trim().toLowerCase();
    if (!EMAIL_RE.test(target)) { setFieldError('Enter the email you signed up with.'); return; }
    setBusy(true);
    setError('');
    setNotice('');
    setFieldError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target, captchaToken }),
      });
      const result = await res.json().catch(() => ({}));
      if (result.status === 'oauth_only') {
        const name = result.provider === 'google' ? 'Google' : result.provider ? 'LinkedIn' : 'that provider';
        setEmail(target);
        setStep('forgot');
        setError(`This email signs in with ${name}, so it has no password to reset. Use that button on the sign-in page instead.`);
      } else if (res.ok && result.status === 'sent') {
        setEmail(target);
        setSentTo(target);
        setCooldown(COOLDOWN_S);
        setStep('checkemail');
        if (resend) setNotice('Sent again. Check your spam folder too.');
      } else {
        setError(result.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setBusy(false);
      setCaptchaToken('');
      setCaptchaReset((n) => n + 1);
    }
  }

  async function submitNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const pe = checkPassword(pw);
    const ce = !confirm ? 'Please confirm your password' : pw !== confirm ? 'Passwords do not match' : '';
    setPwError(pe ?? '');
    setConfirmError(ce);
    if (pe || ce) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: urlEmail, otp_code: urlCode, new_password: pw }),
      });
      const result = await res.json().catch(() => ({}));
      if (res.ok) {
        setPw('');
        setConfirm('');
        go('done');
        setTimeout(() => router.push(signInPathAfterReset()), 2500);
      } else if (result.code === 'invalid_code') {
        go('linkexpired');
      } else {
        setError(result.error || 'Failed to reset password');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const [title, sub] = ART[step];

  return (
    <AuthShell title={title} sub={sub}>
      {step === 'forgot' && (
        <form className="ax-st" noValidate onSubmit={(e) => { e.preventDefault(); if (!busy) void sendReset(email); }}>
          <div>
            <Link href={signInHref} className="ax-lk back">
              <ArrowRight aria-hidden="true" style={{ transform: 'rotate(180deg)' }} />Sign in
            </Link>
          </div>
          <h1 className="ax-h2">Reset your password</h1>
          <p className="ax-p muted">Enter the email you use for Ascentor. We’ll send you a link to set a new password.</p>
          <div className="ax-fld">
            <label htmlFor="fpe">Email</label>
            <input id="fpe" className="ax-in" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(fieldError)} disabled={busy} />
            {fieldError && <p className="ax-ferr">{fieldError}</p>}
          </div>
          <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} />
          {error && <p className="ax-banner err" role="alert">{error}</p>}
          <button type="submit" className="ax-btn bp bw" disabled={busy}>{busy ? 'Sending...' : 'Send reset link'}</button>
          <p className="ax-sm">Signed up with Google or Apple? You don’t have a password. Use that button on the sign-in page instead.</p>
        </form>
      )}

      {step === 'checkemail' && (
        <div className="ax-st">
          <span className="ax-tile"><Mail aria-hidden="true" /></span>
          <h1 className="ax-h2">Check your email</h1>
          <p className="ax-p">We sent a reset link to <b>{mask(sentTo)}</b>. It works once, for 1 hour.</p>
          <a className="ax-btn bs bw" href="mailto:">Open email app</a>
          <div className="ax-row">
            <span className="ax-sm">Didn’t get it?</span>
            <button type="button" className="ax-lk sm" disabled={busy || cooldown > 0} onClick={() => void sendReset(sentTo, true)}>
              {busy ? 'Sending...' : cooldown > 0 ? `Send again (${cooldown}s)` : 'Send again'}
            </button>
            <button type="button" className="ax-lk sm" onClick={() => go('forgot')}>Use a different email</button>
          </div>
          <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} />
          {notice && <p className="ax-banner ok" role="status">{notice}</p>}
          {error && <p className="ax-banner err" role="alert">{error}</p>}
        </div>
      )}

      {step === 'linkexpired' && (
        <div className="ax-st">
          <svg className="ax-ill" viewBox="0 0 120 120" aria-hidden="true">
            <circle className="halo" cx="60" cy="66" r="40" />
            <path className="s" d="M60 22v12" />
            <rect className="lamp" x="44" y="34" width="32" height="44" rx="8" />
            <ellipse className="flame" cx="60" cy="58" rx="6" ry="9" />
          </svg>
          <h1 className="ax-h2">This link has expired</h1>
          <p className="ax-p muted">Reset links work once, for 1 hour. Ask for a new one and use it straight away.</p>
          {EMAIL_RE.test(email) && <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} />}
          {error && <p className="ax-banner err" role="alert">{error}</p>}
          <button
            type="button"
            className="ax-btn bp bw"
            disabled={busy}
            onClick={() => (EMAIL_RE.test(email) ? void sendReset(email) : go('forgot'))}
          >
            {busy ? 'Sending...' : 'Send a new link'}
          </button>
          <div>
            <Link href={signInHref} className="ax-lk">Back to sign in<ArrowRight aria-hidden="true" /></Link>
          </div>
        </div>
      )}

      {step === 'newpassword' && (
        <form className="ax-st" noValidate onSubmit={submitNewPassword}>
          <h1 className="ax-h2">Choose a new password</h1>
          <p className="ax-p muted">Setting a new password for <b style={{ color: 'var(--ax-text)' }}>{mask(urlEmail)}</b>.</p>
          <div className="ax-fld">
            <label htmlFor="rpn">New password</label>
            <AuthPassword id="rpn" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={`At least ${PASSWORD_MIN} characters`} autoComplete="new-password" aria-invalid={Boolean(pwError)} disabled={busy} />
            {pwError && <p className="ax-ferr">{pwError}</p>}
          </div>
          <div className="ax-fld">
            <label htmlFor="rpc">Confirm new password</label>
            <AuthPassword id="rpc" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type it again" autoComplete="new-password" aria-invalid={Boolean(confirmError)} disabled={busy} />
            {confirmError && <p className="ax-ferr">{confirmError}</p>}
          </div>
          {error && <p className="ax-banner err" role="alert">{error}</p>}
          <button type="submit" className="ax-btn bp bw" disabled={busy}>{busy ? 'Updating...' : 'Update password'}</button>
          <p className="ax-sm">The link works once. After this it stops working.</p>
        </form>
      )}

      {step === 'done' && (
        <div className="ax-st">
          <span className="ax-tile"><Check aria-hidden="true" /></span>
          <h1 className="ax-h2">Password updated</h1>
          <p className="ax-p muted" role="status">You’ve been signed out everywhere. Taking you to sign in...</p>
          <Link href={signInHref} className="ax-btn bp bw">Sign in</Link>
        </div>
      )}
    </AuthShell>
  );
}
