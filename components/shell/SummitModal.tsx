'use client';

// A one-time invitation to The Elevation Summit, shown on the dashboard to members who have not
// registered. Dismissing or registering is remembered in this browser, so it never nags.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, MapPin, X } from 'lucide-react';
import { SUMMIT_DATE_LABEL, daysUntilSummit, hasSummitStarted } from '@/lib/elevationSummit';

const SEEN_KEY = 'ascentor:summit-invite-seen';

export default function SummitModal({ registered, userId }: { registered: boolean; userId: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const key = `${SEEN_KEY}:${userId}`;

  useEffect(() => {
    if (registered || pathname !== '/dashboard' || hasSummitStarted()) return;
    try { if (localStorage.getItem(key)) return; } catch { /* storage unavailable: show it once per visit */ }
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, [registered, pathname, key]);

  function close() {
    try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
    setOpen(false);
  }

  async function register() {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/summit/register-user', { method: 'POST' });
      if (!res.ok) throw new Error();
      setDone(true);
      try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
    } catch {
      setError('We could not register you just now. Please try again.');
    }
    setBusy(false);
  }

  if (!open) return null;
  const days = daysUntilSummit();

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="summit-modal-title"
      style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(15,15,14,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 440, background: '#FFFFFF', borderRadius: 16, padding: '28px 26px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <button type="button" onClick={close} aria-label="Close"
          style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 6 }}>
          <X size={18} aria-hidden="true" />
        </button>

        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A6A2B' }}>You are invited</p>
        <h2 id="summit-modal-title" style={{ margin: '8px 0 6px', fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: '#0F0F0E' }}>
          The Elevation Summit
        </h2>

        {done ? (
          <>
            <p style={{ fontSize: 15, color: '#4B5563', lineHeight: 1.6, margin: '0 0 20px' }}>
              You are registered. Your confirmation and ticket are on their way to your email.
            </p>
            <button type="button" onClick={() => setOpen(false)}
              style={{ width: '100%', padding: '0.85rem', borderRadius: 10, border: 'none', background: '#0F0F0E', color: '#FAFAF8', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              Done
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 15, color: '#4B5563', lineHeight: 1.6, margin: '0 0 14px' }}>
              A free event for people building lives and careers on purpose. Register with one click.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, fontSize: 14, color: '#374151' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><CalendarDays size={16} aria-hidden="true" /> {SUMMIT_DATE_LABEL}{days > 0 ? ` (${days} days away)` : ''}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><MapPin size={16} aria-hidden="true" /> Lagos, with a live stream for everyone else</span>
            </div>
            {error && <p role="alert" style={{ color: '#DC2626', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}
            <button type="button" onClick={register} disabled={busy}
              style={{ width: '100%', padding: '0.85rem', borderRadius: 10, border: 'none', background: '#0F0F0E', color: '#FAFAF8', fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Registering...' : 'Register free'}
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 13 }}>
              <Link href="/elevation-summit" onClick={close} style={{ color: '#8A6A2B', fontWeight: 600 }}>Learn more</Link>
              <button type="button" onClick={close} style={{ background: 'transparent', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 13 }}>Maybe later</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
