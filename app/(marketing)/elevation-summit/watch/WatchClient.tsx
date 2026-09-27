'use client';

// Public livestream gate for The Elevation Summit.
// Enter the email you registered with. If it belongs to a PAID registration,
// you get a countdown until the programme starts, then the embedded stream on
// the day itself. No password: this mirrors how every other Summit
// confirmation already works (email-only), for a conference livestream rather
// than a login system.
//
// Anti-sharing note (see the admin page and README for the full picture): a
// plain YouTube embed cannot be made fully un-shareable, since YouTube's own
// player always keeps its own menu and a technically inclined visitor can
// always find the video id in the page source. What this page DOES do:
// disables text selection, copying and the right-click menu on the page
// itself; strips YouTube's related-video and branding chrome; and never sends
// the video id to the browser until the exact minute the programme starts, so
// it cannot be discovered in advance by inspecting the page or the API.
import { useEffect, useState, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { watchFormSchema, type WatchFormValues } from './watchFormSchema';
import { SUMMIT_DATETIME_LABEL, SUMMIT_DATE_LABEL } from '@/lib/elevationSummit';
import '@/styles/marketing.css';

type Result =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'checking' }
  | { state: 'not_found' }
  | { state: 'not_paid'; fullName: string }
  | { state: 'paid'; fullName: string; eventStarted: false; startsAt: string }
  | { state: 'paid'; fullName: string; eventStarted: true; streamEnabled: boolean; videoId: string | null; channelId: string; channelUrl: string }
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

const ERROR_TEXT = {
  fontSize: '0.8125rem',
  color: '#DC2626',
  marginTop: '0.375rem',
};

const CARD: React.CSSProperties = {
  maxWidth: '640px', margin: '0 auto', background: '#FFFFFF',
  border: '1px solid #E8E6E1', borderRadius: '1.25rem',
  padding: 'clamp(1.75rem, 5vw, 2.75rem)', boxShadow: '0 24px 60px rgba(0,0,0,0.06)',
};

function timeParts(msRemaining: number) {
  const total = Math.max(0, msRemaining);
  return {
    days: Math.floor(total / 86_400_000),
    hours: Math.floor((total / 3_600_000) % 24),
    minutes: Math.floor((total / 60_000) % 60),
    seconds: Math.floor((total / 1_000) % 60),
  };
}

