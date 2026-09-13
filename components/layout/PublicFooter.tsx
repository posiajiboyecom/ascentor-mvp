'use client';

import Link from 'next/link';

type PublicFooterProps = {
  hasBlogPosts?: boolean;
};

export default function PublicFooter({ hasBlogPosts = false }: PublicFooterProps) {
  return (
    <>
      <style>{`
        .pf-link {
          color: #6B7280;
          text-decoration: none;
          font-size: 0.875rem;
          transition: color 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }
        .pf-link:hover { color: #E8A020 !important; text-decoration: underline; }
        .pf-social {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          color: #6B7280;
          transition: color 0.2s, background 0.2s, transform 0.15s;
          text-decoration: none;
        }
        .pf-social:hover {
          color: #C8A96E;
          background: rgba(200,169,110,0.10);
          transform: translateY(-2px);
        }
        .pf-contact-icon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          opacity: 0.7;
        }
        @media (max-width: 640px) {
          .pf-bottom {
            flex-direction: column;
            justify-content: center !important;
            text-align: center;
          }
          .pf-bottom-links { justify-content: center; }
        }
      `}</style>

      <footer
        style={{
          background: '#FAFAF8',
          borderTop: '1px solid #E8E6E1',
          padding: '3rem 1.5rem 2rem',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '2rem',
              marginBottom: '3rem',
            }}
          >
            {/* Brand */}
            <div>
              <img
                src="/ascentor-color-for-light-pages.svg"
                alt="Ascentor"
                height={26}
                width={98}
                style={{ display: 'block', marginBottom: '0.75rem' }}
              />
              <p style={{ fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.6, marginBottom: '1rem' }}>
                The official platform of The Elevation Summit movement.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a href="https://x.com/joinascentor" target="_blank" rel="noopener noreferrer" className="pf-social" aria-label="X / Twitter">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4l11.733 16h4.267l-11.733 -16z"/><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"/></svg>
                </a>
                <a href="https://linkedin.com/company/joinascentor" target="_blank" rel="noopener noreferrer" className="pf-social" aria-label="LinkedIn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                </a>
                <a href="https://instagram.com/joinascentor" target="_blank" rel="noopener noreferrer" className="pf-social" aria-label="Instagram">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                </a>
              </div>
            </div>

            {/* The Movement */}
            <div>
              <h4
                style={{
                  fontFamily: 'Metropolis',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  color: '#0F0F0E',
                  marginBottom: '1rem',
                }}
              >
                The Movement
              </h4>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <Link href="/movement" className="pf-link">
                  Our Ideology
                </Link>
                <Link href="/movement#total-person" className="pf-link">
                  The Total Person
                </Link>
                <Link href="/about" className="pf-link">
                  About Ascentor
                </Link>
              </nav>
            </div>

            {/* Community */}
            <div>
              <h4
                style={{
                  fontFamily: 'Metropolis',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  color: '#0F0F0E',
                  marginBottom: '1rem',
                }}
              >
                Community
              </h4>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <Link href="/signup" className="pf-link">
                  Join Free
                </Link>
                <Link href="/community" className="pf-link">
                  The Circle
                </Link>
                {hasBlogPosts && (
                  <Link href="/blog" className="pf-link">
                    Resources
                  </Link>
                )}
                <Link href="/products" className="pf-link">
                  Products
                </Link>
                <Link href="/newsletter" className="pf-link">
                  Newsletter
                </Link>
                <Link href="/contact" className="pf-link">
                  Contact
                </Link>
              </nav>
            </div>

            {/* Contact */}
            <div>
              <h4
                style={{
                  fontFamily: 'Metropolis',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  color: '#0F0F0E',
                  marginBottom: '1rem',
                }}
              >
                Contact
              </h4>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <a href="mailto:hello@ascentorbi.com" className="pf-link">
                  <svg className="pf-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4L12 13 2 4"/></svg>
                  hello@ascentorbi.com
                </a>
                <a href="tel:+2348168692012" className="pf-link">
                  <svg className="pf-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  +234 816 869 2012
                </a>
                <span className="pf-link" style={{ cursor: 'default' }}>
                  <svg className="pf-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  Lekki, Lagos, Nigeria
                </span>
              </nav>
            </div>

            {/* The Elevation Summit CTA */}
            <div>
              <h4
                style={{
                  fontFamily: 'Metropolis',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  color: '#0F0F0E',
                  marginBottom: '1rem',
                }}
              >
                The Elevation Summit
              </h4>
              <p style={{ fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.6, marginBottom: '1rem' }}>
                A global gathering for purposeful individuals building lives of meaning, leadership, and lasting impact.
              </p>
              <Link href="/elevation-summit#register" className="btn-gold">
                Register Now
              </Link>
            </div>
          </div>

          {/* Footer Bottom */}
          <div
            className="pf-bottom"
            style={{
              borderTop: '1px solid #E8E6E1',
              paddingTop: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <p style={{ fontSize: '0.8125rem', color: '#6B7280' }}>
              © 2026 Ascentor. All rights reserved.
            </p>

            <div className="pf-bottom-links" style={{ display: 'flex', gap: '1.5rem' }}>
              <Link href="/terms" className="pf-link">
                Terms & Conditions
              </Link>
              <Link href="/privacy" className="pf-link">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}