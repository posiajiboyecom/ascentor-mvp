'use client';

import Link from 'next/link';
import { useState } from 'react';

// ─────────────────────────────────────────────────────────────
// LeadMagnetPage — shared component for all 3 lead magnet pages
// Usage: import and render with props
// ─────────────────────────────────────────────────────────────

interface Bullet {
  text: string;
}

interface LeadMagnetPageProps {
  magnetId: string;
  headline: string;           // bold first line
  subheadline: string;        // italic second line
  description: string;        // paragraph below
  bullets: Bullet[];          // what's inside
  ctaLabel: string;           // button text
  persona: string;            // e.g. "For: Builder · Climber stage professionals"
  type: string;               // e.g. "PDF Guide · 12 pages"
  successPath: string;        // where to redirect after opt-in
  accentColor?: string;
}

export default function LeadMagnetPage({
  magnetId,
  headline,
  subheadline,
  description,
  bullets,
  ctaLabel,
  persona,
  type,
  successPath,
  accentColor = '#E8A020',
}: LeadMagnetPageProps) {
  const [email, setEmail]     = useState('');
  const [name, setName]       = useState('');
  const [status, setStatus]   = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError]     = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    setError('');
    try {
      const res = await fetch('/api/lead-magnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          magnetId,
          email: email.trim().toLowerCase(),
          firstName: name.trim().split(' ')[0] || '',
          source: 'landing_page',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setStatus('done');
      // Redirect to download/confirmation page after 1.5s
      setTimeout(() => { window.location.href = successPath; }, 1500);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setStatus('error');
    }
  }

  const gold = accentColor;

  return (
    <div style={{ minHeight: '100vh', background: '#FAF7F2', fontFamily: "'Syne', system-ui, sans-serif" }}>

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(250,247,242,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(42,40,32,0.08)',
        padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/ascentor-color-for-light-pages.svg" alt="Ascentor" style={{ height: 28 }} />
        </Link>
        <Link href="/signup" style={{
          padding: '8px 18px', borderRadius: 8, background: gold, color: '#0C0B08',
          fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13,
          textDecoration: 'none',
        }}>
          Start Free →
        </Link>
      </nav>

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '64px 24px 80px', display: 'grid', gridTemplateColumns: '1fr 400px', gap: 64, alignItems: 'start' }}>

        {/* LEFT — Copy */}
        <div>
          {/* Type badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            <span style={{
              fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.12em',
              color: gold, background: `${gold}15`, border: `1px solid ${gold}30`,
              borderRadius: 100, padding: '4px 12px', textTransform: 'uppercase' as const,
            }}>{type}</span>
            <span style={{
              fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.08em',
              color: '#6B6456', background: 'rgba(42,40,32,0.06)',
              borderRadius: 100, padding: '4px 12px',
            }}>{persona}</span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 700, lineHeight: 1.1,
            color: '#0C0B08', marginBottom: 12,
          }}>
            {headline}
          </h1>
          <p style={{
            fontFamily: "'Syne', sans-serif", fontSize: 18, fontStyle: 'italic',
            color: gold, marginBottom: 20,
          }}>{subheadline}</p>
          <p style={{
            fontFamily: "'Syne', sans-serif", fontSize: 16, lineHeight: 1.8,
            color: '#4A4438', marginBottom: 32, maxWidth: 520,
          }}>{description}</p>

          {/* What's inside */}
          <div style={{ marginBottom: 40 }}>
            <p style={{
              fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.12em',
              color: '#7A7260', textTransform: 'uppercase' as const, marginBottom: 16,
            }}>What's inside</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bullets.map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%', background: `${gold}15`,
                    border: `1px solid ${gold}30`, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexShrink: 0, marginTop: 2,
                  }}>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke={gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, color: '#2A2820', lineHeight: 1.6 }}>
                    {b.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Social proof line */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex' }}>
              {['#E8A020','#C87020','#A85020'].map((c, i) => (
                <div key={i} style={{
                  width: 28, height: 28, borderRadius: '50%', background: c,
                  border: '2px solid #FAF7F2', marginLeft: i > 0 ? -8 : 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700, color: '#0C0B08',
                }}>
                  {['P','D','H'][i]}
                </div>
              ))}
            </div>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, color: '#7A7260', margin: 0 }}>
              Used by ambitious professionals building their career edge
            </p>
          </div>
        </div>

        {/* RIGHT — Form */}
        <div style={{
          background: '#FFFFFF', borderRadius: 20,
          border: '1px solid rgba(42,40,32,0.08)',
          boxShadow: '0 4px 40px rgba(42,40,32,0.06)',
          padding: 36, position: 'sticky', top: 100,
        }}>
          {status === 'done' ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: `${gold}15`, border: `2px solid ${gold}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l4 4 10-10" stroke={gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 24, fontWeight: 700, color: '#0C0B08', marginBottom: 8 }}>
                It's on its way
              </h3>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, color: '#6B6456' }}>
                Check your email — your free resource is being delivered now. Taking you to the download page...
              </p>
            </div>
          ) : (
            <>
              <h2 style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 26, fontWeight: 700, color: '#0C0B08', marginBottom: 6,
              }}>
                Get instant access
              </h2>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, color: '#7A7260', marginBottom: 24 }}>
                Free. No credit card. Delivered to your inbox immediately.
              </p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: '#7A7260', display: 'block', marginBottom: 6, textTransform: 'uppercase' as const }}>
                    First name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your first name"
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: 10,
                      border: '1px solid rgba(42,40,32,0.15)', background: '#FAF7F2',
                      fontFamily: "'Syne', sans-serif", fontSize: 14, color: '#0C0B08',
                      outline: 'none', boxSizing: 'border-box' as const,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: '#7A7260', display: 'block', marginBottom: 6, textTransform: 'uppercase' as const }}>
                    Email address *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: 10,
                      border: '1px solid rgba(42,40,32,0.15)', background: '#FAF7F2',
                      fontFamily: "'Syne', sans-serif", fontSize: 14, color: '#0C0B08',
                      outline: 'none', boxSizing: 'border-box' as const,
                    }}
                  />
                </div>

                {error && (
                  <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, color: '#EF4444', margin: 0 }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading' || !email.trim()}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 10,
                    background: status === 'loading' ? `${gold}80` : gold,
                    color: '#0C0B08', border: 'none',
                    fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700,
                    cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  {status === 'loading' ? 'Sending...' : ctaLabel}
                </button>

                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#9A9080', textAlign: 'center' as const, margin: 0, letterSpacing: '0.04em' }}>
                  No spam. Unsubscribe anytime. We respect your inbox.
                </p>
              </form>

              {/* Ascentor plug */}
              <div style={{
                marginTop: 24, paddingTop: 20,
                borderTop: '1px solid rgba(42,40,32,0.08)',
                textAlign: 'center' as const,
              }}>
                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, color: '#9A9080', marginBottom: 8 }}>
                  Want more than a guide?
                </p>
                <Link href="/signup" style={{
                  fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600,
                  color: gold, textDecoration: 'none',
                }}>
                  Try Sage free for 7 days →
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile responsive */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
          }
          div[style*="position: sticky; top: 100px"] {
            position: relative !important;
            top: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
