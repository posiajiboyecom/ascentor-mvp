import '@/styles/marketing.css';

export default function DonateConfirmedPage() {
  return (
    <main style={{ background: '#FAFAF8', minHeight: '100vh', padding: 'clamp(6rem, 12vw, 10rem) 1.5rem' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center' }}>
        <div className="mkt-gold-bar" style={{ margin: '0 auto 1.5rem' }} />
        <p className="mkt-eyebrow" style={{ marginBottom: '1rem' }}>Ascentor &middot; The Elevation Summit</p>
        <h1 className="mkt-section-headline" style={{ color: '#0F0F0E', marginBottom: '1.5rem', fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}>
          Thank you
        </h1>
        <p style={{ color: '#6B7280', fontSize: '1.0625rem', lineHeight: 1.8, marginBottom: '2rem' }}>
          Your donation has been received. A receipt has been sent to your inbox. Your support helps
          us build the room and the community for the next generation of purposeful leaders.
        </p>
        <a href="/elevation-summit" className="btn-gold" style={{ display: 'inline-flex' }}>
          Return to the Summit page
        </a>
      </div>
    </main>
  );
}
