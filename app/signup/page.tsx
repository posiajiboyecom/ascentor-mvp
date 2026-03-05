'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PasswordInput from '@/components/PasswordInput';
import { OAuthButton } from '@/lib/sso';

// ─────────────────────────────────────────────────────────────────
// ASCENTOR BRAND TOKENS · Brand Book v1.0 · 2026
// Display : Cormorant Garamond 700 / Italic 600
// UI      : Syne 400–800
// Mono    : DM Mono 400/500
// Gold    : #E8A020   Dark: #0C0B08
// ─────────────────────────────────────────────────────────────────
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
  explorer:    '#14B8A6',   // Stage: Explorer (students 15–22)
  explorerMuted: 'rgba(20,184,166,0.09)',
  explorerBorder: 'rgba(20,184,166,0.22)',
};

// ── Shared CSS (identical structure to login for visual consistency) ──
const SHARED_CSS = `
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
  .asc-form-inner { width: 100%; max-width: 400px; }
  .asc-rule {
    height: 1px;
    background: linear-gradient(90deg, ${B.gold} 0%, transparent 70%);
    margin: 24px 0;
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
    font-weight: 400;
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
  .asc-divider { display: flex; align-items: center; gap: 16px; margin: 22px 0; }
  .asc-divider-line { flex: 1; height: 1px; background: ${B.border}; }
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
  .asc-oauth { display: flex; flex-direction: column; gap: 10px; }

  /* Stage progress dots — brand visual motif */
  .asc-stages { display: flex; align-items: center; gap: 8px; }
  .asc-stage-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
  }
  .asc-stage-label {
    font-family: ${B.fontMono};
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: ${B.dark500};
  }
`;

