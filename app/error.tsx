'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console in dev; swap for Sentry etc. in prod
    console.error('[Ascentor Error]', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0C0B08',
      fontFamily: "'Syne', system-ui, sans-serif",
      padding: '24px',
    }}>
      <div style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>

        {/* Icon */}
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
          fontSize: 28,
        }}>⚠️</div>

        {/* Heading */}
        <h1 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 28, fontWeight: 700,
          color: '#F1F0EB',
          marginBottom: 10,
        }}>
          Something went wrong
        </h1>

        <p style={{
          fontSize: 14, color: '#7A7260',
          lineHeight: 1.7, marginBottom: 28,
        }}>
          An unexpected error occurred. Your data is safe — please try again
          or return to your dashboard.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={reset}
            style={{
              padding: '12px 24px', borderRadius: 10, border: 'none',
              background: '#E8A020', color: '#0C0B08',
              fontFamily: "'Syne', sans-serif",
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Try Again
          </button>

          <a
            href="/dashboard"
            style={{
              padding: '12px 24px', borderRadius: 10,
              border: '1px solid #2E2A22',
              color: '#D4CFC3', background: 'transparent',
              fontFamily: "'Syne', sans-serif",
              fontSize: 14, fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Dashboard
          </a>
        </div>

        {/* Error digest for support */}
        {error.digest && (
          <p style={{
            marginTop: 24,
            fontFamily: "'DM Mono', monospace",
            fontSize: 10, color: '#4A4438',
            letterSpacing: '0.08em',
          }}>
            REF: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
