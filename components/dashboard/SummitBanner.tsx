'use client';

// components/dashboard/SummitBanner.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Dashboard banner for The Elevation Summit.
// When the user is NOT registered → shows "Register →" button that registers
// them in one click (POST /api/summit/register-user) and fires a real-time
// in-app notification via the existing NotificationProvider.
// When registered → shows "You're registered ✓" with a link to the full page.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import Link from 'next/link';
import { Check, Loader2 } from 'lucide-react';

interface SummitBannerProps {
  daysAway: number;
  registered: boolean;
}

export function SummitBanner({ daysAway, registered: initialRegistered }: SummitBannerProps) {
  const [registered, setRegistered]   = useState(initialRegistered);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  async function handleRegister(e: React.MouseEvent) {
    e.preventDefault();
    if (registered || loading) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/summit/register-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        setRegistered(true);
      } else {
        const data = await res.json().catch(() => ({}));
        // 409 = already registered server-side — treat as success
        if (res.status === 409) {
          setRegistered(true);
        } else {
          setError(data.error || 'Something went wrong.');
        }
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl lg:rounded-2xl border border-[#C8A96E]/20 bg-[#0F0F0E] px-[13px] py-[11px] lg:px-7 lg:py-6">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[8px] lg:text-[11px] font-medium uppercase tracking-[0.1em] text-[#C8A96E] mb-0.5 lg:mb-1.5">
            The Elevation Summit
          </p>
          <p className="text-xs lg:text-2xl font-medium text-[#FAFAF8] lg:font-serif truncate lg:overflow-visible">
            February 2027 · Lagos, Nigeria
          </p>
          <p className="hidden lg:block text-sm text-[#6B7280] mt-1">
            {daysAway} days away
          </p>
        </div>

        {registered ? (
          // ── Registered state ──────────────────────────────────────────────
          <Link
            href="/elevation-summit"
            className="
              shrink-0 flex items-center gap-1.5 whitespace-nowrap rounded-lg lg:rounded-full
              border border-[#C8A96E]/30 text-[#C8A96E]
              px-2.5 py-[5px] lg:px-5 lg:py-2.5
              text-[10px] lg:text-sm font-medium
              transition-colors hover:bg-[#C8A96E]/10
            "
          >
            <Check className="w-3 h-3 lg:w-3.5 lg:h-3.5" strokeWidth={2.5} />
            <span>Registered</span>
          </Link>
        ) : (
          // ── Register button ───────────────────────────────────────────────
          <button
            type="button"
            onClick={handleRegister}
            disabled={loading}
            className="
              shrink-0 whitespace-nowrap rounded-lg lg:rounded-full
              bg-[#C8A96E] text-[#0F0F0E]
              px-2.5 py-[5px] lg:px-6 lg:py-3
              text-[10px] lg:text-sm font-medium
              transition-opacity disabled:opacity-60
              flex items-center gap-1.5
            "
          >
            {loading ? (
              <>
                <Loader2 className="w-3 h-3 lg:w-3.5 lg:h-3.5 animate-spin" />
                <span className="hidden lg:inline">Registering…</span>
                <span className="lg:hidden">…</span>
              </>
            ) : (
              'Register →'
            )}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 text-[10px] lg:text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
