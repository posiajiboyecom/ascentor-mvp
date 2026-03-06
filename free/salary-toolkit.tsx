'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SalaryToolkitPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError('Enter your email to get the toolkit.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/lead-magnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          magnetId:  'salary-toolkit',
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

  const includes = [
    { icon: '📝', title: 'Scripts', desc: 'Word-for-word openers for Lagos, Nairobi, Accra, Jo\'burg' },
    { icon: '📧', title: 'Email templates', desc: 'Offer negotiation, counter-offers, equity conversations' },
    { icon: '🎯', title: 'Prep framework', desc: 'BATNA calculator + market rate research method' },
    { icon: '📊', title: 'Benchmarks', desc: 'Salary ranges by role, city, and sector in Africa' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .st-page {
          min-height: 100vh;
          background: #FAFAF8;
          color: #111;
          font-family: 'Inter', sans-serif;
          padding: 80px 24px;
        }
        .st-inner {
          max-width: 1040px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: 80px;
          align-items: start;
        }
        @media (max-width: 880px) {
          .st-inner { grid-template-columns: 1fr; gap: 48px; }
        }

        /* Top bar */
        .st-nav {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.12em;
          color: rgba(17,17,17,0.35);
          text-transform: uppercase;
          margin-bottom: 64px;
          display: flex; gap: 8px; align-items: center;
          grid-column: 1 / -1;
        }
        .st-nav a { color: #111; text-decoration: none; font-weight: 500; }

        /* Left */
        .st-tag {
          display: inline-block;
          background: #111;
          color: #FAFAF8;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          padding: 5px 12px;
          border-radius: 3px;
          margin-bottom: 28px;
        }
        .st-h1 {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(42px, 5vw, 68px);
          font-weight: 700;
          line-height: 1.0;
          color: #111;
          margin-bottom: 12px;
        }
        .st-h1 em { font-style: italic; color: #C4860A; }
        .st-sub {
          font-size: 17px;
          color: rgba(17,17,17,0.55);
          line-height: 1.75;
          margin-bottom: 52px;
          max-width: 500px;
        }
        .st-includes-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(17,17,17,0.35);
          margin-bottom: 20px;
        }
        .st-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 52px;
        }
        @media (max-width: 600px) { .st-grid { grid-template-columns: 1fr; } }
        .st-item {
          border: 1px solid rgba(17,17,17,0.1);
          border-radius: 8px;
          padding: 20px;
          background: #fff;
        }
        .st-item-icon { font-size: 22px; margin-bottom: 10px; }
        .st-item-title { font-size: 14px; font-weight: 600; color: #111; margin-bottom: 6px; }
        .st-item-desc { font-size: 12px; color: rgba(17,17,17,0.5); line-height: 1.5; }
        .st-linkedin {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          background: #EBF5FB;
          border: 1px solid #BDD9EB;
          border-radius: 8px;
          padding: 20px;
        }
        .st-li-icon { font-size: 20px; flex-shrink: 0; }
        .st-li-text { font-size: 13px; color: rgba(17,17,17,0.65); line-height: 1.6; }
        .st-li-text strong { color: #111; }

        /* Right — form */
        .st-form-wrap {
          position: sticky;
          top: 40px;
        }
        .st-form-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(17,17,17,0.4);
          margin-bottom: 20px;
        }
        .st-form-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 28px;
          font-weight: 700;
          line-height: 1.2;
          color: #111;
          margin-bottom: 8px;
        }
        .st-form-sub {
          font-size: 13px;
          color: rgba(17,17,17,0.5);
          line-height: 1.6;
          margin-bottom: 28px;
        }
        .st-fields { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
        .st-input {
          width: 100%;
          background: #fff;
          border: 1px solid rgba(17,17,17,0.15);
          border-radius: 6px;
          padding: 13px 16px;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          color: #111;
          outline: none;
          transition: border-color 0.15s;
        }
        .st-input::placeholder { color: rgba(17,17,17,0.3); }
        .st-input:focus { border-color: #C4860A; }
        .st-btn {
          width: 100%;
          padding: 15px;
          background: #111;
          border: none;
          border-radius: 6px;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 600;
          color: #FAFAF8;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
          letter-spacing: 0.01em;
        }
        .st-btn:hover:not(:disabled) { background: #333; transform: translateY(-1px); }
        .st-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .st-error { font-size: 12px; color: #DC2626; padding: 8px 12px; background: rgba(220,38,38,0.06); border: 1px solid rgba(220,38,38,0.15); border-radius: 5px; }
        .st-privacy { font-size: 11px; color: rgba(17,17,17,0.35); text-align: center; line-height: 1.6; margin-top: 12px; }
        .st-divider { height: 1px; background: rgba(17,17,17,0.08); margin: 28px 0; }
        .st-trust { display: flex; align-items: center; gap: 10px; font-size: 12px; color: rgba(17,17,17,0.45); }
        .st-trust-dot { width: 6px; height: 6px; border-radius: 50%; background: #10B981; flex-shrink: 0; }
      `}</style>

      <div className="st-page">
        <div className="st-inner">
          <div className="st-nav" style={{ gridColumn: '1 / -1' }}>
            <Link href="/">Ascentor</Link>
            <span>→</span>
            <span>Free Toolkit</span>
          </div>

          {/* Left */}
          <div>
            <div className="st-tag">Template Pack — Free Download</div>
            <h1 className="st-h1">
              The African<br />
              Professional<br />
              <em>Salary Toolkit</em>
            </h1>
            <p className="st-sub">
              Scripts, templates, and frameworks built specifically for salary negotiations
              across Nigeria, Ghana, Kenya, and South Africa. Stop leaving money on the table.
            </p>

            <div className="st-includes-label">What's inside</div>
            <div className="st-grid">
              {includes.map((item, i) => (
                <div key={i} className="st-item">
                  <div className="st-item-icon">{item.icon}</div>
                  <div className="st-item-title">{item.title}</div>
                  <div className="st-item-desc">{item.desc}</div>
                </div>
              ))}
            </div>

            <div className="st-linkedin">
              <div className="st-li-icon">💼</div>
              <div className="st-li-text">
                <strong>High LinkedIn share potential.</strong> The salary benchmarks alone get shared constantly —
                professionals tag colleagues, recruiters save it, HR managers screenshot it.
                Download it, use it, share it.
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="st-form-wrap">
            <div className="st-form-label">Get your free copy</div>
            <div className="st-form-title">Download the<br />Salary Toolkit</div>
            <div className="st-form-sub">
              Instant access. No upsell. Just the toolkit.
            </div>

            <form className="st-fields" onSubmit={handleSubmit}>
              <input
                className="st-input"
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
              />
              <input
                className="st-input"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              {error && <div className="st-error">{error}</div>}
              <button className="st-btn" type="submit" disabled={loading}>
                {loading ? 'Preparing your download…' : 'Get the Toolkit →'}
              </button>
            </form>

            <p className="st-privacy">Free · Instant download · Unsubscribe any time</p>

            <div className="st-divider" />
            <div className="st-trust">
              <div className="st-trust-dot" />
              Used by professionals across 12 African countries
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
