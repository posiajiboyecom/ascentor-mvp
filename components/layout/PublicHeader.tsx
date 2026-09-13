'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type PublicHeaderProps = {
  hasBlogPosts?: boolean;
};

export default function PublicHeader({ hasBlogPosts = false }: PublicHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 860) setMobileMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const desktopLinks = (
    <>
      <Link href="/" className="ph-nav-link">Home</Link>
      <Link href="/movement" className="ph-nav-link">The Movement</Link>
      <Link href="/about" className="ph-nav-link">About</Link>
      <Link href="/elevation-summit" className="ph-nav-link">Events</Link>
      {hasBlogPosts && <Link href="/blog" className="ph-nav-link">Resources</Link>}
      <Link href="/contact" className="ph-nav-link">Contact</Link>
    </>
  );

  return (
    <>
      <style>{`
        .ph-nav-link {
          font-family: Metropolis;
          font-size: 0.9rem;
          font-weight: 500;
          color: #374151;
          text-decoration: none;
          transition: color 0.2s;
          white-space: nowrap;
        }
        .ph-nav-link:hover { color: #0F0F0E; }

        .ph-desktop-nav { display: none !important; }
        @media(min-width: 860px) { .ph-desktop-nav { display: flex !important; } }

        .ph-mobile-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: none;
          border: 1.5px solid #E8E6E1;
          border-radius: 8px;
          cursor: pointer;
          color: #374151;
          flex-direction: column;
          gap: 4px;
          padding: 0;
        }
        .ph-mobile-btn span {
          display: block;
          width: 16px;
          height: 1.5px;
          background: currentColor;
          border-radius: 2px;
          transition: all 0.2s;
        }
        @media(min-width: 860px) { .ph-mobile-btn { display: none !important; } }

        .ph-mobile-overlay {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: min(320px, 80vw);
          z-index: 100;
          background: rgba(250,250,248,0.98);
          backdrop-filter: blur(16px);
          box-shadow: -8px 0 32px rgba(0,0,0,0.08);
          padding: 80px 1.5rem 2rem;
          display: flex;
          flex-direction: column;
          gap: 0;
          pointer-events: none;
          transform: translateX(100%);
          transition: transform 0.3s ease;
        }
        .ph-mobile-overlay.ph-open {
          pointer-events: auto;
          transform: translateX(0);
        }
        .ph-mobile-link {
          display: block;
          padding: 1rem 0;
          border-bottom: 1px solid #E8E6E1;
          font-family: Metropolis;
          font-size: 1.125rem;
          font-weight: 600;
          color: #0F0F0E;
          text-decoration: none;
        }
        .ph-mobile-link:hover { color: #C8A96E; }
        .ph-mobile-cta {
          margin-top: 2rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .ph-cta-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.625rem 1.25rem;
          background: #0F0F0E;
          color: #FAFAF8;
          border-radius: 0.5rem;
          text-decoration: none;
          font-family: Metropolis;
          font-weight: 700;
          font-size: 0.875rem;
          transition: background 0.15s;
        }
        .ph-cta-btn:hover { background: #2A2A29; }
        .ph-mobile-logo { position: absolute; top: 1.5rem; left: 1.5rem; }
        .ph-mobile-backdrop {
          position: fixed;
          inset: 0;
          z-index: 40;
          background: rgba(0,0,0,0.25);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
        }
        .ph-mobile-backdrop.ph-open { opacity: 1; pointer-events: auto; }
        .ph-mobile-close {
          position: absolute;
          top: 1.5rem;
          right: 1.5rem;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: #E8E6E1;
          color: #0F0F0E;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s, color 0.2s, transform 0.2s;
          z-index: 101;
        }
        .ph-mobile-close:hover { background: #C8A96E; color: #FAFAF8; transform: scale(1.05); }

        .ph-scroll-top {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 90;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 1.5px solid #E8E6E1;
          background: #FFFFFF;
          color: #0F0F0E;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          opacity: 0;
          transform: translateY(8px);
          pointer-events: none;
          transition: opacity 0.2s, transform 0.2s, background 0.15s;
        }
        .ph-scroll-top.visible {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }
        .ph-scroll-top:hover { background: #0F0F0E; color: #FAFAF8; border-color: #0F0F0E; }
      `}</style>

      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: scrolled ? 'rgba(250,250,248,0.98)' : 'rgba(250,250,248,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #E8E6E1',
          transition: 'background 0.2s',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              height: '64px',
              position: 'relative',
            }}
          >
            <Link href="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
              <img
                src="/ascentor-color-for-light-pages.svg"
                alt="Ascentor"
                height={26}
                width={98}
                style={{ display: 'block' }}
              />
            </Link>

            <div
              className="ph-desktop-nav"
              style={{
                alignItems: 'center',
                gap: '2rem',
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
              }}
            >
              {desktopLinks}
            </div>

            <div className="ph-desktop-cta" style={{ marginLeft: 'auto', marginRight: '0.75rem' }}>
              <Link href="/signup" className="ph-cta-btn">
                Join Community
              </Link>
            </div>

            <button
              className="ph-mobile-btn"
              onClick={(e) => {
                e.stopPropagation();
                setMobileMenuOpen((o) => !o);
              }}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              <span style={{ transform: mobileMenuOpen ? 'rotate(45deg) translate(4px,4px)' : 'none' }} />
              <span style={{ opacity: mobileMenuOpen ? 0 : 1 }} />
              <span style={{ transform: mobileMenuOpen ? 'rotate(-45deg) translate(4px,-4px)' : 'none' }} />
            </button>
          </div>
        </div>
      </nav>

      <div
        className={`ph-mobile-backdrop${mobileMenuOpen ? ' ph-open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      />
      <div className={`ph-mobile-overlay${mobileMenuOpen ? ' ph-open' : ''}`}>
        <Link href="/" className="ph-mobile-logo" style={{ display: 'inline-block' }}>
          <img
            src="/ascentor-color-for-light-pages.svg"
            alt="Ascentor"
            height={28}
            width={104}
            style={{ display: 'block' }}
          />
        </Link>
        <button
          className="ph-mobile-close"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <Link href="/" className="ph-mobile-link" onClick={() => setMobileMenuOpen(false)}>
          Home
        </Link>
        <Link href="/movement" className="ph-mobile-link" onClick={() => setMobileMenuOpen(false)}>
          The Movement
        </Link>
        <Link href="/about" className="ph-mobile-link" onClick={() => setMobileMenuOpen(false)}>
          About
        </Link>
        <Link href="/elevation-summit" className="ph-mobile-link" onClick={() => setMobileMenuOpen(false)}>
          Events
        </Link>
        {hasBlogPosts && (
          <Link href="/blog" className="ph-mobile-link" onClick={() => setMobileMenuOpen(false)}>
            Resources
          </Link>
        )}
        <Link href="/contact" className="ph-mobile-link" onClick={() => setMobileMenuOpen(false)}>
          Contact
        </Link>

        <div className="ph-mobile-cta">
          <Link
            href="/login"
            className="ph-mobile-link"
            style={{ border: 'none', fontSize: '0.9375rem', color: '#6B7280' }}
            onClick={() => setMobileMenuOpen(false)}
          >
            Sign in
          </Link>
          <Link href="/signup" className="ph-cta-btn" onClick={() => setMobileMenuOpen(false)}>
            Join Community
          </Link>
        </div>
      </div>

      <ScrollToTop />
    </>
  );
}

function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const doc = document.documentElement.scrollHeight - window.innerHeight;
      const pct = doc > 0 ? (y / doc) * 100 : 0;
      setProgress(Math.min(100, Math.max(0, pct)));
      setVisible(y > 400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const r = 24;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - progress / 100);

  return (
    <button
      className={`ph-scroll-top${visible ? ' visible' : ''}`}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Scroll to top"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
      <svg
        width={52}
        height={52}
        viewBox="0 0 52 52"
        style={{
          position: 'absolute',
          top: -4,
          left: -4,
          pointerEvents: 'none',
          transform: 'rotate(-90deg)',
          transformOrigin: 'center',
        }}
      >
        <circle
          cx={26}
          cy={26}
          r={r}
          fill="none"
          stroke="#0F0F0E"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
    </button>
  );
}
