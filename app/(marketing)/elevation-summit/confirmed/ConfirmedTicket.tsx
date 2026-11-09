'use client';

import { useEffect, useState } from 'react';
import SummitReferralCard from '@/components/SummitReferralCard';
import SummitTicketCard, { TICKET_STORAGE_KEY, type ScreenTicket, type TicketProof } from '@/components/SummitTicketCard';

/** The ticket from the registration that just happened in this tab, or a link to find it if the visitor came here another way. */
export default function ConfirmedTicket() {
  const [info, setInfo] = useState<{ ticket: ScreenTicket | null; proof: TicketProof; emailSent: boolean; referralLink?: string | null } | null>(null);
  useEffect(() => {
    try { const raw = sessionStorage.getItem(TICKET_STORAGE_KEY); if (raw) setInfo(JSON.parse(raw)); } catch { /* none */ }
  }, []);
  if (!info?.ticket) {
    return (
      <p style={{ margin: '0 0 2rem' }}>
        <a href="/elevation-summit/ticket" className="btn-gold" style={{ display: 'inline-flex' }}>Find my ticket</a>
      </p>
    );
  }
  return (
    <div style={{ margin: '0 0 2rem' }}>
      {!info.emailSent && (
        <p role="status" style={{ color: '#B45309', lineHeight: 1.6, margin: '0 0 1rem' }}>
          Your confirmation email has not gone out yet. Your ticket is below, and we will email it as soon as we can.
        </p>
      )}
      <SummitTicketCard ticket={info.ticket} proof={info.proof} />
      {info.referralLink && <SummitReferralCard link={info.referralLink} style={{ marginTop: '1.5rem' }} />}
    </div>
  );
}