// ── Fallback loading screen — brand consistent ──
function BrandLoader() {
  return (
    <>
      <style>{SHARED_CSS}</style>
      <div className="asc-page" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <svg width="32" height="28" viewBox="0 0 32 28" fill="none" style={{ marginBottom: '16px' }}>
            <path d="M16 2L30 26H2L16 2Z" stroke={B.gold} strokeWidth="2" fill="none"/>
            <path d="M16 8L26 24H6L16 8Z" stroke={B.gold} strokeWidth="1" fill="none" opacity="0.5"/>
          </svg>
          <p style={{
            fontFamily:    B.fontMono,
            fontSize:      '11px',
            color:         B.dark500,
            letterSpacing: '0.06em',
            textTransform: 'uppercase' as const,
            margin:        0,
          }}>
            Loading…
          </p>
        </div>
      </div>
    </>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<BrandLoader />}>
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const router       = useRouter();
  const supabase     = createClient();
  const searchParams = useSearchParams();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  const refCode = searchParams.get('ref');
  const [referralCode, setReferralCode] = useState('');

  useEffect(() => {
    if (refCode) {
      localStorage.setItem('ascentor_referral', refCode.toUpperCase());
      setReferralCode(refCode.toUpperCase());
    } else {
      const stored = localStorage.getItem('ascentor_referral');
      if (stored) setReferralCode(stored);
    }
  }, [refCode]);

  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setError(error.message);
    } else {
      // Sync new user to MailerLite (fire-and-forget)
      const name = (data.user?.user_metadata?.full_name || email.split('@')[0]) as string;
      fetch('/api/welcome', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, name, userId: data.user?.id }),
      }).catch(() => {}); // non-blocking, non-fatal

      router.push('/checkout');
    }
    setLoading(false);
  }

  return (
    <>
      <style>{SHARED_CSS}</style>

      <div className="asc-page">

        {/* ── LEFT BRAND PANEL (lg+) ── */}
        <div className="asc-brand-panel">

          {/* Logo */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '48px' }}>
              <Link href="/" className="lp-nav-logo">
                <img
                  src="/ascentor-color-for-dark-pages.svg"
                  alt="Ascentor"
                  style={{ height: '32px', width: 'auto' }}
                />
              </Link>
            </div>

            {/* Brand headline — Cormorant italic */}
            <h2 style={{
              fontFamily: B.fontDisplay,
              fontStyle:  'italic',
              fontWeight: 600,
              fontSize:   '36px',
              color:      B.dark50,
              lineHeight: 1.25,
              margin:     '0 0 20px',
            }}>
              Stop figuring it out alone.
            </h2>

            <p style={{
              fontFamily: B.fontUI,
              fontSize:   '14px',
              color:      B.dark400,
              lineHeight: 1.7,
              margin:     '0 0 36px',
            }}>
              The professionals who make it in Africa rarely do it alone —
              they had the right mentor at the right time. We make that
              available to everyone.
            </p>

            {/* Stage system — brand visual motif from brand book pg 3 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { dot: '#14B8A6', label: 'Explorer', desc: 'Students 15–22' },
                { dot: '#E8A020', label: 'Builder',  desc: 'Early career 22–32' },
                { dot: '#8B5CF6', label: 'Climber',  desc: 'Mid-career 32–50' },
              ].map(({ dot, label, desc }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dot, flexShrink: 0 }} />
                  <span style={{ fontFamily: B.fontUI, fontSize: '13px', fontWeight: 500, color: B.dark200 }}>
                    {label}
                  </span>
                  <span style={{
                    fontFamily:    B.fontMono,
                    fontSize:      '10px',
                    color:         B.dark500,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase' as const,
                  }}>
                    · {desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom social proof — brand voice */}
          <div style={{ borderLeft: `3px solid ${B.gold}`, paddingLeft: '16px' }}>
            <p style={{
              fontFamily: B.fontDisplay,
              fontStyle:  'italic',
              fontWeight: 600,
              fontSize:   '16px',
              color:      B.dark200,
              lineHeight: 1.5,
              margin:     '0 0 8px',
            }}>
              "Your manager is not going to tell you what's holding you back. We will."
            </p>
            <span style={{
              fontFamily:    B.fontMono,
              fontSize:      '10px',
              color:         B.dark500,
              letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
            }}>
              ASCENTOR PROMISE
            </span>
          </div>
        </div>

        {/* ── RIGHT FORM PANEL ── */}
        <div className="asc-form-panel">
          <div className="asc-form-inner">

            {/* Mobile logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }} className="lg:hidden">
              <Link href="/" className="lp-nav-logo">
                <img
                  src="/ascentor-color-for-dark-pages.svg"
                  alt="Ascentor"
                  style={{ height: '32px', width: 'auto' }}
                />
              </Link>
            </div>

            {/* Referral banner — using Explorer teal (brand stage color) */}
            {referralCode && (
              <div style={{
                padding:      '14px 16px',
                borderRadius: '10px',
                background:   B.explorerMuted,
                border:       `1px solid ${B.explorerBorder}`,
                marginBottom: '24px',
                textAlign:    'center',
              }}>
                <p style={{
                  fontFamily: B.fontUI,
                  fontSize:   '13px',
                  fontWeight: 600,
                  color:      B.explorer,
                  margin:     '0 0 4px',
                }}>
                  🎁 You've been referred
                </p>
                <p style={{
                  fontFamily:    B.fontMono,
                  fontSize:      '11px',
                  color:         B.explorerBorder.replace('0.22', '0.6'),
                  letterSpacing: '0.04em',
                  margin:        0,
                }}>
                  Sign up — you both get 7 extra days free
                </p>
              </div>
            )}

            {/* Headline */}
            <h1 style={{
              fontFamily: B.fontDisplay,
              fontWeight: 700,
              fontSize:   'clamp(28px, 4vw, 36px)',
              color:      B.dark50,
              margin:     '0 0 6px',
              lineHeight: 1.15,
            }}>
              Join Ascentor.
            </h1>
            <p style={{
              fontFamily: B.fontUI,
              fontSize:   '14px',
              color:      B.dark400,
              margin:     '0 0 4px',
              lineHeight: 1.6,
            }}>
              Africa's mentorship platform — from figuring it out to making it happen.
            </p>

            {/* Gold rule */}
            <div className="asc-rule" />

            {/* OAuth */}
            <div className="asc-oauth">
              <OAuthButton provider="google"        onError={setError} />
              <OAuthButton provider="linkedin_oidc" onError={setError} />
            </div>

            {/* Divider */}
            <div className="asc-divider">
              <div className="asc-divider-line" />
              <span style={{
                fontFamily:    B.fontMono,
                fontSize:      '11px',
                fontWeight:    400,
                color:         B.dark500,
                letterSpacing: '0.04em',
                whiteSpace:    'nowrap' as const,
              }}>
                or sign up with email
              </span>
              <div className="asc-divider-line" />
            </div>

            {/* Email form */}
            <form onSubmit={handleEmailSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email address"
                className="asc-input"
              />

              <PasswordInput
                value={password}
                onChange={setPassword}
                showStrength={true}
                placeholder="Create a password"
              />

              {error && <div className="asc-error">{error}</div>}

              <button
                type="submit"
                disabled={loading}
                className="asc-btn-primary"
                style={{ marginTop: '4px' }}
              >
                {loading ? 'Creating account…' : 'Create Account →'}
              </button>
            </form>

            {/* Terms — brand legal tone: earned trust, precise */}
            <p style={{
              fontFamily: B.fontUI,
              fontSize:   '11px',
              color:      B.dark500,
              lineHeight: 1.6,
              textAlign:  'center',
              margin:     '14px 0 0',
            }}>
              By creating an account you agree to our{' '}
              <Link href="/terms" style={{ color: B.dark400, textDecoration: 'underline' }}>Terms</Link>
              {' '}and{' '}
              <Link href="/privacy" style={{ color: B.dark400, textDecoration: 'underline' }}>Privacy Policy</Link>.
            </p>

            {/* Login link */}
            <div style={{
              display:       'flex',
              justifyContent:'center',
              marginTop:     '28px',
              paddingTop:    '24px',
              borderTop:     `1px solid ${B.border}`,
            }}>
              <p style={{ fontFamily: B.fontUI, fontSize: '13px', color: B.dark400, margin: 0 }}>
                Already have an account?{' '}
                <Link href="/login" style={{ color: B.gold, fontWeight: 600, textDecoration: 'none' }}>
                  Log in →
                </Link>
              </p>
            </div>

            {/* Mono footer */}
            <div style={{ textAlign: 'center', marginTop: '32px' }}>
              <span style={{
                fontFamily:    B.fontMono,
                fontSize:      '10px',
                color:         B.dark600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
              }}>
                BUILT FOR AFRICA · © 2026 ASCENTOR INC. · ascentor.co
              </span>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
