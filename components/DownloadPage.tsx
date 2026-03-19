'use client';

import Link from 'next/link';

interface DownloadPageProps {
  title: string;
  downloadUrl: string;       // Supabase public URL for the PDF
  fileName: string;
  nextStep: string;
  nextStepLink: string;
  nextStepLabel: string;
}

export default function DownloadPage({
  title,
  downloadUrl,
  fileName,
  nextStep,
  nextStepLink,
  nextStepLabel,
}: DownloadPageProps) {
  const gold = '#E8A020';

  return (
    <div style={{ minHeight: '100vh', background: '#FAF7F2', fontFamily: "'Syne', system-ui, sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>

      <Link href="/" style={{ marginBottom: 48, display: 'block' }}>
        <img src="/ascentor-color-for-light-pages.svg" alt="Ascentor" style={{ height: 32 }} />
      </Link>

      <div style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>

        {/* Success icon */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: `${gold}15`, border: `2px solid ${gold}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M5 12l4 4 10-10" stroke={gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <h1 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 36, fontWeight: 700, color: '#0C0B08', marginBottom: 12,
        }}>
          Your resource is ready
        </h1>

        <p style={{
          fontFamily: "'Syne', sans-serif", fontSize: 16, color: '#4A4438',
          lineHeight: 1.7, marginBottom: 32,
        }}>
          {title} has been sent to your inbox. You can also download it directly below.
        </p>

        {/* Download button */}
        <a
          href={downloadUrl}
          download={fileName}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '14px 28px', borderRadius: 12,
            background: gold, color: '#0C0B08',
            fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700,
            textDecoration: 'none', marginBottom: 40,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Download PDF
        </a>

        {/* Divider */}
        <div style={{ borderTop: '1px solid rgba(42,40,32,0.1)', paddingTop: 32, marginBottom: 32 }}>
          <p style={{
            fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.12em',
            color: '#9A9080', textTransform: 'uppercase', marginBottom: 12,
          }}>
            What's next
          </p>
          <p style={{
            fontFamily: "'Syne', sans-serif", fontSize: 15, color: '#4A4438',
            lineHeight: 1.7, marginBottom: 20,
          }}>
            {nextStep}
          </p>
          <Link href={nextStepLink} style={{
            display: 'inline-block', padding: '12px 24px', borderRadius: 10,
            border: `1px solid ${gold}40`, background: `${gold}08`,
            color: '#0C0B08', fontFamily: "'Syne', sans-serif",
            fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}>
            {nextStepLabel}
          </Link>
        </div>

        {/* Sage prompt */}
        <div style={{
          background: '#FFFFFF', borderRadius: 16,
          border: '1px solid rgba(42,40,32,0.08)',
          padding: '24px', textAlign: 'left',
        }}>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: gold, marginBottom: 10 }}>
            TRY THIS IN SAGE
          </p>
          <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, color: '#4A4438', lineHeight: 1.7, marginBottom: 12 }}>
            Open Ascentor and ask Sage: <em style={{ color: '#0C0B08' }}>"I just downloaded {title}. Help me apply it to my specific situation."</em>
          </p>
          <Link href="/signup" style={{
            fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600,
            color: gold, textDecoration: 'none',
          }}>
            Start free with Sage →
          </Link>
        </div>

      </div>
    </div>
  );
}
