'use client';

// components/auth/CheckInbox.tsx
// "Confirm your email" screen with a rate-limited resend. Shown after sign-up
// (when Supabase requires confirmation) and when an unconfirmed address tries
// to sign in.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface CheckInboxProps {
  email: string;
  /** Where the confirmation link should land after /auth/callback. */
  next?: string;
}

const COOLDOWN_S = 60;

export default function CheckInbox({ email, next = '/onboarding' }: CheckInboxProps) {
  const [cooldown, setCooldown] = useState(COOLDOWN_S);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function resend() {
    if (cooldown > 0 || status === 'sending') return;
    setStatus('sending');
    setMessage('');
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setStatus('error');
      setMessage('We couldn’t resend that just now. Please wait a minute and try again.');
    } else {
      setStatus('sent');
      setMessage('Sent. It can take a minute to arrive.');
    }
    setCooldown(COOLDOWN_S);
  }

  return (
    <div role="status" style={{ textAlign: 'center', padding: '1rem 0' }}>
      <div
        aria-hidden="true"
        style={{ width: 56, height: 56, borderRadius: '50%', background: '#F4F3EF', margin: '0 auto 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}
      >
        <Mail size={26} color="#8A6A2B" />
      </div>
      <h1 style={{ fontWeight: 800, fontSize: '1.75rem', margin: '0 0 0.5rem', color: '#0F0F0E', letterSpacing: '-0.02em' }}>
        Check your inbox
      </h1>
      <p style={{ fontSize: '0.9375rem', color: '#374151', lineHeight: 1.6, margin: '0 0 0.25rem' }}>
        We sent a confirmation link to
      </p>
      <p style={{ fontSize: '1rem', fontWeight: 700, color: '#0F0F0E', margin: '0 0 1rem', wordBreak: 'break-all' }}>{email}</p>
      <p style={{ fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
        Open it on this device to finish creating your account. Nothing there? Check spam, or resend below.
      </p>

      <button
        type="button"
        onClick={resend}
        disabled={cooldown > 0 || status === 'sending'}
        style={{
          width: '100%', padding: '0.875rem', borderRadius: '0.625rem', border: '1.5px solid #E8E6E1',
          background: '#FFFFFF', color: '#0F0F0E', fontWeight: 700, fontSize: '0.9375rem',
          cursor: cooldown > 0 ? 'not-allowed' : 'pointer', opacity: cooldown > 0 ? 0.55 : 1,
        }}
      >
        {status === 'sending' ? 'Sending…' : cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend email'}
      </button>

      {message && (
        <p role="alert" style={{ fontSize: '0.8125rem', marginTop: '0.75rem', color: status === 'error' ? '#DC2626' : '#15803D' }}>
          {message}
        </p>
      )}

      <p style={{ fontSize: '0.8125rem', color: '#6B7280', marginTop: '1.5rem' }}>
        Wrong address? <Link href="/signup" style={{ color: '#8A6A2B', fontWeight: 700 }}>Start again</Link>
      </p>
    </div>
  );
}
