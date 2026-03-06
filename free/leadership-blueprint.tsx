'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LeadershipBlueprintPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError('Enter your email to get the guide.'); return; }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/lead-magnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          magnetId:  'leadership-blueprint',
          email,
          firstName,
          source:    new URLSearchParams(window.location.search).get('utm_source') || 'direct',
        }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(data.redirectUrl);
      } else {
        setError(data.error || 'Something went wrong. Try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .lb-page {
          min-height: 100vh;
          background: #0C0C0A;
          color: #F0EDE6;
          font-family: 'DM Sans', sans-serif;
          display: grid;
          grid-template-columns: 1fr 1fr;
          overflow: hidden;
        }
        @media (max-width: 860px) {
          .lb-page { grid-template-columns: 1fr; }
          .lb-left { display: none; }
        }

        /* ── Left panel ── */
        .lb-left {
          background: #1A1610;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 60px 52px;
          overflow: hidden;
        }
        .lb-left-bg {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 20% 80%, rgba(232,160,32,0.12) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 80% 20%, rgba(180,120,20,0.07) 0%, transparent 50%);
        }
        .lb-cover {
          position: relative;
          background: linear-gradient(145deg, #2A2010 0%, #1A1610 100%);
          border: 1px solid rgba(232,160,32,0.2);
          border-radius: 4px;
          padding: 40px 36px;
          margin-bottom: 48px;
          box-shadow: 0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(232,160,32,0.08);
        }
        .lb-cover-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.18em;
          color: #E8A020;
          text-transform: uppercase;
          margin-bottom: 24px;
        }
        .lb-cover-title {
          font-family: 'Playfair Display', serif;
          font-size: 30px;
          font-weight: 900;
          line-height: 1.15;
          color: #F0EDE6;
          margin-bottom: 20px;
        }
        .lb-cover-title em { color: #E8A020; font-style: italic; }
        .lb-cover-line { width: 40px; height: 2px; background: #E8A020; margin-bottom: 20px; }
        .lb-cover-sub {
          font-size: 13px;
          color: rgba(240,237,230,0.55);
          line-height: 1.7;
        }
        .lb-proof {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .lb-proof-item {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }
        .lb-proof-icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(232,160,32,0.12);
          border: 1px solid rgba(232,160,32,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
        }
        .lb-proof-text {
          font-size: 13px;
          color: rgba(240,237,230,0.65);
          line-height: 1.6;
          padding-top: 4px;
        }
        .lb-proof-text strong { color: #F0EDE6; font-weight: 600; }

        /* ── Right panel ── */
        .lb-right {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 60px 52px;
          max-width: 560px;
          margin: 0 auto;
          width: 100%;
        }
        .lb-nav {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.12em;
          color: rgba(240,237,230,0.35);
          text-transform: uppercase;
          margin-bottom: 52px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .lb-nav a { color: #E8A020; text-decoration: none; }
        .lb-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(232,160,32,0.1);
          border: 1px solid rgba(232,160,32,0.22);
          border-radius: 4px;
          padding: 5px 12px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.14em;
          color: #E8A020;
          text-transform: uppercase;
          margin-bottom: 24px;
        }
        .lb-h1 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(32px, 4vw, 48px);
          font-weight: 900;
          line-height: 1.1;
          color: #F0EDE6;
          margin-bottom: 8px;
        }
        .lb-h1 em { color: #E8A020; font-style: italic; }
        .lb-sub {
          font-size: 16px;
          color: rgba(240,237,230,0.55);
          line-height: 1.7;
          margin-bottom: 40px;
        }

        /* form */
        .lb-form { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
        .lb-input {
          width: 100%;
          background: rgba(240,237,230,0.05);
          border: 1px solid rgba(240,237,230,0.12);
          border-radius: 6px;
          padding: 14px 18px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          color: #F0EDE6;
          outline: none;
          transition: border-color 0.15s;
        }
        .lb-input::placeholder { color: rgba(240,237,230,0.3); }
        .lb-input:focus { border-color: rgba(232,160,32,0.5); }
        .lb-btn {
          width: 100%;
          padding: 16px;
          background: #E8A020;
          border: none;
          border-radius: 6px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 600;
          color: #0C0C0A;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
          letter-spacing: 0.01em;
        }
        .lb-btn:hover:not(:disabled) { background: #F5C55A; transform: translateY(-1px); }
        .lb-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .lb-error {
          font-size: 13px;
          color: #F87171;
          padding: 10px 14px;
          background: rgba(248,113,113,0.08);
          border: 1px solid rgba(248,113,113,0.2);
          border-radius: 5px;
        }
        .lb-privacy {
          font-size: 12px;
          color: rgba(240,237,230,0.3);
          text-align: center;
          line-height: 1.6;
        }
        .lb-divider {
          display: flex;
          align-items: center;
          gap: 16px;
          margin: 32px 0;
        }
        .lb-divider-line { flex: 1; height: 1px; background: rgba(240,237,230,0.08); }
        .lb-divider-text {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.12em;
          color: rgba(240,237,230,0.25);
          text-transform: uppercase;
        }
        .lb-what {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .lb-what-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          font-size: 13px;
          color: rgba(240,237,230,0.6);
          line-height: 1.5;
        }
        .lb-what-item::before {
          content: '→';
          color: #E8A020;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          padding-top: 1px;
          flex-shrink: 0;
        }
      `}</style>

      <div className="lb-page">
        {/* Left — visual */}
        <div className="lb-left">
          <div className="lb-left-bg" />
          <div className="lb-cover">
            <div className="lb-cover-label">Free PDF Guide — 10 Pages</div>
            <div className="lb-cover-title">
              The African<br />
              Leadership<br />
              <em>Blueprint</em>
            </div>
            <div className="lb-cover-line" />
            <div className="lb-cover-sub">
              7 frameworks used by Africa's top CEOs.<br />
              Built with Claude in 2 hours.
            </div>
          </div>
          <div className="lb-proof">
            <div className="lb-proof-item">
              <div className="lb-proof-icon">📋</div>
              <div className="lb-proof-text"><strong>10-page PDF</strong> you can read in one sitting and apply the same week</div>
            </div>
            <div className="lb-proof-item">
              <div className="lb-proof-icon">🌍</div>
              <div className="lb-proof-text"><strong>African context</strong> — not recycled Western advice repackaged for the continent</div>
            </div>
            <div className="lb-proof-item">
              <div className="lb-proof-icon">⚡</div>
              <div className="lb-proof-text"><strong>7 actionable frameworks</strong> covering influence, trust, execution, and visibility</div>
            </div>
          </div>
        </div>

        {/* Right — form */}
        <div className="lb-right">
          <div className="lb-nav">
            <Link href="/">Ascentor</Link>
            <span>→</span>
            <span>Free Resources</span>
          </div>

          <div className="lb-badge">
            <span>📄</span> Free PDF — Instant Download
          </div>

          <h1 className="lb-h1">
            Get the <em>Blueprint</em><br />
            Africa's top leaders<br />
            actually use
          </h1>
          <p className="lb-sub">
            10 pages. 7 frameworks. Zero fluff.<br />
            Drop your email and it lands in your inbox in 60 seconds.
          </p>

          <form className="lb-form" onSubmit={handleSubmit}>
            <input
              className="lb-input"
              type="text"
              placeholder="First name"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
            />
            <input
              className="lb-input"
              type="email"
              placeholder="Work email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            {error && <div className="lb-error">{error}</div>}
            <button className="lb-btn" type="submit" disabled={loading}>
              {loading ? 'Sending your copy…' : 'Send me the Blueprint →'}
            </button>
          </form>

          <p className="lb-privacy">
            No spam. Unsubscribe any time.<br />
            You'll also get our weekly leadership letter for African professionals.
          </p>

          <div className="lb-divider">
            <div className="lb-divider-line" />
            <div className="lb-divider-text">What's inside</div>
            <div className="lb-divider-line" />
          </div>

          <div className="lb-what">
            {[
              'How Africa\'s best leaders build influence without formal authority',
              'The trust-building framework that works in high-context cultures',
              'Why Western "authentic leadership" advice backfires — and what to do instead',
              'Execution systems for when resources are limited and stakes are high',
              'How to build visibility across Lagos, Nairobi, Accra, and Johannesburg',
            ].map((item, i) => (
              <div key={i} className="lb-what-item">{item}</div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
