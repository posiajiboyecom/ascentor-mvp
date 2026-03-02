import Link from 'next/link';

export default function NotFound() {
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
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>

        {/* 404 glyph */}
        <div style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 96, fontWeight: 700, lineHeight: 1,
          color: 'rgba(232,160,32,0.12)',
          marginBottom: 8,
          letterSpacing: '-4px',
        }}>
          404
        </div>

        <h1 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 30, fontWeight: 700,
          color: '#F1F0EB',
          marginBottom: 10, marginTop: 0,
        }}>
          Page not found
        </h1>

        <p style={{
          fontSize: 14, color: '#7A7260',
          lineHeight: 1.7, marginBottom: 32,
          maxWidth: 320, margin: '0 auto 32px',
        }}>
          The page you're looking for has moved, or may never have existed.
          Let's get you back on track.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/dashboard"
            style={{
              padding: '12px 24px', borderRadius: 10, border: 'none',
              background: '#E8A020', color: '#0C0B08',
              fontFamily: "'Syne', sans-serif",
              fontSize: 14, fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Go to Dashboard
          </Link>

          <Link
            href="/"
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
            Home
          </Link>
        </div>

        {/* Subtle pyramid mark */}
        <div style={{ marginTop: 48 }}>
          <svg width="24" height="20" viewBox="0 0 48 40" fill="none"
            style={{ opacity: 0.15 }}>
            <path d="M24 2L46 38H2L24 2Z" stroke="#E8A020" strokeWidth="2.5"
              strokeLinejoin="round" fill="none"/>
            <path d="M24 14L24 26M18 26H30" stroke="#E8A020" strokeWidth="2"
              strokeLinecap="round"/>
          </svg>
        </div>
      </div>
    </div>
  );
}
