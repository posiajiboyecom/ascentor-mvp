'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const B = {
  fontDisplay: "'Cormorant Garamond', Georgia, serif",
  fontUI:      "'Syne', system-ui, sans-serif",
  fontMono:    "'DM Mono', 'Courier New', monospace",
  dark:        '#0C0B08',
  dark700:     '#1E1C17',
  dark600:     '#2E2A22',
  dark500:     '#4A4438',
  dark400:     '#7A7260',
  dark200:     '#D4CFC3',
  dark50:      '#F7F6F3',
  gold:        '#E8A020',
  gold600:     '#C87820',
  goldMuted:   'rgba(232,160,32,0.10)',
  goldBorder:  'rgba(232,160,32,0.25)',
  border:      'rgba(212,207,195,0.10)',
  error:       '#EF4444',
  errorMuted:  'rgba(239,68,68,0.08)',
  success:     '#22C55E',
  successMuted:'rgba(34,197,94,0.08)',
};

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email,   setEmail]   = useState('');
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; }

        .asc-page {
          min-height: 100vh;
          display: flex;
          background: ${B.dark};
          font-family: ${B.fontUI};
          position: relative;
          overflow: hidden;
        }
        .asc-page::before {
          content: '';
          position: fixed;
          top: -20vh; left: 50%;
          transform: translateX(-50%);
          width: 600px; height: 600px;
          background: radial-gradient(ellipse at center, rgba(232,160,32,0.07) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        .asc-brand-panel {
          display: none;
          width: 420px;
          flex-shrink: 0;
          background: ${B.dark700};
          border-right: 1px solid ${B.border};
          padding: 60px 48px;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
        }
        .asc-brand-panel::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 50%;
          background: linear-gradient(to top, rgba(232,160,32,0.04), transparent);
          pointer-events: none;
        }
        @media (min-width: 1024px) { .asc-brand-panel { display: flex; } }

        .asc-form-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          position: relative;
          z-index: 1;
        }
        .asc-form-inner {
          width: 100%;
          max-width: 400px;
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .asc-rule {
          height: 1px;
          background: linear-gradient(90deg, ${B.gold} 0%, transparent 70%);
          margin: 28px 0;
        }
        .asc-input {
          width: 100%;
          padding: 13px 16px;
          border-radius: 10px;
          border: 1px solid ${B.border};
          background: ${B.dark700};
          color: ${B.dark50};
          font-family: ${B.fontUI};
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .asc-input::placeholder { color: ${B.dark500}; }
        .asc-input:focus        { border-color: ${B.goldBorder}; }

        .asc-btn-primary {
          width: 100%;
          padding: 14px 24px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          background: ${B.gold};
          color: ${B.dark};
          font-family: ${B.fontUI};
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.02em;
          transition: background 0.15s ease, opacity 0.15s ease;
        }
        .asc-btn-primary:hover:not(:disabled) { background: ${B.gold600}; }
        .asc-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .asc-error {
          padding: 10px 14px;
          border-radius: 8px;
          background: ${B.errorMuted};
          border: 1px solid rgba(239,68,68,0.2);
          color: ${B.error};
          font-family: ${B.fontUI};
          font-size: 13px;
          line-height: 1.5;
          margin-bottom: 12px;
        }
        .asc-success {
          padding: 14px 16px;
          border-radius: 10px;
          background: ${B.successMuted};
          border: 1px solid rgba(34,197,94,0.2);
          color: ${B.success};
          font-family: ${B.fontUI};
          font-size: 13px;
          line-height: 1.6;
        }
      `}</style>

      <div className="asc-page">

        {/* ── LEFT BRAND PANEL ── */}
        <div className="asc-brand-panel">
          <div>
            <div style={{ marginBottom: '48px' }}>
              <Link href="/">
                <img src="/ascentor-color-for-dark-pages.svg" alt="Ascentor" style={{ height: '32px', width: 'auto' }} />
              </Link>
            </div>
            <h2 style={{ fontFamily: B.fontDisplay, fontStyle: 'italic', fontWeight: 600, fontSize: '36px', color: B.dark50, lineHeight: 1.25, margin: '0 0 20px' }}>
              Everyone who made it had someone.
            </h2>
            <p style={{ fontFamily: B.fontUI, fontSize: '14px', color: B.dark400, lineHeight: 1.7, margin: 0 }}>
              Africa's mentorship platform — AI guidance, human expertise,
              and peer accountability built for your reality.
            </p>
          </div>
          <div style={{ borderLeft: `3px solid ${B.gold}`, paddingLeft: '16px' }}>
            <p style={{ fontFamily: B.fontDisplay, fontStyle: 'italic', fontWeight: 600, fontSize: '16px', color: B.dark200, lineHeight: 1.5, margin: '0 0 8px' }}>
              "I went from stuck to promoted in 90 days. The mentor saw what I couldn't."
            </p>
            <span style={{ fontFamily: B.fontMono, fontSize: '10px', color: B.dark500, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              BUILDER · LAGOS · FINTECH
            </span>
          </div>
        </div>

        {/* ── RIGHT FORM PANEL ── */}
        <div className="asc-form-panel">
          <div className="asc-form-inner">

            {/* Mobile logo */}
            <div style={{ marginBottom: '36px' }} className="lg:hidden">
              <Link href="/">
                <img src="/ascentor-color-for-dark-pages.svg" alt="Ascentor" style={{ height: '32px', width: 'auto' }} />
              </Link>
            </div>

            <h1 style={{ fontFamily: B.fontDisplay, fontWeight: 700, fontSize: 'clamp(28px, 4vw, 36px)', color: B.dark50, margin: '0 0 6px', lineHeight: 1.15 }}>
              Reset your password.
            </h1>
            <p style={{ fontFamily: B.fontUI, fontSize: '14px', color: B.dark400, margin: '0 0 28px', lineHeight: 1.6 }}>
              Enter your email and we'll send you a reset link.
            </p>

            <div className="asc-rule" />

            {success ? (
              <div className="asc-success">
                ✓ Check your inbox — a reset link is on its way to <strong>{email}</strong>.
                <br /><br />
                The link expires in 1 hour. Check your spam folder if you don't see it.
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="asc-input"
                  autoFocus
                />

                {error && <div className="asc-error">{error}</div>}

                <button type="submit" disabled={loading} className="asc-btn-primary" style={{ marginTop: '4px' }}>
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            )}

            {/* Back to login */}
            <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '24px', borderTop: `1px solid ${B.border}` }}>
              <Link href="/login" style={{ fontFamily: B.fontUI, fontSize: '13px', color: B.dark400, textDecoration: 'none' }}>
                ← Back to login
              </Link>
            </div>

            <div style={{ textAlign: 'center', marginTop: '32px' }}>
              <span style={{ fontFamily: B.fontMono, fontSize: '10px', color: B.dark600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                ASCENTOR · BUILT FOR AFRICA · 2026
              </span>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
