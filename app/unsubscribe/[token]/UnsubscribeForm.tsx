'use client';
import { useState, useTransition } from 'react';
import { unsubscribe } from './actions';

export default function UnsubscribeForm({ token, preview }: { token: string; preview: boolean }) {
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle');
  const [busy, start] = useTransition();
  if (state === 'done') return (
    <div>
      <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F0F0E', margin: '0 0 0.5rem' }}>You’re unsubscribed.</p>
      <p style={{ color: '#4B5563', lineHeight: 1.7, margin: 0 }}>You won’t get Ascentor newsletters or announcements by email any more. Messages you need about something you signed up for, such as a ticket or a password reset, still reach you. Changed your mind? Reply to any Ascentor email and we’ll add you back.</p>
    </div>
  );
  return (
    <div>
      <button
        type="button"
        disabled={busy || preview}
        onClick={() => start(async () => { const r = await unsubscribe(token); setState(r.ok ? 'done' : 'error'); })}
        style={{ minHeight: 48, padding: '0 22px', borderRadius: 10, border: 0, background: '#B6502A', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: preview ? 'default' : 'pointer', opacity: preview ? 0.6 : 1 }}
      >
        {busy ? 'Unsubscribing…' : 'Unsubscribe'}
      </button>
      {preview && <p style={{ color: '#6B7280', fontSize: '0.875rem', marginTop: 12 }}>This is a preview link from a test email, so it doesn’t unsubscribe anyone.</p>}
      {state === 'error' && <p role="alert" style={{ color: '#9B1C31', marginTop: 12 }}>We couldn’t do that just now. Please try again, or reply “unsubscribe” to the email.</p>}
    </div>
  );
}
