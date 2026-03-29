// ╔════════════════════════════════════════════════════════════════════╗
// ║  FILE PATH: app/p/[subdomain]/demo-gate.tsx                       ║
// ║  ACTION:    CREATE this as a NEW file (does not exist yet)        ║
// ║                                                                    ║
// ║  Then in app/p/[subdomain]/page.tsx, import and use it like this: ║
// ║                                                                    ║
// ║  import DemoGatePage from './demo-gate'                           ║
// ║                                                                    ║
// ║  Inside the SubdomainHomePage function, BEFORE the existing       ║
// ║  logged-out partner landing page block, add:                      ║
// ║                                                                    ║
// ║  if (subdomain === 'demo' && !user) {                             ║
// ║    return <DemoGatePage />                                        ║
// ║  }                                                                ║
// ╚════════════════════════════════════════════════════════════════════╝

export default function DemoGatePage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,700;1,600&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

        .dg-wrap {
          min-height: 100vh;
          background: #0C0B08;
          color: #F7F6F3;
          font-family: 'Syne', system-ui, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
        }
        .dg-logo {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 20px;
          font-weight: 700;
          color: #F7F6F3;
          letter-spacing: 0.04em;
          margin-bottom: 56px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .dg-logo span { color: #E8A020; }
        .dg-card {
          width: 100%;
          max-width: 560px;
          background: #141310;
          border: 1px solid rgba(212,207,195,0.12);
          border-radius: 20px;
          padding: 48px 44px;
          text-align: center;
        }
        .dg-icon {
          width: 56px; height: 56px; border-radius: 14px;
          background: rgba(232,160,32,0.12);
          border: 1px solid rgba(232,160,32,0.25);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 28px; font-size: 24px;
        }
        .dg-badge {
          display: inline-block; padding: 4px 14px; border-radius: 100px;
          background: rgba(232,160,32,0.10); border: 1px solid rgba(232,160,32,0.22);
          font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.18em;
          color: #E8A020; text-transform: uppercase; margin-bottom: 20px;
        }
        .dg-headline {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: clamp(26px, 4vw, 34px); font-weight: 700;
          color: #F7F6F3; line-height: 1.12; margin-bottom: 18px;
        }
        .dg-body { font-size: 14px; color: #8A8272; line-height: 1.7; margin-bottom: 36px; }
        .dg-body strong { color: #C8C3B8; font-weight: 600; }
        .dg-divider { height: 1px; background: rgba(212,207,195,0.10); margin: 32px 0; }
        .dg-steps { display: flex; flex-direction: column; gap: 14px; margin-bottom: 36px; text-align: left; }
        .dg-step { display: flex; align-items: flex-start; gap: 14px; }
        .dg-step-num {
          width: 26px; height: 26px; border-radius: 8px; background: #E8A020; color: #0C0B08;
          font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 800;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;
        }
        .dg-step-text { font-size: 13px; color: #C8C3B8; line-height: 1.55; }
        .dg-step-text strong { color: #F7F6F3; }
        .dg-email {
          display: inline-block; padding: 10px 20px; border-radius: 8px;
          background: rgba(232,160,32,0.08); border: 1px solid rgba(232,160,32,0.2);
          font-family: 'DM Mono', monospace; font-size: 14px; font-weight: 500;
          color: #E8A020; letter-spacing: 0.02em; margin-bottom: 28px; word-break: break-all;
        }
        .dg-cta {
          display: inline-block; width: 100%; padding: 14px 0; border-radius: 11px;
          background: #E8A020; color: #0C0B08; font-family: 'Syne', sans-serif;
          font-size: 14px; font-weight: 700; text-decoration: none;
          transition: background 0.15s; margin-bottom: 14px;
        }
        .dg-cta:hover { background: #F5C55A; }
        .dg-secondary { font-size: 12px; color: #4A4438; font-family: 'DM Mono', monospace; letter-spacing: 0.04em; }
        .dg-secondary a { color: #8A8272; text-decoration: underline; text-underline-offset: 3px; }
        .dg-secondary a:hover { color: #C8C3B8; }
        @media (max-width: 480px) { .dg-card { padding: 36px 24px; } }
      `}</style>

      <div className="dg-wrap">
        <div className="dg-logo">
          ASCENT<span>OR</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#4A4438', letterSpacing: '0.12em', marginLeft: 4 }}>DEMO</span>
        </div>

        <div className="dg-card">
          <div className="dg-icon">🔐</div>
          <div className="dg-badge">Partner Access Required</div>

          <h1 className="dg-headline">
            Welcome to the<br />Ascentor Partner Demo
          </h1>

          <p className="dg-body">
            This is a live demonstration of the Ascentor white-label platform &mdash; exactly
            as your members would experience it. To explore the demo, you first need to be{' '}
            <strong>approved by Team Ascentor</strong>.
          </p>

          <div className="dg-divider" />

          <div className="dg-steps">
            <div className="dg-step">
              <div className="dg-step-num">1</div>
              <p className="dg-step-text">
                <strong>Reach out to Team Ascentor</strong> at the email below to introduce
                yourself and your use case.
              </p>
            </div>
            <div className="dg-step">
              <div className="dg-step-num">2</div>
              <p className="dg-step-text">
                We will schedule a short <strong>discovery call</strong> to understand your
                goals and walk you through the platform.
              </p>
            </div>
            <div className="dg-step">
              <div className="dg-step-num">3</div>
              <p className="dg-step-text">
                Once approved, you receive <strong>full demo access</strong> and can log in
                to explore the platform including NGN pricing.
              </p>
            </div>
          </div>

          <p style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#4A4438', letterSpacing: '0.1em', marginBottom: 10, textTransform: 'uppercase' }}>
            Contact Team Ascentor
          </p>
          <div className="dg-email">asamuel@ascentorbi.com</div>

          <a
            href="mailto:asamuel@ascentorbi.com?subject=Demo Access Request — Ascentor Partner Platform&body=Hi Team Ascentor,%0A%0AI would like to request access to the Ascentor partner demo.%0A%0AOrganisation name:%0AUse case:%0AEstimated member count:%0A%0AThank you."
            className="dg-cta"
          >
            Email Team Ascentor to request access →
          </a>

          <p className="dg-secondary">
            Already approved?{' '}
            <a href="/login?redirect=/pricing">Log in to view NGN pricing</a>
            {' '}·{' '}
            <a href="https://ascentorbi.com/pricing" target="_blank" rel="noopener noreferrer">
              Main pricing page
            </a>
          </p>
        </div>

        <p style={{ marginTop: 40, fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#2E2A22', letterSpacing: '0.08em' }}>
          © {new Date().getFullYear()} Ascentor Inc. · demo.ascentorbi.com
        </p>
      </div>
    </>
  )
}
