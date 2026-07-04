'use client';

// app/contact/page.tsx
// Public contact page — matches the landing page light design system.
// Submits to POST /api/contact which saves to contact_messages and
// emails the admin. No auth required.

import { useState } from 'react';
import Link from 'next/link';

const GOLD   = '#C8A96E';
const DARK   = '#0F0F0E';
const BG     = '#FAFAF8';
const BORDER = '#E8E6E1';
const MUTED  = '#6B7280';
const FAINT  = '#9CA3AF';

const SUBJECTS = [
  { value: 'general',     label: 'General inquiry'        },
  { value: 'partnership', label: 'Partnership opportunity' },
  { value: 'speaking',    label: 'Speaking / Summit'       },
  { value: 'media',       label: 'Media / Press'           },
  { value: 'support',     label: 'Platform support'        },
  { value: 'other',       label: 'Something else'          },
];

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '', email: '', subject: '', message: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.subject || !form.message.trim()) {
      setStatus('error');
      setErrorMsg('Please fill in all fields.');
      return;
    }
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      setStatus('success');
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err: unknown) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; background: ${BG}; color: ${DARK}; font-family: 'Inter', system-ui, sans-serif; }

        .contact-nav {
          position: sticky; top: 0; z-index: 50;
          display: flex; align-items: center; height: 64px;
          padding: 0 1.5rem;
          background: ${BG};
          border-bottom: 1px solid ${BORDER};
        }
        .contact-back {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 0.8125rem; color: ${MUTED}; text-decoration: none;
          transition: color 0.15s;
        }
        .contact-back:hover { color: ${DARK}; }

        .contact-wrap {
          min-height: 100dvh;
          display: flex; flex-direction: column;
          background: ${BG};
        }
        .contact-body {
          flex: 1;
          max-width: 680px;
          width: 100%;
          margin: 0 auto;
          padding: clamp(2.5rem, 6vw, 5rem) 1.5rem clamp(3rem, 8vw, 6rem);
        }

        .eyebrow {
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 0.6875rem; font-weight: 600;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: ${GOLD}; margin: 0 0 1rem;
        }
        .page-title {
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          font-size: clamp(2rem, 5vw, 3rem);
          font-weight: 800; line-height: 1.1;
          letter-spacing: -0.03em;
          color: ${DARK}; margin: 0 0 1rem;
        }
        .page-sub {
          font-size: 1rem; color: ${MUTED}; line-height: 1.7;
          margin: 0 0 2.5rem; max-width: 520px;
        }

        .field-group { margin-bottom: 1.25rem; }
        .field-label {
          display: block;
          font-size: 0.8125rem; font-weight: 600;
          color: ${DARK}; margin-bottom: 0.4rem;
        }
        .field-input {
          width: 100%; padding: 0.875rem 1rem;
          background: #FFFFFF;
          border: 1.5px solid ${BORDER};
          border-radius: 0.625rem;
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 0.9375rem; color: ${DARK};
          outline: none; transition: border-color 0.15s;
        }
        .field-input::placeholder { color: ${FAINT}; }
        .field-input:focus { border-color: ${GOLD}; }
        textarea.field-input { resize: vertical; min-height: 140px; line-height: 1.6; }
        select.field-input { cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%239CA3AF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; padding-right: 2.5rem; }

        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        @media (max-width: 540px) { .grid-2 { grid-template-columns: 1fr; } }

        .submit-btn {
          width: 100%; padding: 1rem;
          background: ${DARK}; color: ${BG};
          border: none; border-radius: 0.625rem;
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          font-size: 0.9375rem; font-weight: 700;
          cursor: pointer; transition: opacity 0.15s;
          margin-top: 0.5rem;
        }
        .submit-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .success-box {
          text-align: center; padding: 3rem 2rem;
          border: 1.5px solid ${GOLD}40;
          border-radius: 1rem; background: ${GOLD}08;
        }
        .success-icon {
          width: 52px; height: 52px; border-radius: 50%;
          background: ${GOLD}18; border: 1.5px solid ${GOLD}40;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 1.25rem;
        }
        .error-msg {
          font-size: 0.875rem; color: #DC2626;
          margin-top: 0.75rem; padding: 0.75rem 1rem;
          background: #FEF2F2; border: 1px solid #FECACA;
          border-radius: 0.5rem;
        }

        .contact-info {
          margin-top: 2.5rem; padding-top: 2.5rem;
          border-top: 1px solid ${BORDER};
          display: grid; grid-template-columns: 1fr 1fr 1fr;
          gap: 1.5rem;
        }
        @media (max-width: 540px) { .contact-info { grid-template-columns: 1fr; } }
        .info-item-label {
          font-size: 0.6875rem; font-weight: 600;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: ${GOLD}; margin-bottom: 0.375rem;
        }
        .info-item-value {
          font-size: 0.875rem; color: ${MUTED}; line-height: 1.5;
        }
        .info-item-value a { color: ${DARK}; text-decoration: none; }
        .info-item-value a:hover { color: ${GOLD}; }
      `}</style>

      <div className="contact-wrap">

        {/* Nav */}
        <nav className="contact-nav">
          <Link href="/" className="contact-back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Back to home
          </Link>
        </nav>

        <div className="contact-body">
          <p className="eyebrow">Get in touch</p>
          <h1 className="page-title">Contact Ascentor</h1>
          <p className="page-sub">
            Whether you want to partner, speak at the Summit, ask about the platform, or just say something — we read every message.
          </p>

          {status === 'success' ? (
            <div className="success-box">
              <div className="success-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h2 style={{ fontFamily: "'Plus Jakarta Sans', system-ui", fontWeight: 800, fontSize: '1.25rem', color: DARK, margin: '0 0 0.5rem' }}>
                Message received.
              </h2>
              <p style={{ fontSize: '0.9375rem', color: MUTED, lineHeight: 1.6, margin: '0 0 1.5rem' }}>
                We'll be in touch within 2–3 business days.
              </p>
              <button
                type="button"
                onClick={() => setStatus('idle')}
                style={{
                  background: 'transparent', border: `1.5px solid ${BORDER}`,
                  borderRadius: '0.625rem', padding: '0.625rem 1.25rem',
                  fontSize: '0.875rem', fontWeight: 600, color: MUTED,
                  cursor: 'pointer',
                }}
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className="grid-2">
                <div className="field-group">
                  <label className="field-label" htmlFor="ct-name">Full name</label>
                  <input
                    id="ct-name" className="field-input" type="text"
                    placeholder="Ajiboye Samuel"
                    value={form.name} onChange={e => set('name', e.target.value)}
                    disabled={status === 'loading'} autoComplete="name"
                  />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="ct-email">Email address</label>
                  <input
                    id="ct-email" className="field-input" type="email"
                    placeholder="you@example.com"
                    value={form.email} onChange={e => set('email', e.target.value)}
                    disabled={status === 'loading'} autoComplete="email"
                  />
                </div>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="ct-subject">What is this about?</label>
                <select
                  id="ct-subject" className="field-input"
                  value={form.subject} onChange={e => set('subject', e.target.value)}
                  disabled={status === 'loading'}
                >
                  <option value="">Select a topic…</option>
                  {SUBJECTS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="ct-message">Your message</label>
                <textarea
                  id="ct-message" className="field-input"
                  placeholder="Tell us what's on your mind…"
                  value={form.message} onChange={e => set('message', e.target.value)}
                  disabled={status === 'loading'}
                />
              </div>

              <button className="submit-btn" type="submit" disabled={status === 'loading'}>
                {status === 'loading' ? 'Sending…' : 'Send message →'}
              </button>

              {status === 'error' && (
                <p className="error-msg">{errorMsg}</p>
              )}
            </form>
          )}

          {/* Contact info strip */}
          <div className="contact-info">
            <div>
              <p className="info-item-label">Email</p>
              <p className="info-item-value">
                <a href="mailto:hello@ascentorbi.com">hello@ascentorbi.com</a>
              </p>
            </div>
            <div>
              <p className="info-item-label">Based in</p>
              <p className="info-item-value">Lagos, Nigeria</p>
            </div>
            <div>
              <p className="info-item-label">Response time</p>
              <p className="info-item-value">2–3 business days</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
