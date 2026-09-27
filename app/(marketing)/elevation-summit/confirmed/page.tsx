import '@/styles/marketing.css';

export default function SummitConfirmedPage() {
  return (
    <main style={{ background: '#FAFAF8', minHeight: '100vh', padding: 'clamp(6rem, 12vw, 10rem) 1.5rem' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center' }}>
        <div className="mkt-gold-bar" style={{ margin: '0 auto 1.5rem' }} />
        <p className="mkt-eyebrow" style={{ marginBottom: '1rem' }}>Inaugural Gathering - 19 November, 2026</p>
        <h1 className="mkt-section-headline" style={{ color: '#0F0F0E', marginBottom: '1.5rem', fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}>
          You are confirmed
        </h1>
        <p style={{ color: '#6B7280', fontSize: '1.0625rem', lineHeight: 1.8, marginBottom: '2rem' }}>
          Your place at the Elevation Summit, 19 November 2026, Lagos,
          is confirmed. A confirmation email is on its way to your inbox.
        </p>
        <p style={{ color: '#6B7280', fontSize: '1rem', lineHeight: 1.7, marginBottom: '2.5rem' }}>
          We look forward to seeing you there.
        </p>
        <a href="/elevation-summit" className="btn-gold" style={{ display: 'inline-flex' }}>
          Return to the Summit page
        </a>
      </div>
    </main>
  );
}
