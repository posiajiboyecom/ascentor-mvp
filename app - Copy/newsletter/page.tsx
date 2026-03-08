'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function NewsletterPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

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
    <div className="min-h-screen" style={{ background: '#FAFAF9', fontFamily: "'Syne', system-ui, sans-serif" }}>

      <nav className="sticky top-0 z-50 backdrop-blur-md" style={{ background: 'rgba(250,250,249,0.88)', borderBottom: '1px solid #E5E5E4' }}>
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl" style={{ color: '#E8A020' }}><svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg></span>
            <span className="text-lg font-semibold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>Ascentor</span>
          </Link>
          <Link href="/signup" className="px-5 py-2 rounded-lg text-sm font-semibold" style={{ background: '#E8A020', color: '#000' }}>
            Start Free Trial
          </Link>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-5 py-20 text-center">
        <div className="text-4xl mb-4">📬</div>
        <h1 className="text-3xl md:text-4xl font-semibold mb-3"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#0C0B08' }}>
          The Ascentor Weekly
        </h1>
        <p className="text-base mb-8" style={{ color: '#6B7280', lineHeight: 1.7 }}>
          Every Tuesday, get one actionable leadership insight, one framework you can use immediately, and one story from an African leader who's been where you are.
        </p>

        {status === 'done' ? (
          <div className="rounded-2xl p-8" style={{ background: '#fff', border: '1px solid #E5E5E4' }}>
            <div className="text-3xl mb-3"><svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11v0c-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98v0C9.52 4.9 9 5.52 9 6.23V7"/></svg></div>
            <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#0C0B08' }}>
              You're in!
            </h3>
            <p className="text-sm" style={{ color: '#6B7280' }}>
              Check your inbox for a welcome email. Your first leadership insight drops next Tuesday.
            </p>
          </div>
        ) : (
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
              {status === 'loading' ? 'Subscribing...' : "Subscribe — it's free"}
            </button>
            {status === 'error' && (
              <p className="text-xs mt-3 text-center" style={{ color: '#EF4444' }}>Something went wrong. Try again.</p>
            )}
            <p className="text-xs mt-4 text-center" style={{ color: '#9CA3AF' }}>
              No spam. Unsubscribe anytime. Read our <Link href="/terms" style={{ textDecoration: 'underline' }}>privacy policy</Link>.
            </p>
          </form>
        )}

        <div className="mt-10 grid grid-cols-3 gap-4 text-center">
          {[
            { val: '2,000+', label: 'Subscribers' },
            { val: '52%', label: 'Open rate' },
            { val: 'Free', label: 'Forever' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-lg font-bold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#E8A020' }}>{s.val}</p>
              <p className="text-[11px]" style={{ color: '#9CA3AF' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
