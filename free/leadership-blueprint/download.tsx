'use client';

import Link from 'next/link';

export default function BlueprintDownloadPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0C0C0A; }
        .dl-page {
          min-height: 100vh;
          background: #0C0C0A;
          color: #F0EDE6;
          font-family: 'DM Sans', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
        }
        .dl-card {
          max-width: 520px;
          width: 100%;
          text-align: center;
        }
        .dl-check {
          width: 64px; height: 64px;
          background: rgba(16,185,129,0.12);
          border: 1px solid rgba(16,185,129,0.25);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 28px;
          margin: 0 auto 32px;
        }
        .dl-h1 {
          font-family: 'Playfair Display', serif;
          font-size: 36px;
          font-weight: 900;
          line-height: 1.15;
          margin-bottom: 16px;
        }
        .dl-h1 em { color: #E8A020; font-style: italic; }
        .dl-sub {
          font-size: 16px;
          color: rgba(240,237,230,0.55);
          line-height: 1.7;
          margin-bottom: 40px;
        }
        .dl-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 16px 32px;
          background: #E8A020;
          border: none;
          border-radius: 6px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 600;
          color: #0C0C0A;
          cursor: pointer;
          text-decoration: none;
          margin-bottom: 40px;
          transition: background 0.15s;
        }
        .dl-btn:hover { background: #F5C55A; }
        .dl-note {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.1em;
          color: rgba(240,237,230,0.3);
          text-transform: uppercase;
          margin-bottom: 48px;
        }
        .dl-next-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.14em;
          color: rgba(240,237,230,0.3);
          text-transform: uppercase;
          margin-bottom: 20px;
        }
        .dl-next-card {
          background: rgba(240,237,230,0.04);
          border: 1px solid rgba(240,237,230,0.1);
          border-radius: 10px;
          padding: 24px;
          text-align: left;
        }
        .dl-next-title {
          font-family: 'Playfair Display', serif;
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 8px;
          color: #F0EDE6;
        }
        .dl-next-desc {
          font-size: 13px;
          color: rgba(240,237,230,0.5);
          line-height: 1.6;
          margin-bottom: 16px;
        }
        .dl-next-link {
          font-size: 13px;
          color: #E8A020;
          text-decoration: none;
          font-weight: 600;
        }
        .dl-next-link:hover { text-decoration: underline; }
      `}</style>

      <div className="dl-page">
        <div className="dl-card">
          <div className="dl-check">✓</div>
          <h1 className="dl-h1">Your <em>Blueprint</em><br />is on its way</h1>
          <p className="dl-sub">
            Check your inbox — it should arrive within 2 minutes.<br />
            Check spam if you don't see it.
          </p>

          {/* Direct download link — replace with actual PDF URL */}
          <a
            className="dl-btn"
            href={process.env.NEXT_PUBLIC_BLUEPRINT_PDF_URL || '/free/leadership-blueprint/blueprint.pdf'}
            download
            target="_blank"
            rel="noopener noreferrer"
          >
            📄 Download now (don't wait for email)
          </a>

          <p className="dl-note">Also sent to your inbox · Opens in browser if PDF viewer unavailable</p>

          <p className="dl-next-label">While you're here</p>
          <div className="dl-next-card">
            <div className="dl-next-title">Ready to go deeper?</div>
            <div className="dl-next-desc">
              Ascentor gives you an AI leadership coach trained on African business context — available 24/7, remembers your goals, challenges your thinking.
            </div>
            <Link href="/signup" className="dl-next-link">Start free → No credit card needed</Link>
          </div>
        </div>
      </div>
    </>
  );
}
