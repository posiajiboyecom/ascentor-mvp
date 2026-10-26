'use client';

// A Summit ticket shown on screen (name, QR code, reference) with a PDF download. Used after registering, on the confirmed page
// and on "Find my ticket", so a registrant never depends on an email arriving.
import { useState } from 'react';

export interface ScreenTicket {
  name: string;
  attendance: 'onsite' | 'virtual';
  reference: string;
  registrationId: string;
  qrDataUrl: string;
  emailSent: boolean;
}
/** What the visitor typed, kept only in this tab, to fetch the PDF with the same proof. */
export interface TicketProof { email: string; whatsapp?: string; reference?: string }

export const TICKET_STORAGE_KEY = 'summit_ticket_v1';

export default function SummitTicketCard({ ticket, proof }: { ticket: ScreenTicket; proof?: TicketProof }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const download = async () => {
    if (!proof) return;
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/summit/ticket', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...proof, format: 'pdf' }) });
      if (!res.ok) throw new Error('failed');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a'); a.href = url; a.download = 'Elevation-Summit-2026-Ticket.pdf'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch { setErr('We could not prepare the PDF. Take a screenshot of this ticket instead; it works at the door.'); }
    setBusy(false);
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #E8E6E1', borderRadius: '1rem', padding: '1.5rem', maxWidth: 360, margin: '0 auto', textAlign: 'center' }}>
      <p style={{ color: '#C8A96E', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>Elevation Summit · 19 November 2026</p>
      <p style={{ color: '#0F0F0E', fontWeight: 700, fontSize: '1.25rem', margin: '0.5rem 0 0.25rem' }}>{ticket.name}</p>
      <p style={{ color: '#6B7280', margin: '0 0 1rem' }}>{ticket.attendance === 'virtual' ? 'Virtual attendee' : 'Onsite, Lagos'}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ticket.qrDataUrl} alt={`Ticket QR code ${ticket.reference}`} width={200} height={200} style={{ display: 'block', margin: '0 auto 0.75rem' }} />
      <p style={{ fontFamily: 'monospace', fontSize: '1.0625rem', fontWeight: 700, color: '#0F0F0E', margin: '0 0 0.25rem' }}>{ticket.reference}</p>
      <p style={{ color: '#9CA3AF', fontSize: '0.8125rem', margin: '0 0 1rem' }}>Show this at the door. Screenshot it to keep a copy.</p>
      {proof && (
        <button type="button" onClick={download} disabled={busy} className="btn-gold" style={{ border: 'none', cursor: busy ? 'default' : 'pointer', fontSize: '0.9375rem', padding: '0.7rem 1.5rem' }}>
          {busy ? 'Preparing…' : 'Download ticket (PDF)'}
        </button>
      )}
      {err && <p role="alert" style={{ color: '#B45309', fontSize: '0.875rem', margin: '0.75rem 0 0' }}>{err}</p>}
    </div>
  );
}
