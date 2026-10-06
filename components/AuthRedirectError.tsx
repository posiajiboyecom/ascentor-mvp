'use client';

// components/AuthRedirectError.tsx
// Supabase reports sign-in failures that happen on ITS side (for example a database error while it
// creates a new Google or email user) by redirecting to the site with the problem in the URL:
//   /?error=server_error&error_code=unexpected_failure&error_description=...   (query and hash)
// Without this component the visitor sees only an odd address bar and nothing else. Mounted once in
// the root layout, it reads those parameters on any page, logs the details to the console, shows a
// clear message in a dialog, and removes the parameters from the address bar.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

interface AuthProblem {
  title: string;
  message: string;
  raw: { error: string; code: string; description: string };
}

function describe(error: string, code: string, description: string): AuthProblem {
  const text = `${code} ${description}`.toLowerCase();
  let title = 'We could not sign you in';
  let message = description || 'Something went wrong while signing you in. Please try again.';

  if (text.includes('database error') || code === 'unexpected_failure') {
    title = 'We could not create your account';
    message =
      'Sign-in with your provider worked, but we could not finish setting up your account on our side. ' +
      'Please try again in a moment. If it keeps happening, contact support and mention this message.';
  } else if (error === 'access_denied' || code === 'access_denied') {
    title = 'Sign-in was cancelled';
    message = 'You cancelled the sign-in, or the provider did not allow access. You can try again whenever you like.';
  } else if (code === 'otp_expired' || text.includes('expired')) {
    title = 'That link has expired';
    message = 'For security, sign-in and confirmation links expire quickly. Please request a new one.';
  } else if (code === 'email_exists' || text.includes('already registered') || text.includes('already been registered')) {
    title = 'That email already has an account';
    message = 'Try signing in instead, or use "Forgot your password?" if you do not remember it.';
  }
  return { title, message, raw: { error, code, description } };
}

export default function AuthRedirectError() {
  const [problem, setProblem] = useState<AuthProblem | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const get = (k: string) => query.get(k) ?? hash.get(k) ?? '';
    const error = get('error');
    const code = get('error_code');
    // Our own callback uses ?error=auth_failed style codes on /login; leave those to the login page.
    if (!error || !(code || get('error_description'))) return;

    const description = get('error_description').replace(/\+/g, ' ');
    const p = describe(error, code, description);
    console.error('[auth] sign-in failed:', p.raw);
    setProblem(p);

    // Clean the address bar so a refresh does not show the dialog again.
    ['error', 'error_code', 'error_description'].forEach((k) => query.delete(k));
    const cleanQuery = query.toString();
    window.history.replaceState(null, '', window.location.pathname + (cleanQuery ? `?${cleanQuery}` : ''));
  }, []);

  useEffect(() => {
    if (!problem) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setProblem(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [problem]);

  if (!problem) return null;

  return (
    <div
      role="presentation"
      onClick={() => setProblem(null)}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(15,15,14,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="auth-problem-title"
        aria-describedby="auth-problem-message"
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#FFFFFF', borderRadius: 16, padding: '1.75rem', maxWidth: 440, width: '100%', boxShadow: '0 24px 64px rgba(15,15,14,0.22)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <AlertCircle size={22} color="#DC2626" aria-hidden="true" />
          <h2 id="auth-problem-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#0F0F0E' }}>{problem.title}</h2>
        </div>
        <p id="auth-problem-message" style={{ margin: '0 0 1.25rem', fontSize: '0.9375rem', lineHeight: 1.6, color: '#374151' }}>{problem.message}</p>
        {problem.raw.description && (
          <p style={{ margin: '0 0 1.25rem', fontSize: '0.75rem', color: '#6B7280', wordBreak: 'break-word' }}>
            Technical detail: {problem.raw.description}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setProblem(null)}
            style={{ padding: '0.625rem 1rem', borderRadius: 10, border: '1.5px solid #E8E6E1', background: '#FFFFFF', color: '#0F0F0E', fontWeight: 600, cursor: 'pointer' }}
          >
            Close
          </button>
          <Link
            href="/login"
            onClick={() => setProblem(null)}
            style={{ padding: '0.625rem 1rem', borderRadius: 10, background: '#0F0F0E', color: '#FAFAF8', fontWeight: 600, textDecoration: 'none' }}
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