function Countdown({ startsAt }: { startsAt: string }) {
  const target = new Date(startsAt).getTime();
  const [now, setNow] = useState<number | null>(null);

  // Compute only after mount: server-rendered and client-rendered "now" differ,
  // which would otherwise trigger a hydration mismatch.
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const parts = timeParts(target - (now ?? target));
  const units: [string, number][] = [['Days', parts.days], ['Hours', parts.hours], ['Minutes', parts.minutes], ['Seconds', parts.seconds]];

  return (
    <div
      aria-live="polite"
      aria-label={now === null ? 'Loading countdown' : `${parts.days} days, ${parts.hours} hours, ${parts.minutes} minutes, ${parts.seconds} seconds until the livestream opens`}
      style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}
    >
      {units.map(([label, value]) => (
        <div key={label} style={{ background: '#FAFAF8', border: '1px solid #E8E6E1', borderRadius: '0.75rem', padding: '0.875rem 0.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', fontWeight: 700, color: '#0F0F0E', fontVariantNumeric: 'tabular-nums' }}>
            {now === null ? '--' : String(value).padStart(2, '0')}
          </div>
          <div style={{ fontSize: '0.6875rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', marginTop: '0.25rem' }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

export default function WatchClient() {
  const [result, setResult] = useState<Result>({ state: 'loading' });
  const verifiedEmail = useRef<string | null>(null);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<WatchFormValues>({
    resolver: zodResolver(watchFormSchema),
    defaultValues: { email: '' },
  });

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
        const errBody = await res.json().catch(() => ({}));
        setResult({ state: 'error', message: errBody.error || 'Too many attempts. Please wait a few minutes and try again.' });
        return;
      }
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setResult({ state: 'error', message: errBody.error || 'Something went wrong. Please try again.' });
        return;
      }
      const data = await res.json();
      if (data.state === 'anonymous') { setResult({ state: 'idle' }); return; }
      if (candidateEmail) verifiedEmail.current = candidateEmail;
      setResult(data);
    } catch {
      setResult({ state: 'error', message: 'Could not reach the server. Check your connection and try again.' });
    }
  }, []);

  // On load, silently try the convenience cookie from a previous visit.
  useEffect(() => { check(); }, [check]);

  // Re-check automatically: once the countdown reaches zero, and while waiting
  // for the admin's final go-live flip on the day itself. No polling at all
  // outside these two narrow windows.
  useEffect(() => {
    if (result.state !== 'paid') return;
    const email = verifiedEmail.current;
    if (!email) return;

    if (!result.eventStarted) {
      const msLeft = new Date(result.startsAt).getTime() - Date.now();
      const delay = Math.max(1000, Math.min(msLeft, 5000));
      const id = setTimeout(() => check(email), delay);
      return () => clearTimeout(id);
    }
    if (result.eventStarted && !result.streamEnabled) {
      const id = setInterval(() => check(email), 20_000);
      return () => clearInterval(id);
    }
  }, [result, check]);

  const onSubmit = (values: WatchFormValues) => check(values.email);

  const useDifferentEmail = () => { verifiedEmail.current = null; reset(); setResult({ state: 'idle' }); };

  const noCopy: React.CSSProperties = { userSelect: 'none', WebkitUserSelect: 'none' };
  const blockCopy = { onContextMenu: (e: React.MouseEvent) => e.preventDefault(), onCopy: (e: React.ClipboardEvent) => e.preventDefault() };

  return (
    <main style={{ background: '#FAFAF8', minHeight: '100vh', padding: 'clamp(3rem, 8vw, 6rem) 1.5rem' }} {...blockCopy}>
      <div style={{ maxWidth: '720px', margin: '0 auto 2.5rem', textAlign: 'center', ...noCopy }}>
        <img src="/ascentor-color-for-light-pages.svg" alt="Ascentor" style={{ height: 28, width: 'auto', margin: '0 auto 1.5rem', display: 'block' }} />
        <div className="mkt-gold-bar" style={{ margin: '0 auto 1.25rem' }} />
        <p className="mkt-eyebrow" style={{ marginBottom: '0.75rem' }}>The Elevation Summit &middot; {SUMMIT_DATE_LABEL}</p>
        <h1 className="mkt-section-headline" style={{ color: '#0F0F0E', fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}>
          Watch the livestream
        </h1>
      </div>

      {(result.state === 'loading' || result.state === 'checking') && (
        <div style={CARD}>
          <p style={{ textAlign: 'center', color: '#6B7280', ...noCopy }}>Checking...</p>
        </div>
      )}

      {(result.state === 'idle' || result.state === 'error' || result.state === 'not_found' || result.state === 'not_paid') && (
        <div style={CARD}>
          {result.state === 'not_found' && (
            <p style={{ background: '#FEF2F2', color: '#B91C1C', padding: '0.875rem 1rem', borderRadius: '0.625rem', fontSize: '0.9375rem', marginBottom: '1.5rem' }}>
              We could not find a registration with that email. Double check you typed the exact email you registered with, or{' '}
              <a href="/elevation-summit#register" style={{ color: '#B91C1C', textDecoration: 'underline' }}>register for the Summit</a> first.
            </p>
          )}
          {result.state === 'not_paid' && (
            <p style={{ background: '#FFFBEB', color: '#92400E', padding: '0.875rem 1rem', borderRadius: '0.625rem', fontSize: '0.9375rem', marginBottom: '1.5rem' }}>
              Hi {result.fullName.split(' ')[0]}, we found your registration, but your ticket is not confirmed yet, so your spot is not secured. Please{' '}
              <a href="/elevation-summit#register" style={{ color: '#92400E', textDecoration: 'underline' }}>secure your ticket</a>{' '}
              to unlock the livestream, or contact us if you believe this is a mistake.
            </p>
          )}
          {result.state === 'error' && (
            <p style={{ background: '#FEF2F2', color: '#B91C1C', padding: '0.875rem 1rem', borderRadius: '0.625rem', fontSize: '0.9375rem', marginBottom: '1.5rem' }}>
              {result.message}
            </p>
          )}

          <p style={{ color: '#4B5563', fontSize: '0.9375rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
            Enter the email address you used to register for the Elevation Summit. If your virtual ticket is confirmed, you will get access to the livestream on {SUMMIT_DATETIME_LABEL}.
          </p>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#0F0F0E', marginBottom: '0.5rem' }}>Email address</label>
            <input
              type="email" autoFocus autoComplete="email"
              {...register('email')}
              style={INPUT}
              placeholder="your@email.com"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'watch-email-error' : undefined}
            />
            {errors.email && <p id="watch-email-error" style={ERROR_TEXT}>{errors.email.message}</p>}
            <button type="submit" className="btn-gold" style={{ width: '100%', justifyContent: 'center', fontSize: '1rem', padding: '0.875rem 1.5rem', border: 'none', cursor: 'pointer', marginTop: '1.25rem' }}>
              Verify and watch &rarr;
            </button>
          </form>
        </div>
      )}

      {result.state === 'paid' && !result.eventStarted && (
        <div style={{ ...CARD, ...noCopy }}>
          <p style={{ textAlign: 'center', fontSize: '1.0625rem', fontWeight: 600, color: '#0F0F0E', marginBottom: '1.5rem' }}>
            You are confirmed, {result.fullName.split(' ')[0]}.
          </p>
          <Countdown startsAt={result.startsAt} />
          <p style={{ textAlign: 'center', color: '#6B7280', fontSize: '0.9375rem', lineHeight: 1.7, marginTop: '1.5rem', marginBottom: 0 }}>
            The livestream opens on <strong>{SUMMIT_DATETIME_LABEL}</strong>. This page checks itself automatically, so there is nothing else for you to do until then. Feel free to close it and come back on the day.
          </p>
          <button type="button" onClick={useDifferentEmail} style={{ display: 'block', margin: '2rem auto 0', background: 'none', border: 'none', color: '#9CA3AF', fontSize: '0.8125rem', cursor: 'pointer', textDecoration: 'underline' }}>
            Not you? Use a different email
          </button>
        </div>
      )}

      {result.state === 'paid' && result.eventStarted && !result.streamEnabled && (
        <div style={{ ...CARD, ...noCopy }}>
          <p style={{ textAlign: 'center', fontSize: '1.0625rem', fontWeight: 600, color: '#0F0F0E', marginBottom: '0.75rem' }}>
            You are confirmed, {result.fullName.split(' ')[0]}.
          </p>
          <p style={{ textAlign: 'center', color: '#6B7280', fontSize: '0.9375rem', lineHeight: 1.7 }}>
            Today is the day. The stream is starting shortly, please stay on this page. It will begin automatically.
          </p>
        </div>
      )}

      {result.state === 'paid' && result.eventStarted && result.streamEnabled && (
        <div style={{ maxWidth: '960px', margin: '0 auto', ...noCopy }}>
          <p style={{ textAlign: 'center', fontSize: '1.0625rem', fontWeight: 600, color: '#0F0F0E', marginBottom: '1.25rem' }}>
            Welcome, {result.fullName.split(' ')[0]}. Enjoy the Summit.
          </p>
          <div style={{ position: 'relative', paddingTop: '56.25%', background: '#0F0F0E', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}>
            <iframe
              src={
                (result.videoId
                  ? `https://www.youtube-nocookie.com/embed/${result.videoId}`
                  : `https://www.youtube-nocookie.com/embed/live_stream?channel=${result.channelId}`
                ) + '?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1'
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
