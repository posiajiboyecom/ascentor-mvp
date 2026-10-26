import '@/styles/marketing.css';
import { HeartHandshake } from 'lucide-react';
import FlyerCta from '../FlyerCta';
import ConfirmedTicket from './ConfirmedTicket';

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
          is confirmed. We email your ticket to the address you registered with. If it has not arrived, you do not need to wait for it:
          open your ticket below, or any time at <a href="/elevation-summit/ticket" style={{ color: '#0F0F0E', fontWeight: 600 }}>Find my ticket</a>.
        </p>
        <ConfirmedTicket />
        <p style={{ color: '#6B7280', fontSize: '1rem', lineHeight: 1.7, marginBottom: '2.5rem' }}>
          We look forward to seeing you there.
        </p>
        <div style={{ margin: '0 0 2rem', padding: '1.5rem', background: '#fff', border: '1px solid #E8E6E1', borderRadius: '1rem' }}>
          <p style={{ color: '#0F0F0E', fontWeight: 700, margin: '0 0 0.5rem' }}>Tell people you are coming</p>
          <p style={{ color: '#6B7280', fontSize: '0.9375rem', lineHeight: 1.6, margin: '0 0 1rem' }}>Make your own &quot;I will be attending&quot; flyer with your name and photo, download it and share it.</p>
          <FlyerCta solid />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2rem' }}>
          <a href="/elevation-summit" className="btn-gold" style={{ display: 'inline-flex' }}>
            Return to the Summit page
          </a>
          <a
            href="/donate"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.875rem 1.5rem', borderRadius: '0.625rem',
              border: '1.5px solid #E8E6E1', color: '#0F0F0E', fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <HeartHandshake size={16} /> Support with a Donation
          </a>
        </div>
        <p style={{ color: '#9CA3AF', fontSize: '0.875rem' }}>
          Registration is free. Donations help fund the Summit and Ascentor&apos;s wider work.
        </p>
      </div>
    </main>
  );
}
