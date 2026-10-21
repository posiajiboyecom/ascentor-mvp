'use client';

// components/auth/OtpVerify.tsx
// The email-verification step of SIGN-UP. The member types the six-digit code we emailed; on success
// the address is confirmed and we sign them straight in with the password they just chose, then send
// them on through /auth/continue (onboarding for new members). It is never shown at ordinary sign-in.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Mail, ShieldCheck, Loader2 } from 'lucide-react';
import Turnstile from '@/components/auth/Turnstile';

interface OtpVerifyProps {
  email: string;
  /** Held in memory only, to sign in once the code is accepted. */
  password: string;
  /** Where /auth/continue should send them afterwards. */
  next?: string;
  /** @deprecated Ignored: this step gets its own CAPTCHA token. */
  captchaToken?: string;
  /** Shown once on mount, for example "We sent a new code". */
  initialNotice?: string;
  onBack: () => void;
}

const COOLDOWN_S = 60;

export default function OtpVerify({ email, password, next = '/onboarding', initialNotice, onBack }: OtpVerifyProps) {
  // Turnstile tokens are single use and the sign-up / sign-in form has already spent its own, so this step
  // runs its own widget: one token for the resend button and one for the sign-in that follows verification.
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(COOLDOWN_S);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(initialNotice ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function submit(value: string) {
    if (busy || value.length !== 6) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const verify = await fetch('/api/auth/verify-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: value }),
      });
      const result = await verify.json().catch(() => ({}));
      if (!verify.ok) {
        setError(result.error || 'That code did not work. Please try again.');
        setCode('');
        inputRef.current?.focus();
        return;
      }

      // Confirmed: sign in with the password chosen a moment ago.
      const loginToken = captchaToken;
      setCaptchaToken('');
      setCaptchaReset((n) => n + 1);
      const login = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, captchaToken: loginToken }),
      });
      if (!login.ok) {
        const l = await login.json().catch(() => ({}));
        setError(l.error || 'Your email is confirmed. Please sign in to continue.');
        return;
      }
      window.location.assign(`/auth/continue?next=${encodeURIComponent(next)}`);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/auth/resend-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, captchaToken }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) setError(result.error || 'We could not send a new code. Please try again shortly.');
      else setNotice('A new code is on its way. It can take a minute to arrive.');
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setResending(false);
      setCooldown(COOLDOWN_S);
      setCaptchaToken('');
      setCaptchaReset((n) => n + 1);
    }
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void submit(code); }}
      style={{ textAlign: 'center', padding: '0.5rem 0' }}
      aria-labelledby="otp-title"
    >
      <div aria-hidden="true" style={{ width: 56, height: 56, borderRadius: '50%', background: '#F4F3EF', margin: '0 auto 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Mail size={26} color="#8A6A2B" />
      </div>
      <h1 id="otp-title" style={{ fontWeight: 800, fontSize: '1.75rem', margin: '0 0 0.5rem', color: '#0F0F0E', letterSpacing: '-0.02em' }}>
        Enter your code
      </h1>
      <p style={{ fontSize: '0.9375rem', color: '#374151', lineHeight: 1.6, margin: '0 0 0.25rem' }}>We sent a 6-digit code to</p>
      <p style={{ fontSize: '1rem', fontWeight: 700, color: '#0F0F0E', margin: '0 0 1.25rem', wordBreak: 'break-all' }}>{email}</p>

      <label htmlFor="otp-code" style={{ position: 'absolute', left: -9999 }}>Verification code</label>
      <input
        id="otp-code"
        ref={inputRef}
        value={code}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="123456"
        aria-invalid={Boolean(error)}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 6);
          setCode(v);
          if (v.length === 6) void submit(v);
        }}
        style={{
          width: '100%', textAlign: 'center', fontSize: '1.75rem', letterSpacing: '0.5em', fontWeight: 700,
          padding: '0.9rem 1rem', borderRadius: 12, border: `1.5px solid ${error ? '#DC2626' : '#E8E6E1'}`, background: '#FFFFFF', color: '#0F0F0E', outline: 'none',
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'center' }}><Turnstile onToken={setCaptchaToken} resetKey={captchaReset} /></div>

      {error && <p role="alert" style={{ margin: '0.75rem 0 0', fontSize: '0.875rem', color: '#DC2626', lineHeight: 1.5 }}>{error}</p>}
      {notice && <p role="status" style={{ margin: '0.75rem 0 0', fontSize: '0.875rem', color: '#15803D', lineHeight: 1.5 }}>{notice}</p>}

      <button
        type="submit"
        disabled={busy || code.length !== 6}
        style={{ marginTop: '1.25rem', width: '100%', padding: '0.9rem', borderRadius: 10, border: 'none', background: '#0F0F0E', color: '#FAFAF8', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', opacity: busy || code.length !== 6 ? 0.45 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <ShieldCheck size={18} aria-hidden="true" />}
        {busy ? 'Verifying…' : 'Verify and continue'}
      </button>

      <button
        type="button"
        onClick={resend}
        disabled={cooldown > 0 || resending}
        style={{ marginTop: '0.75rem', width: '100%', padding: '0.8rem', borderRadius: 10, border: '1.5px solid #E8E6E1', background: '#FFFFFF', color: '#0F0F0E', fontWeight: 600, cursor: cooldown > 0 ? 'not-allowed' : 'pointer', opacity: cooldown > 0 ? 0.55 : 1 }}
      >
        {resending ? 'Sending…' : cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
      </button>

      <p style={{ fontSize: '0.8125rem', color: '#6B7280', marginTop: '1.25rem' }}>
        Codes expire after 15 minutes. Check spam if it does not arrive.{' '}
        <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', padding: 0, color: '#8A6A2B', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
          Use a different email
        </button>
        {' '}or <Link href="/login" style={{ color: '#8A6A2B', fontWeight: 700 }}>sign in</Link>.
      </p>
    </form>
  );
}
