'use client';

// Public livestream gate for The Elevation Summit.
// Enter the email you registered with -> if it belongs to a PAID registration,
// you get the embedded stream. No password: this mirrors how every other
// Summit confirmation already works (email-only), for a low-stakes conference
// livestream rather than a login system.
import { useEffect, useState, useCallback } from 'react';
import '@/styles/marketing.css';

type Result =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'checking' }
  | { state: 'not_found' }
  | { state: 'not_paid'; fullName: string }
  | { state: 'paid'; fullName: string; streamEnabled: boolean; videoId: string | null; channelId: string; channelUrl: string }
  | { state: 'error'; message: string };

const INPUT = {
  display: 'block' as const,
  width: '100%',
  padding: '0.875rem 1rem',
  fontSize: '1rem',
  borderRadius: '0.625rem',
  border: '1.5px solid #E8E6E1',
  background: '#FAFAF8',
  color: '#0F0F0E',
  outline: 'none',
  boxSizing: 'border-box' as const,
  fontFamily: 'Metropolis, "Inter", sans-serif',
};

const CARD: React.CSSProperties = {
  maxWidth: '640px', margin: '0 auto', background: '#FFFFFF',
  border: '1px solid #E8E6E1', borderRadius: '1.25rem',
  padding: 'clamp(1.75rem, 5vw, 2.75rem)', boxShadow: '0 24px 60px rgba(0,0,0,0.06)',
};

export default function WatchClient() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<Result>({ state: 'loading' });

  const check = useCallback(async (candidateEmail?: string) => {
    setResult({ state: 'checking' });
    try {
      const res = candidateEmail
        ? await fetch('/api/summit/stream/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: candidateEmail }),
          })
        : await fetch('/api/summit/stream/verify', { cache: 'no-store' });

      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        setResult({ state: 'error', message: body.error || 'Too many attempts. Please wait a few minutes and try again.' });
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setResult({ state: 'error', message: body.error || "Something went wrong. Please try again." });
        return;
      }
      const data = await res.json();
      if (data.state === 'anonymous') { setResult({ state: 'idle' }); return; }
      setResult(data);
    } catch {
      setResult({ state: 'error', message: 'Could not reach the server. Check your connection and try again.' });
    }
  }, []);

  // On load, silently try the convenience cookie from a previous visit.
  useEffect(() => { check(); }, [check]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setResult({ state: 'error', message: 'Enter a valid email address.' });
      return;
    }
    check(trimmed);
  };

  const reset = () => { setEmail(''); setResult({ state: 'idle' }); };

  return (
    <main style={{ background: '#FAFAF8', minHeight: '100vh', padding: 'clamp(3rem, 8vw, 6rem) 1.5rem' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto 2.5rem', textAlign: 'center' }}>
        <div className="mkt-gold-bar" style={{ margin: '0 auto 1.25rem' }} />
        <p className="mkt-eyebrow" style={{ marginBottom: '0.75rem' }}>The Elevation Summit · 19 November 2026</p>
        <h1 className="mkt-section-headline" style={{ color: '#0F0F0E', fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}>
          Watch the livestream
        </h1>
      </div>

      {(result.state === 'loading' || result.state === 'checking') && (
        <div style={CARD}>
          <p style={{ textAlign: 'center', color: '#6B7280' }}>Checking…</p>
        </div>
      )}

      {(result.state === 'idle' || result.state === 'error' || result.state === 'not_found' || result.state === 'not_paid') && (
        <div style={CARD}>
          {result.state === 'not_found' && (
            <p style={{ background: '#FEF2F2', color: '#B91C1C', padding: '0.875rem 1rem', borderRadius: '0.625rem', fontSize: '0.9375rem', marginBottom: '1.5rem' }}>
              We couldn&apos;t find a registration with that email. Double-check you typed the exact email you registered with, or{' '}
              <a href="/elevation-summit#register" style={{ color: '#B91C1C', textDecoration: 'underline' }}>register for the Summit</a> first.
            </p>
          )}
          {result.state === 'not_paid' && (
            <p style={{ background: '#FFFBEB', color: '#92400E', padding: '0.875rem 1rem', borderRadius: '0.625rem', fontSize: '0.9375rem', marginBottom: '1.5rem' }}>
              Hi {result.fullName.split(' ')[0]} — we found your registration, but your payment isn&apos;t confirmed yet, so your spot isn&apos;t secured. Please{' '}
              <a href="/elevation-summit#register" style={{ color: '#92400E', textDecoration: 'underline' }}>complete your payment</a>{' '}
              to unlock the livestream, or contact us if you believe this is a mistake.
            </p>
          )}
          {result.state === 'error' && (
            <p style={{ background: '#FEF2F2', color: '#B91C1C', padding: '0.875rem 1rem', borderRadius: '0.625rem', fontSize: '0.9375rem', marginBottom: '1.5rem' }}>
              {result.message}
            </p>
          )}

          <p style={{ color: '#4B5563', fontSize: '0.9375rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
            Enter the email address you used to register for the Elevation Summit. If your virtual ticket is confirmed, you&apos;ll get instant access to the livestream.
          </p>
          <form onSubmit={submit}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#0F0F0E', marginBottom: '0.5rem' }}>Email address</label>
            <input
              type="email" required autoFocus value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ ...INPUT, marginBottom: '1rem' }}
              placeholder="your@email.com"
            />
            <button type="submit" className="btn-gold" style={{ width: '100%', justifyContent: 'center', fontSize: '1rem', padding: '0.875rem 1.5rem', border: 'none', cursor: 'pointer' }}>
              Verify &amp; watch →
            </button>
          </form>
        </div>
      )}

      {result.state === 'paid' && !result.streamEnabled && (
        <div style={CARD}>
          <p style={{ textAlign: 'center', fontSize: '1.0625rem', fontWeight: 600, color: '#0F0F0E', marginBottom: '0.75rem' }}>
            You&apos;re confirmed, {result.fullName.split(' ')[0]} 🎉
          </p>
          <p style={{ textAlign: 'center', color: '#6B7280', fontSize: '0.9375rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
            The livestream isn&apos;t live yet. It opens shortly before the programme starts on <strong>19 November 2026</strong>. Bookmark this page — it will remember you and show the stream automatically once it begins.
          </p>
          <button type="button" onClick={reset} style={{ display: 'block', margin: '0 auto', background: 'none', border: 'none', color: '#9CA3AF', fontSize: '0.8125rem', cursor: 'pointer', textDecoration: 'underline' }}>
            Not you? Use a different email
          </button>
        </div>
      )}

      {result.state === 'paid' && result.streamEnabled && (
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: '1.0625rem', fontWeight: 600, color: '#0F0F0E', marginBottom: '1.25rem' }}>
            Welcome, {result.fullName.split(' ')[0]} — enjoy the Summit.
          </p>
          <div style={{ position: 'relative', paddingTop: '56.25%', background: '#0F0F0E', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}>
            <iframe
              src={
                result.videoId
                  ? `https://www.youtube-nocookie.com/embed/${result.videoId}?autoplay=1&rel=0`
                  : `https://www.youtube-nocookie.com/embed/live_stream?channel=${result.channelId}&autoplay=1`
              }
              title="The Elevation Summit livestream"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
            />
          </div>
          <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '0.8125rem', marginTop: '1.25rem' }}>
            Video not loading? <a href={result.channelUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#6B7280', textDecoration: 'underline' }}>Open directly on YouTube</a>.
          </p>
        </div>
      )}
    </main>
  );
}
