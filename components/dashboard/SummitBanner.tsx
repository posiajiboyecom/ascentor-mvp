'use client';

// components/dashboard/SummitBanner.tsx
// The Elevation Summit card. Registration is free (one click, no payment);
// donating is an optional second action. On the day itself it points at the
// live stream.

import { useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, Heart } from 'lucide-react';

interface SummitBannerProps {
  daysAway: number;
  registered: boolean;
}

export function SummitBanner({ daysAway, registered: initialRegistered }: SummitBannerProps) {
  const [registered, setRegistered] = useState(initialRegistered);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister() {
    if (registered || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/summit/register-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok || res.status === 409) {
        setRegistered(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Something went wrong.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const live = daysAway === 0;

  return (
    <section
      aria-label="The Elevation Summit"
      className="rounded-2xl border border-[var(--app-border-gold)] bg-[var(--app-accent-soft)] p-5 lg:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="asc-eyebrow">The Elevation Summit</p>
          <p className="mt-1 font-[family-name:var(--font-editorial)] text-xl lg:text-2xl text-[var(--text)]">
            19 November 2026 · Lagos
          </p>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            {live ? 'It’s happening today.' : `${daysAway} day${daysAway === 1 ? '' : 's'} to go`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {live ? (
            <Link
              href="/elevation-summit/watch"
              className="rounded-full bg-[var(--app-accent)] px-5 py-2.5 text-sm font-semibold text-[#0F0F0E] hover:opacity-90"
            >
              Watch live →
            </Link>
          ) : registered ? (
            <Link
              href="/elevation-summit"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--app-border-gold)] bg-[var(--bg-card)] px-4 py-2.5 text-sm font-medium text-[var(--app-success-ink)]"
            >
              <Check className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
              You’re registered
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleRegister}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--app-accent)] px-5 py-2.5 text-sm font-semibold text-[#0F0F0E] hover:opacity-90 disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {loading ? 'Registering…' : 'Register free →'}
            </button>
          )}
          {!live && (
            <Link
              href="/donate"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-sm text-[var(--text-muted)] hover:bg-[var(--app-bg-hover)]"
            >
              <Heart className="w-4 h-4" aria-hidden="true" /> Donate
            </Link>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-[var(--error)]">
          {error}
        </p>
      )}
    </section>
  );
}
