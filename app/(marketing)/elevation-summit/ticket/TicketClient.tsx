'use client';

import { useState } from 'react';
import '@/styles/marketing.css';
import SummitTicketCard, { type ScreenTicket, type TicketProof } from '@/components/SummitTicketCard';

const field: React.CSSProperties = { width: '100%', padding: '0.85rem 1rem', border: '1.5px solid #E8E6E1', borderRadius: '0.625rem', fontSize: '1rem', fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box' };

export default function TicketClient() {
  const [email, setEmail] = useState('');
  const [second, setSecond] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [found, setFound] = useState<{ ticket: ScreenTicket; proof: TicketProof } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(''); setFound(null);
    const isRef = /^es-/i.test(second.trim());
    const proof: TicketProof = isRef ? { email: email.trim(), reference: second.trim() } : { email: email.trim(), whatsapp: second.trim() };
    try {
      const res = await fetch('/api/summit/ticket', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(proof) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data?.error || 'Something went wrong. Please try again.');
      else setFound({ ticket: data.ticket, proof });
    } catch { setError('We could not reach the server. Check your connection and try again.'); }
    setBusy(false);
  };

  return (
    <main style={{ background: '#FAFAF8', minHeight: '100vh', padding: 'clamp(6rem, 12vw, 9rem) 1.5rem' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <div className="mkt-gold-bar" style={{ margin: '0 auto 1.5rem' }} />
        <h1 className="mkt-section-headline" style={{ color: '#0F0F0E', fontSize: 'clamp(1.75rem, 3.5vw, 2.25rem)', marginBottom: '0.75rem' }}>Find my ticket</h1>
        <p style={{ color: '#6B7280', lineHeight: 1.7, marginBottom: '1.75rem' }}>
          No email needed. Enter the email you registered with and the WhatsApp number you gave, and your ticket opens here.
        </p>
        {found ? (
          <SummitTicketCard ticket={found.ticket} proof={found.proof} />
        ) : (
          <form onSubmit={submit} style={{ display: 'grid', gap: '0.9rem', textAlign: 'left' }}>
            <label style={{ fontWeight: 600, color: '#0F0F0E' }}>Email
              <input style={{ ...field, marginTop: 6 }} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label style={{ fontWeight: 600, color: '#0F0F0E' }}>WhatsApp number, or ticket reference (ES-…)
              <input style={{ ...field, marginTop: 6 }} type="text" required autoComplete="tel" value={second} onChange={(e) => setSecond(e.target.value)} placeholder="+234 803 000 0000" />
            </label>
            {error && <p role="alert" style={{ color: '#B45309', margin: 0, lineHeight: 1.6 }}>{error}</p>}
            <button type="submit" disabled={busy} className="btn-gold" style={{ border: 'none', cursor: busy ? 'default' : 'pointer', padding: '0.9rem 1.5rem', fontSize: '1rem', justifyContent: 'center' }}>
              {busy ? 'Looking…' : 'Open my ticket'}
            </button>
          </form>
        )}
        <p style={{ color: '#9CA3AF', fontSize: '0.875rem', marginTop: '2rem' }}>Not registered yet? <a href="/elevation-summit#register" style={{ color: '#0F0F0E', fontWeight: 600 }}>Register for free</a>.</p>
      </div>
    </main>
  );
}
