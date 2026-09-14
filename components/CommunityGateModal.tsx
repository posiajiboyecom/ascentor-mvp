'use client';

import { useState, useEffect } from 'react';

export default function CommunityGateModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener('community-gate', show);
    return () => window.removeEventListener('community-gate', show);
  }, []);

  if (!open) return null;

  return (
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
          Not Open Yet
        </h2>
        <p style={{ fontSize: '0.9375rem', color: '#6B7280', lineHeight: 1.7, margin: '0 0 1.75rem' }}>
          The Ascentor community platform is not yet open to the public. Join us at The Elevation Summit and be among the first to gain access when it launches.
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
  );
}
