'use client';
import Link from 'next/link';

export default function SalaryToolkitDownloadPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,700;1,600&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #FAFAF8; }
        .sd { min-height: 100vh; background: #FAFAF8; display: flex; align-items: center; justify-content: center; padding: 40px 24px; font-family: 'Inter', sans-serif; }
        .sd-card { max-width: 500px; width: 100%; }
        .sd-tag { display: inline-block; background: #111; color: #FAFAF8; font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; padding: 4px 12px; border-radius: 3px; margin-bottom: 24px; }
        .sd-h1 { font-family: 'Cormorant Garamond', serif; font-size: 42px; font-weight: 700; line-height: 1.1; color: #111; margin-bottom: 16px; }
        .sd-h1 em { font-style: italic; color: #C4860A; }
        .sd-sub { font-size: 15px; color: rgba(17,17,17,0.55); line-height: 1.7; margin-bottom: 36px; }
        .sd-btn { display: inline-flex; align-items: center; gap: 8px; padding: 14px 28px; background: #111; border-radius: 6px; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; color: #FAFAF8; text-decoration: none; margin-bottom: 12px; transition: background 0.15s; }
        .sd-btn:hover { background: #333; }
        .sd-note { font-size: 12px; color: rgba(17,17,17,0.35); margin-bottom: 48px; }
        .sd-next { border: 1px solid rgba(17,17,17,0.1); border-radius: 10px; padding: 24px; background: #fff; }
        .sd-next-label { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(17,17,17,0.35); margin-bottom: 10px; }
        .sd-next-title { font-family: 'Cormorant Garamond', serif; font-size: 20px; font-weight: 700; color: #111; margin-bottom: 8px; }
        .sd-next-desc { font-size: 13px; color: rgba(17,17,17,0.55); line-height: 1.6; margin-bottom: 14px; }
        .sd-next-link { font-size: 13px; color: #C4860A; text-decoration: none; font-weight: 600; }
        .sd-next-link:hover { text-decoration: underline; }
      `}</style>
      <div className="sd">
        <div className="sd-card">
          <div className="sd-tag">✓ Download ready</div>
          <h1 className="sd-h1">Your <em>Toolkit</em><br />is ready.</h1>
          <p className="sd-sub">
            Click below to download. Also sent to your inbox.<br />
            Share it with a colleague — they'll thank you.
          </p>
          <a
            className="sd-btn"
            href={process.env.NEXT_PUBLIC_SALARY_TOOLKIT_URL || '/free/salary-toolkit/toolkit.pdf'}
            download
            target="_blank"
            rel="noopener noreferrer"
          >
            📊 Download Salary Toolkit
          </a>
          <p className="sd-note">Also arriving in your inbox within 2 minutes</p>
          <div className="sd-next">
            <div className="sd-next-label">One more thing</div>
            <div className="sd-next-title">AI coaching, not scripts</div>
            <div className="sd-next-desc">
              The toolkit gives you the words. Ascentor gives you the strategy —
              an AI coach that helps you think through negotiations, manage stakeholders,
              and lead with confidence.
            </div>
            <Link href="/signup" className="sd-next-link">Try Ascentor free →</Link>
          </div>
        </div>
      </div>
    </>
  );
}
