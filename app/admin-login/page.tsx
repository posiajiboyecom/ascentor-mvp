'use client';

// /admin-login - staff sign-in.
//
// Same accounts and same Supabase auth as the member app. The public /login
// and /signup routes are closed (community gate), so admins and moderators
// need their own entry point. After signing in we verify the role and sign
// non-staff accounts straight back out, so this page never leaves a member
// session behind.
//
// Forgot password uses the existing OTP flow (/forgot-password), tagged with
// ?from=admin so the user lands back here after resetting.

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const STAFF_ROLES = ['admin', 'moderator'];

// Only ever redirect to an /admin path on this site (no open redirects).
function safeRedirect(raw: string | null): string {
  if (!raw || !raw.startsWith('/admin') || raw.startsWith('//') || raw.startsWith('/admin-login')) return '/admin';
  return raw;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // Already signed in as staff? Skip the form.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reason') === 'session_expired') setNotice('Your session expired. Please sign in again.');

    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
          if (!cancelled && profile && STAFF_ROLES.includes(profile.role)) {
            router.replace(safeRedirect(params.get('redirect')));
            return;
          }
        }
      } catch { /* fall through to the form */ }
      if (!cancelled) setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError || !data.user) {
        setError('Incorrect email or password.');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
      if (!profile || !STAFF_ROLES.includes(profile.role)) {
        await supabase.auth.signOut();
        setError('This account does not have staff access.');
        return;
      }

      const redirect = new URLSearchParams(window.location.search).get('redirect');
      router.replace(safeRedirect(redirect));
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="al-page">
      <style>{`
        .al-page {
          min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 24px 16px;
          background: var(--app-bg, #FAFAF8); color: var(--app-text, #0F0F0E);
        }
        .al-card {
          width: 100%; max-width: 400px; padding: 32px 28px; border-radius: 18px;
          background: var(--app-bg-card, #fff); border: 1px solid var(--app-border, rgba(0,0,0,.09));
          box-shadow: 0 18px 48px rgba(0,0,0,.10);
        }
        .al-badge {
          display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px;
          font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
          background: var(--app-accent-glow, rgba(200,169,110,.12)); color: var(--app-accent, #C8A96E);
        }
        .al-title { margin: 14px 0 4px; font-size: 24px; font-weight: 700; letter-spacing: -0.01em; }
        .al-sub { margin: 0 0 22px; font-size: 13.5px; color: var(--app-text-dim, #6B7280); line-height: 1.5; }
        .al-field { position: relative; margin-bottom: 12px; }
        .al-field > svg.lead { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: var(--app-text-dim, #6B7280); pointer-events: none; }
        .al-input {
          width: 100%; height: 46px; padding: 0 42px 0 38px; border-radius: 12px; font: inherit; font-size: 14.5px;
          background: var(--app-bg-input, #F4F3EF); color: inherit; border: 1px solid transparent; outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .al-input:focus { border-color: var(--app-accent, #C8A96E); box-shadow: 0 0 0 3px var(--app-accent-glow, rgba(200,169,110,.18)); }
        .al-eye { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 34px; height: 34px; border: 0; border-radius: 8px; background: transparent; color: var(--app-text-dim, #6B7280); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .al-eye:hover { color: var(--app-text, #0F0F0E); }
        .al-btn {
          width: 100%; height: 46px; margin-top: 6px; border: 0; border-radius: 12px; cursor: pointer;
          font: inherit; font-size: 14.5px; font-weight: 600; color: #0F0F0E; background: var(--app-accent, #C8A96E);
          display: flex; align-items: center; justify-content: center; gap: 8px; transition: filter .15s, transform .05s;
        }
        .al-btn:hover:not(:disabled) { filter: brightness(1.06); }
        .al-btn:active:not(:disabled) { transform: translateY(1px); }
        .al-btn:disabled { opacity: .65; cursor: not-allowed; }
        .al-msg { margin: 0 0 14px; padding: 10px 12px; border-radius: 10px; font-size: 13px; line-height: 1.45; }
        .al-error { background: rgba(217,83,79,.10); color: #d9534f; border: 1px solid rgba(217,83,79,.30); }
        .al-notice { background: var(--app-accent-glow, rgba(200,169,110,.12)); color: var(--app-text, #0F0F0E); border: 1px solid var(--app-border-gold, rgba(200,169,110,.25)); }
        .al-links { margin-top: 18px; display: flex; justify-content: space-between; font-size: 13px; }
        .al-links a { color: var(--app-text-dim, #6B7280); text-decoration: none; }
        .al-links a:hover { color: var(--app-accent, #C8A96E); }
        .spin { animation: al-spin .8s linear infinite; }
        @keyframes al-spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="al-card">
        <span className="al-badge"><ShieldCheck size={13} aria-hidden="true" /> Staff only</span>
        <h1 className="al-title">Admin sign in</h1>
        <p className="al-sub">Use the same email and password as your Ascentor account. Access is limited to admins and moderators.</p>

        {notice && <p className="al-msg al-notice" role="status">{notice}</p>}
        {error && <p className="al-msg al-error" role="alert">{error}</p>}

        {checking ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }} aria-busy="true">
            <Loader2 className="spin" size={22} aria-label="Checking session" />
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <div className="al-field">
              <Mail className="lead" aria-hidden="true" />
              <input
                className="al-input" type="email" inputMode="email" autoComplete="username" required
                placeholder="Email address" aria-label="Email address"
                value={email} onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="al-field">
              <Lock className="lead" aria-hidden="true" />
              <input
                className="al-input" type={show ? 'text' : 'password'} autoComplete="current-password" required
                placeholder="Password" aria-label="Password"
                value={password} onChange={e => setPassword(e.target.value)}
              />
              <button type="button" className="al-eye" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            <button className="al-btn" type="submit" disabled={busy || !email || !password}>
              {busy ? <><Loader2 size={16} className="spin" aria-hidden="true" /> Signing in…</> : 'Sign in'}
            </button>
          </form>
        )}

        <div className="al-links">
          <Link href="/forgot-password?from=admin">Forgot password?</Link>
          <Link href="/">Back to site</Link>
        </div>
      </div>
    </main>
  );
}
