'use client';
import Link from 'next/link';

export default function ChallengeConfirmedPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F7F4EF; }
        .cc { min-height: 100vh; background: #F7F4EF; display: flex; align-items: center; justify-content: center; padding: 40px 24px; font-family: 'DM Sans', sans-serif; }
        .cc-card { max-width: 480px; width: 100%; text-align: center; }
        .cc-num { font-family: 'Syne', sans-serif; font-size: 120px; font-weight: 800; color: #E8A020; line-height: 1; margin-bottom: 16px; opacity: 0.15; }
        .cc-h1 { font-family: 'Syne', sans-serif; font-size: 36px; font-weight: 800; color: #1A1610; margin-bottom: 16px; line-height: 1.1; }
        .cc-sub { font-size: 16px; color: rgba(26,22,16,0.55); line-height: 1.7; margin-bottom: 40px; }
        .cc-box { background: #1A1610; border-radius: 12px; padding: 28px 32px; text-align: left; margin-bottom: 32px; }
        .cc-box-label { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.14em; color: #E8A020; text-transform: uppercase; margin-bottom: 12px; }
        .cc-box-text { font-size: 14px; color: rgba(240,237,230,0.6); line-height: 1.7; }
        .cc-link { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: #E8A020; text-decoration: none; font-weight: 600; }
        .cc-link:hover { text-decoration: underline; }
      `}</style>
      <div className="cc">
        <div className="cc-card">
          <div className="cc-num">1</div>
          <h1 className="cc-h1">Day 1 is on its way.</h1>
          <p className="cc-sub">
            Check your inbox — your first leadership exercise arrives in the next few minutes.<br />
            See you tomorrow for Day 2.
          </p>
          <div className="cc-box">
            <div className="cc-box-label">What happens next</div>
            <div className="cc-box-text">
              Every morning for 30 days, you'll get a short, focused leadership exercise.
              Each one takes under 10 minutes. By Day 30 you'll have a complete 90-day leadership plan.
            </div>
          </div>
          <Link href="/signup" className="cc-link">
            Want more? Try Ascentor free →
          </Link>
        </div>
      </div>
    </>
  );
}
