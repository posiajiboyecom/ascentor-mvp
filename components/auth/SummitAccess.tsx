'use client';

// components/auth/SummitAccess.tsx
// /summit-access: Elevation Summit attendees claim Ascentor Builder free for 12 months.
// Steps: email (must be on the Summit list) -> 6-digit code sent to it -> choose a password -> signed in, on to setup.
// An email that already has an account stops after the code: the free year is added and they sign in as usual.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Mail } from 'lucide-react';
import Turnstile from '@/components/auth/Turnstile';
import { AuthShell, AuthPassword } from '@/components/auth/AuthShell';
import { PASSWORD_MIN } from '@/lib/auth/password-policy';

type Step = 'email' | 'code' | 'password' | 'done';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COOLDOWN_S = 60;

const ART: Record<Step, [string, string]> = {
  email: ['The rise continues.', 'A free year of Ascentor for Summit attendees.'],
  code: ['Check your inbox.', 'Your code is on its way.'],
  password: ['Almost there.', 'Choose a password only you know.'],
  done: ['You’re in.', 'Your free year has started.'],
};

function checkPassword(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters`;
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number';
  return null;
}

const untilLabel = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' });

async function post(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export default function SummitAccess() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState((params.get('email') ?? '').trim().toLowerCase());
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [existing, setExisting] = useState(false);
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [until, setUntil] = useState('');
  const [signInWith, setSignInWith] = useState<string | null>(null);
  const [next, setNext] = useState('/onboarding');

  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function go(s: Step) { setStep(s); setError(''); setNotice(''); }

  async function sendCode(resend = false) {
    const target = email.trim().toLowerCase();
    if (!EMAIL_RE.test(target)) { setError('Enter the email you used for the Summit.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const r = await post('/api/summit-access/start', { email: target, captchaToken });
      if (r.ok) {
        setEmail(target);
        setExisting(!!r.data.existing);
        setCooldown(COOLDOWN_S);
        if (!resend) { setCode(''); go('code'); } else setNotice('Sent again. Check your spam folder too.');
      } else setError(String(r.data.error ?? 'Something went wrong. Please try again.'));
    } catch { setError('Network error. Please check your connection and try again.'); }
    finally { setBusy(false); setCaptchaToken(''); setCaptchaReset((n) => n + 1); }
  }

  async function checkCode(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(code.trim())) { setError('Enter the 6-digit code from your email.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const r = await post('/api/summit-access/verify', { email, code: code.trim() });
      if (!r.ok) { setError(String(r.data.error ?? 'Something went wrong. Please try again.')); return; }
      if (r.data.done) {
        setUntil(String(r.data.until ?? ''));
        setSignInWith((r.data.signInWith as string | null) ?? null);
        setNext('/login');
        go('done');
      } else {
        setToken(String(r.data.token ?? ''));
        go('password');
      }
    } catch { setError('Network error. Please try again.'); }
    finally { setBusy(false); }
  }

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (name.trim().length < 2) { setError('Please enter your full name.'); return; }
    const pe = checkPassword(pw);
    if (pe) { setError(pe); return; }
    if (pw !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true); setError('');
    try {
      const r = await post('/api/summit-access/complete', { token, fullName: name.trim(), password: pw });
      if (!r.ok) {
        if (r.data.code === 'expired' || r.data.code === 'exists') { setCode(''); go('email'); }
        setError(String(r.data.error ?? 'Something went wrong. Please try again.'));
        return;
      }
      setPw(''); setConfirm('');
      setUntil(String(r.data.until ?? ''));
      const dest = String(r.data.next ?? '/onboarding');
      setNext(dest);
      go('done');
      if (dest === '/onboarding') setTimeout(() => router.push('/onboarding'), 2500);
    } catch { setError('Network error. Please try again.'); }
    finally { setBusy(false); }
  }

  const [title, sub] = ART[step];

  return (
    <AuthShell title={title} sub={sub}>
      {step === 'email' && (
        <form className="ax-st" noValidate onSubmit={(e) => { e.preventDefault(); if (!busy) void sendCode(); }}>
          <p className="ax-sm" style={{ letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>The Elevation Summit 2026</p>
          <h1 className="ax-h2">Claim your free year of Ascentor</h1>
          <p className="ax-p muted">Thank you for being at The Elevation Summit. You get Ascentor Builder free for 12 months: your Circle, Sage, mentor sessions and every Learn track. No card needed.</p>
          <div className="ax-fld">
            <label htmlFor="sae">Email</label>
            <input id="sae" className="ax-in" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
            <p className="ax-sm">Use the email you registered for the Summit with, or the one you emailed us from.</p>
          </div>
          <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} />
          {error && <p className="ax-banner err" role="alert">{error}</p>}
          <button type="submit" className="ax-btn bp bw" disabled={busy}>{busy ? 'Sending...' : 'Send my code'}</button>
          <p className="ax-sm">Already claimed it? <Link href="/login" className="ax-lk sm">Sign in</Link></p>
        </form>
      )}

      {step === 'code' && (
        <form className="ax-st" noValidate onSubmit={checkCode}>
          <span className="ax-tile"><Mail aria-hidden="true" /></span>
          <h1 className="ax-h2">Enter your code</h1>
          <p className="ax-p">We sent a 6-digit code to <b>{email}</b>. It works for 15 minutes.</p>
          <div className="ax-fld">
            <label htmlFor="sac">6-digit code</label>
            <input id="sac" className="ax-in" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} disabled={busy}
              style={{ letterSpacing: '0.4em', fontSize: '1.25rem', textAlign: 'center' }} />
          </div>
          {error && <p className="ax-banner err" role="alert">{error}</p>}
          {notice && <p className="ax-banner" role="status">{notice}</p>}
          <button type="submit" className="ax-btn bp bw" disabled={busy}>{busy ? 'Checking...' : existing ? 'Confirm and add my free year' : 'Continue'}</button>
          <div className="ax-row">
            <span className="ax-sm">Didn’t get it?</span>
            <button type="button" className="ax-lk sm" disabled={busy || cooldown > 0} onClick={() => void sendCode(true)}>
              {cooldown > 0 ? `Send again (${cooldown}s)` : 'Send again'}
            </button>
            <button type="button" className="ax-lk sm" onClick={() => go('email')}>Use a different email</button>
          </div>
          <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} />
        </form>
      )}

      {step === 'password' && (
        <form className="ax-st" noValidate onSubmit={finish}>
          <h1 className="ax-h2">Create your account</h1>
          <p className="ax-p muted">Your email <b>{email}</b> is confirmed. Add your name and choose a password.</p>
          <div className="ax-fld">
            <label htmlFor="san">Full name</label>
            <input id="san" className="ax-in" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
          </div>
          <div className="ax-fld">
            <label htmlFor="sap">Password</label>
            <AuthPassword id="sap" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={`At least ${PASSWORD_MIN} characters`} autoComplete="new-password" disabled={busy} />
            <p className="ax-sm">Use upper and lower case letters and a number.</p>
          </div>
          <div className="ax-fld">
            <label htmlFor="sap2">Confirm password</label>
            <AuthPassword id="sap2" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type it again" autoComplete="new-password" disabled={busy} />
          </div>
          {error && <p className="ax-banner err" role="alert">{error}</p>}
          <button type="submit" className="ax-btn bp bw" disabled={busy}>{busy ? 'Creating your account...' : 'Create my account'}</button>
        </form>
      )}

      {step === 'done' && (
        <div className="ax-st">
          <span className="ax-tile"><Check aria-hidden="true" /></span>
          <h1 className="ax-h2">Your free year has started</h1>
          <p className="ax-p">You have Ascentor Builder free{until ? <> until <b>{untilLabel(until)}</b></> : ' for 12 months'}. No card, and nothing is ever charged.</p>
          {next === '/onboarding' ? (
            <>
              <p className="ax-p muted">Taking you to set up your account...</p>
              <Link href="/onboarding" className="ax-btn bp bw">Set up my account</Link>
            </>
          ) : (
            <>
              <p className="ax-p muted">{signInWith ? `Sign in with ${signInWith} as you usually do.` : 'Sign in with your email and password as usual.'}</p>
              <Link href="/login" className="ax-btn bp bw">Sign in</Link>
            </>
          )}
        </div>
      )}
    </AuthShell>
  );
}
