'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

// Inner component can safely call useSearchParams()
function GateWatcher({ onOpen }: { onOpen: () => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (searchParams.get('gate') === '1') {
      onOpen();
      const params = new URLSearchParams(searchParams.toString());
      params.delete('gate');
      const clean = params.toString() ? `${pathname}?${params}` : pathname;
      router.replace(clean, { scroll: false });
    }
  }, [searchParams, pathname, router, onOpen]);

  return null;
}

export default function CommunityGateModal() {
  const [open, setOpen] = useState(false);

  // Listen for programmatic event (from GateButton and other onClick triggers)
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener('community-gate', show);
    return () => window.removeEventListener('community-gate', show);
  }, []);

  return (
    <>
      {/* URL watcher — detects ?gate=1 and opens modal directly (no event timing issue) */}
      <Suspense fallback={null}>
        <GateWatcher onOpen={() => setOpen(true)} />
      </Suspense>

      {!open ? null : (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(15,15,14,0.72)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '1.25rem',
          padding: '2.5rem 2rem',
          maxWidth: '420px',
          width: '100%',
          boxShadow: '0 24px 64px rgba(15,15,14,0.2)',
          textAlign: 'center',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F4F3EF', margin: '0 auto 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C8A96E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, color: '#0F0F0E', margin: '0 0 0.75rem' }}>
          Something&apos;s Coming
        </h2>
        <p style={{ fontSize: '0.9375rem', color: '#6B7280', lineHeight: 1.7, margin: '0 0 1.75rem' }}>
          The Ascentor community platform isn&apos;t live yet, but it&apos;s close. Be at The Elevation Summit and you&apos;ll be among the first through the door when we open.
        </p>
        <button
          onClick={() => setOpen(false)}
          style={{
            display: 'inline-block',
            padding: '0.75rem 2rem',
            background: '#0F0F0E',
            color: '#FFFFFF',
            borderRadius: '0.625rem',
            fontWeight: 600,
            fontSize: '0.9375rem',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Got It
        </button>
      </div>
    </div>
      )}
    </>
  );
}
