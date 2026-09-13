'use client';

import Link from 'next/link';
import { useState } from 'react';
import PublicShell from '@/components/layout/PublicShell';
import { Mail, Check, AlertCircle, X } from 'lucide-react';

export default function NewsletterPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  function closeModal() {
    setStatus('idle');
    if (status === 'done') {
      setEmail('');
      setName('');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });
      setStatus(res.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  }

  return (
    <PublicShell>
      <div style={{ background: '#FAFAF9', fontFamily: "'Metropolis', system-ui, sans-serif" }}>

      <div className="max-w-lg mx-auto px-5 py-20 text-center">
        <div className="mb-4" style={{ color: '#E8A020', display: 'flex', justifyContent: 'center' }}>
          <Mail size={40} strokeWidth={1.5} />
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold mb-3"
          style={{ fontFamily: "'Metropolis', sans-serif", color: '#0C0B08' }}>
          The Ascentor Weekly
        </h1>
        <p className="text-base mb-8" style={{ color: '#6B7280', lineHeight: 1.7 }}>
          Every Tuesday, get one actionable leadership insight, one framework you can use immediately, and one story from a leader who's been where you are.
        </p>

          <form onSubmit={handleSubmit} className="rounded-2xl p-8 text-left"
            style={{ background: '#fff', border: '1px solid #E5E5E4' }}>
            <div className="mb-4">
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#374151' }}>Your name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Amara Obi"
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ background: '#F5F5F4', border: '1px solid #E5E5E4', color: '#0C0B08', outline: 'none' }}
              />
            </div>
            <div className="mb-5">
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#374151' }}>Email address *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="amara@company.com"
                required
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ background: '#F5F5F4', border: '1px solid #E5E5E4', color: '#0C0B08', outline: 'none' }}
              />
            </div>
            <button type="submit" disabled={status === 'loading' || !email.trim()}
              className="w-full py-3.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-transform hover:scale-[1.02]"
              style={{ background: '#E8A020', color: '#000' }}>
              {status === 'loading' ? 'Subscribing...' : "Subscribe - it's free"}
            </button>
            {status === 'error' && (
              <p className="text-xs mt-3 text-center" style={{ color: '#EF4444' }}>Something went wrong. Try again.</p>
            )}
            <p className="text-xs mt-4 text-center" style={{ color: '#9CA3AF' }}>
              No spam. Unsubscribe anytime. Read our <Link href="/terms" style={{ textDecoration: 'underline' }}>privacy policy</Link>.
            </p>
          </form>
      </div>

      {(status === 'done' || status === 'error') && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 15, 14, 0.45)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={closeModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '1rem',
              padding: '2rem',
              maxWidth: 420,
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
              position: 'relative',
            }}
          >
            <button
              onClick={closeModal}
              style={{ position: 'absolute', top: 14, right: 14, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer' }}
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <div style={{ color: status === 'done' ? '#E8A020' : '#EF4444', display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              {status === 'done' ? <Check size={40} strokeWidth={2} /> : <AlertCircle size={40} strokeWidth={2} />}
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: "'Metropolis', sans-serif", color: '#0C0B08' }}>
              {status === 'done' ? "You're in!" : 'Something went wrong'}
            </h3>
            <p className="text-sm mb-6" style={{ color: '#6B7280', lineHeight: 1.7 }}>
              {status === 'done'
                ? "Check your inbox for a welcome email. Your first leadership insight drops next Tuesday."
                : "We couldn't subscribe you right now. Please try again in a moment."}
            </p>
            <button
              onClick={closeModal}
              className="py-3 px-8 rounded-xl text-sm font-semibold"
              style={{ background: status === 'done' ? '#E8A020' : '#0F0F0E', color: status === 'done' ? '#000' : '#FAFAF8' }}
            >
              {status === 'done' ? 'Got it' : 'Try again'}
            </button>
          </div>
        </div>
      )}
    </div>
    </PublicShell>
  );
}
