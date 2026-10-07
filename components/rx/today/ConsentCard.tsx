'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { recordChatConsent } from '@/app/onboarding/actions';

/** Shown once to members who joined before chat review was part of onboarding. */
export default function ConsentCard() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  return (
    <div className="rx-soft rx-stack-sm rx-rise" role="region" aria-label="Privacy update">
      <p className="rx-p rx-strong">A change to how chats are handled</p>
      <p className="rx-sm">The Ascentor team can read chats on the platform, including conversations with Sage, to keep members safe and to improve Ascentor. Other members still cannot read your chats. <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--rx-gold)', fontWeight: 700 }}>Read the privacy policy</a></p>
      <div><button type="button" className="rx-btn primary" disabled={pending} onClick={() => start(async () => { const r = await recordChatConsent(); if (!r.ok) { setError(r.error); return; } router.refresh(); })}>I understand</button></div>
      {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}
    </div>
  );
}
