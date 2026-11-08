'use client';

import { useState } from 'react';

/** The registrant's own referral link, with copy and WhatsApp share. */
export default function SummitReferralCard({ link, style }: { link: string; style?: React.CSSProperties }) {
  const [copied, setCopied] = useState(false);
  const text = `I'm attending the Elevation Summit on 19 November 2026. Register free with my link: ${link}`;
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { window.prompt('Copy your link:', link); }
  }
  return (
    <div style={{ padding: '1.25rem', background: '#fff', border: '1px solid #E8E6E1', borderRadius: '1rem', textAlign: 'left', ...style }}>
      <p style={{ color: '#0F0F0E', fontWeight: 700, margin: '0 0 0.375rem' }}>Bring people with you</p>
      <p style={{ color: '#4B5563', fontSize: '0.9375rem', lineHeight: 1.6, margin: '0 0 0.875rem' }}>
        Every friend who registers with your link and confirms their email counts for you. We email you each time. Rewards are given during the event and top referrers are announced by name.
      </p>
      <p style={{ margin: '0 0 0.875rem', padding: '0.625rem 0.75rem', background: '#F7F5F0', borderRadius: '0.5rem', fontSize: '0.875rem', wordBreak: 'break-all' }}>{link}</p>
      <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={copy} className="btn-gold" style={{ display: 'inline-flex' }}>{copied ? 'Copied' : 'Copy my link'}</button>
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', padding: '0.75rem 1.25rem', borderRadius: '0.625rem', border: '1.5px solid #E8E6E1', color: '#0F0F0E', fontWeight: 600, textDecoration: 'none' }}>Share on WhatsApp</a>
      </div>
    </div>
  );
}
