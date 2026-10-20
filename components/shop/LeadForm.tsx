'use client';

import { useState } from 'react';

export default function LeadForm({ productId, label = 'Get it free' }: { productId: string; label?: string }) {
  const [fullName, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [url, setUrl] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/shop/free', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, fullName: fullName.trim(), email: email.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.url) { setErr(j.error || 'Something went wrong. Please try again.'); return; }
      setUrl(j.url);
      window.open(j.url, '_blank', 'noopener');
    } catch {
      setErr('Network problem. Please try again.');
    } finally { setBusy(false); }
  }

  if (url) {
    return (
      <div className="sp-box">
        <p className="sp-ok"><strong>Thank you.</strong> Your download is ready and a copy is on its way to your email.</p>
        <a className="sp-btn rust" href={url} target="_blank" rel="noopener noreferrer">Download now</a>
      </div>
    );
  }
  return (
    <form className="sp-box" onSubmit={submit}>
      <label className="sp-field">Full name
        <input className="sp-input" required value={fullName} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </label>
      <label className="sp-field">Email
        <input className="sp-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </label>
      {err && <p className="sp-err">{err}</p>}
      <button className="sp-btn rust" disabled={busy}>{busy ? 'One moment...' : label}</button>
    </form>
  );
}
