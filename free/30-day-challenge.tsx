'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ChallengeOptInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError('Enter your email to join the challenge.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/lead-magnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          magnetId:  '30-day-challenge',
          email,
          firstName,
          source:    new URLSearchParams(window.location.search).get('utm_source') || 'direct',
        }),
      });
      const data = await res.json();
      if (data.success) router.push(data.redirectUrl);
      else setError(data.error || 'Something went wrong.');
    } catch { setError('Network error. Try again.'); }
    setLoading(false);
  }

  const days = [
    { n: 1,  title: 'Define your leadership identity' },
    { n: 7,  title: 'Build your first influence map' },
    { n: 14, title: 'Navigate a real conflict' },
    { n: 21, title: 'Lead without authority' },
    { n: 30, title: 'Your 90-day leadership plan' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ch-page {
          min-height: 100vh;
          background: #F7F4EF;
          color: #1A1610;
          font-family: 'DM Sans', sans-serif;
          position: relative;
          overflow-x: hidden;
        }

        /* Decorative stripe */
        .ch-stripe {
          position: fixed;
          top: 0; left: 0;
          width: 6px;
          height: 100vh;
          background: #E8A020;
          z-index: 10;
        }

        .ch-inner {
          max-width: 1100px;
          margin: 0 auto;
          padding: 60px 60px 80px 80px;
          display: grid;
          grid-template-columns: 1fr 420px;
          gap: 80px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .ch-inner { grid-template-columns: 1fr; padding: 50px 32px 60px 44px; gap: 48px; }
        }

        /* Left */
        .ch-nav {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.12em;
          color: rgba(26,22,16,0.35);
          text-transform: uppercase;
          margin-bottom: 48px;
          display: flex; gap: 8px; align-items: center;
        }
        .ch-nav a { color: #E8A020; text-decoration: none; }
        .ch-eyebrow {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.16em;
          color: #E8A020;
          text-transform: uppercase;
          margin-bottom: 20px;
        }
        .ch-h1 {
          font-family: 'Syne', sans-serif;
          font-size: clamp(38px, 5vw, 64px);
          font-weight: 800;
          line-height: 1.05;
          color: #1A1610;
          margin-bottom: 24px;
        }
        .ch-h1 span { color: #E8A020; }
        .ch-desc {
          font-size: 17px;
          color: rgba(26,22,16,0.6);
          line-height: 1.75;
          margin-bottom: 48px;
          max-width: 520px;
        }
        .ch-stats {
          display: flex;
          gap: 32px;
          margin-bottom: 52px;
          flex-wrap: wrap;
        }
        .ch-stat-num {
          font-family: 'Syne', sans-serif;
          font-size: 36px;
          font-weight: 800;
          color: #1A1610;
          line-height: 1;
        }
        .ch-stat-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.1em;
          color: rgba(26,22,16,0.4);
          text-transform: uppercase;
          margin-top: 4px;
        }
        .ch-stat-divider { width: 1px; background: rgba(26,22,16,0.12); align-self: stretch; }

        /* Timeline */
        .ch-timeline-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(26,22,16,0.35);
          margin-bottom: 20px;
        }
        .ch-timeline { display: flex; flex-direction: column; gap: 0; position: relative; }
        .ch-timeline::before {
          content: '';
          position: absolute;
          left: 14px; top: 14px; bottom: 14px;
          width: 1px;
          background: rgba(232,160,32,0.25);
        }
        .ch-day {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 0;
        }
        .ch-day-circle {
          width: 28px; height: 28px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid rgba(232,160,32,0.4);
          display: flex; align-items: center; justify-content: center;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          font-weight: 500;
          color: #E8A020;
          flex-shrink: 0;
          position: relative;
          z-index: 1;
        }
        .ch-day-title {
          font-size: 14px;
          color: rgba(26,22,16,0.65);
          line-height: 1.4;
        }

        /* Right — form card */
        .ch-card {
          background: #1A1610;
          border-radius: 16px;
          padding: 40px 36px;
          position: sticky;
          top: 40px;
          box-shadow: 0 24px 64px rgba(26,22,16,0.15);
        }
        .ch-card-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(232,160,32,0.12);
          border: 1px solid rgba(232,160,32,0.2);
          border-radius: 4px;
          padding: 4px 12px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.12em;
          color: #E8A020;
          text-transform: uppercase;
          margin-bottom: 20px;
        }
        .ch-card-title {
          font-family: 'Syne', sans-serif;
          font-size: 22px;
          font-weight: 800;
          color: #F0EDE6;
          line-height: 1.25;
          margin-bottom: 8px;
        }
        .ch-card-sub {
          font-size: 13px;
          color: rgba(240,237,230,0.45);
          line-height: 1.6;
          margin-bottom: 28px;
        }
        .ch-form { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
        .ch-input {
          width: 100%;
          background: rgba(240,237,230,0.06);
          border: 1px solid rgba(240,237,230,0.1);
          border-radius: 6px;
          padding: 13px 16px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: #F0EDE6;
          outline: none;
          transition: border-color 0.15s;
        }
        .ch-input::placeholder { color: rgba(240,237,230,0.25); }
        .ch-input:focus { border-color: rgba(232,160,32,0.45); }
        .ch-btn {
          width: 100%;
          padding: 15px;
          background: #E8A020;
          border: none;
          border-radius: 6px;
          font-family: 'Syne', sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: #1A1610;
          cursor: pointer;
          transition: background 0.15s;
          letter-spacing: 0.02em;
        }
        .ch-btn:hover:not(:disabled) { background: #F5C55A; }
        .ch-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ch-error {
          font-size: 12px; color: #F87171;
          padding: 8px 12px;
          background: rgba(248,113,113,0.08);
          border: 1px solid rgba(248,113,113,0.2);
          border-radius: 5px;
        }
        .ch-card-privacy {
          font-size: 11px;
          color: rgba(240,237,230,0.25);
          text-align: center;
          line-height: 1.6;
          margin-bottom: 24px;
        }
        .ch-card-divider { height: 1px; background: rgba(240,237,230,0.08); margin-bottom: 20px; }
        .ch-card-includes-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(240,237,230,0.25);
          margin-bottom: 12px;
        }
        .ch-include {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 12px;
          color: rgba(240,237,230,0.5);
          line-height: 1.5;
          margin-bottom: 8px;
        }
        .ch-include-dot {
          width: 4px; height: 4px;
          border-radius: 50%;
          background: #E8A020;
          flex-shrink: 0;
          margin-top: 6px;
        }
      `}</style>

      <div className="ch-page">
        <div className="ch-stripe" />
        <div className="ch-inner">
          {/* Left */}
          <div>
            <div className="ch-nav">
              <Link href="/">Ascentor</Link>
              <span>→</span>
              <span>Free Resources</span>
            </div>

            <div className="ch-eyebrow">📧 Free 30-Day Email Series</div>
            <h1 className="ch-h1">
              Become a better<br />
              leader in <span>30 days</span>.<br />
              One email at a time.
            </h1>
            <p className="ch-desc">
              Every day for 30 days, you get one short leadership exercise
              designed for African professionals. Takes 10 minutes. Builds habits that compound.
            </p>

            <div className="ch-stats">
              <div>
                <div className="ch-stat-num">30</div>
                <div className="ch-stat-label">Daily exercises</div>
              </div>
              <div className="ch-stat-divider" />
              <div>
                <div className="ch-stat-num">10m</div>
                <div className="ch-stat-label">Per day max</div>
              </div>
              <div className="ch-stat-divider" />
              <div>
                <div className="ch-stat-num">0</div>
                <div className="ch-stat-label">Cost — free</div>
              </div>
            </div>

            <div className="ch-timeline-label">Sample milestones</div>
            <div className="ch-timeline">
              {days.map(d => (
                <div key={d.n} className="ch-day">
                  <div className="ch-day-circle">{d.n}</div>
                  <div className="ch-day-title">{d.title}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — card */}
          <div className="ch-card">
            <div className="ch-card-badge">✉️ Start Day 1 Today</div>
            <div className="ch-card-title">Join the 30-Day<br />Leadership Challenge</div>
            <div className="ch-card-sub">
              Your first email arrives within 60 seconds of signing up.
            </div>

            <form className="ch-form" onSubmit={handleSubmit}>
              <input
                className="ch-input"
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
              />
              <input
                className="ch-input"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              {error && <div className="ch-error">{error}</div>}
              <button className="ch-btn" type="submit" disabled={loading}>
                {loading ? 'Signing you up…' : 'Start the Challenge →'}
              </button>
            </form>

            <p className="ch-card-privacy">
              Free forever · Unsubscribe any time<br />
              No spam. Just your daily exercise.
            </p>

            <div className="ch-card-divider" />
            <div className="ch-card-includes-label">What you get</div>
            {[
              '30 daily leadership exercises — one email per day',
              'Each exercise takes under 10 minutes',
              'Rooted in African professional contexts',
              'Builds habit + proves value before we ever ask for payment',
            ].map((item, i) => (
              <div key={i} className="ch-include">
                <div className="ch-include-dot" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
