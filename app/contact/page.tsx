'use client';

// app/contact/page.tsx
// Public contact page - matches the landing page light design system.
// Submits to POST /api/contact which saves to contact_messages and
// emails the admin. No auth required.

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import PublicHeader from '@/components/layout/PublicHeader';
import PublicFooter from '@/components/layout/PublicFooter';

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

const initialTouched = { name: false, email: false, subject: false, message: false };

function CustomSubjectSelect({
  value,
  onChange,
  onBlur,
  error,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = SUBJECTS.find(s => s.value === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (open) onBlur();
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onBlur]);

  function select(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div ref={ref} className={`field-group custom-select ${open ? 'open' : ''} ${error ? 'has-error' : ''}`}>
      <label className="field-label" htmlFor="ct-subject">What is this about?</label>
      <button
        type="button"
        id="ct-subject"
        className="custom-select-trigger"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? '' : 'placeholder'}>
          {selected ? selected.label : 'Select a topic'}
        </span>
        <svg className="custom-select-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div className="custom-select-options" role="listbox">
          {SUBJECTS.map(s => (
            <div
              key={s.value}
              className={`custom-select-option ${s.value === value ? 'active' : ''}`}
              onClick={() => select(s.value)}
              role="option"
              aria-selected={s.value === value}
            >
              {s.label}
            </div>
          ))}
        </div>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '', email: '', subject: '', message: '',
  });
  const [touched, setTouched] = useState(initialTouched);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    validateField(field, value);
  }

  function blur(field: string) {
    setTouched(t => ({ ...t, [field]: true }));
    validateField(field, form[field as keyof typeof form]);
  }

  function validateField(field: string, value: string) {
    let msg = '';
    if (field === 'name' && !value.trim()) msg = 'Please enter your name.';
    if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      if (!value.trim()) msg = 'Please enter your email.';
      else msg = 'Please enter a valid email.';
    }
    if (field === 'subject' && !value) msg = 'Please select a topic.';
    if (field === 'message' && !value.trim()) msg = 'Please write a message.';
    setErrors(e => ({ ...e, [field]: msg }));
    return msg;
  }

  function validateAll() {
    const next: Record<string, string> = {};
    (['name', 'email', 'subject', 'message'] as const).forEach(k => {
      next[k] = validateField(k, form[k]);
    });
    setTouched({ name: true, email: true, subject: true, message: true });
    return Object.values(next).some(Boolean) === false;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateAll()) return;
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
      setTouched(initialTouched);
      setErrors({});
    } catch (err: unknown) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; background: ${BG}; color: ${DARK}; font-family: Metropolis; }

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
          font-family: Metropolis;
          font-size: 0.6875rem; font-weight: 600;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: ${GOLD}; margin: 0 0 1rem;
        }
        .page-title {
          font-family: Metropolis;
          font-size: clamp(2rem, 5vw, 3rem);
          font-weight: 800; line-height: 1.1;
          letter-spacing: -0.03em;
          color: ${DARK}; margin: 0 0 1rem;
        }
        .page-sub {
          font-family: Metropolis;
          font-size: 1rem; color: ${MUTED}; line-height: 1.7;
          margin: 0 0 2.5rem; max-width: 520px;
        }

        .field-group { margin-bottom: 1.25rem; }
        .field-label {
          display: block;
          font-family: Metropolis;
          font-size: 0.8125rem; font-weight: 600;
          color: ${DARK}; margin-bottom: 0.4rem;
        }
        .field-group.has-error .field-input,
        .field-group.has-error .custom-select-trigger {
          border-color: #DC2626;
          background-color: #FEF2F2;
        }
        .field-input {
          width: 100%; padding: 0.875rem 1rem;
          background: #FFFFFF;
          border: 1.5px solid ${BORDER};
          border-radius: 0.625rem;
          font-family: Metropolis;
          font-size: 0.9375rem; color: ${DARK};
          outline: none; transition: border-color 0.15s;
        }
        .field-input::placeholder { color: ${FAINT}; }
        .field-input:focus { border-color: ${GOLD}; }
        textarea.field-input { resize: vertical; min-height: 140px; line-height: 1.6; }
        select.field-input { cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%239CA3AF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; padding-right: 2.5rem; }

        .field-error {
          font-family: Metropolis;
          font-size: 0.75rem;
          color: #DC2626;
          margin-top: 0.35rem;
          min-height: 1rem;
        }

        .custom-select { position: relative; }
        .custom-select-trigger {
          width: 100%; padding: 0.875rem 1rem;
          background: #FFFFFF;
          border: 1.5px solid ${BORDER};
          border-radius: 0.625rem;
          font-family: Metropolis;
          font-size: 0.9375rem; color: ${DARK};
          cursor: pointer;
          display: flex; align-items: center; justify-content: space-between;
          transition: border-color 0.15s;
        }
        .custom-select-trigger:focus { outline: none; border-color: ${GOLD}; }
        .custom-select-trigger .placeholder { color: ${FAINT}; }
        .custom-select-arrow {
          width: 12px; height: 12px;
          transition: transform 0.2s;
        }
        .custom-select.open .custom-select-arrow { transform: rotate(180deg); }
        .custom-select-options {
          position: absolute; top: calc(100% + 6px); left: 0; right: 0;
          background: #FFFFFF;
          border: 1px solid ${BORDER};
          border-radius: 0.625rem;
          box-shadow: 0 12px 32px rgba(15,15,14,0.08);
          z-index: 10;
          overflow: hidden;
          padding: 0.375rem;
        }
        .custom-select-option {
          padding: 0.625rem 0.75rem;
          border-radius: 0.375rem;
          cursor: pointer;
          font-size: 0.875rem;
          color: ${DARK};
          transition: background 0.12s;
        }
        .custom-select-option:hover,
        .custom-select-option.active {
          background: #F4F3EF;
          color: #0F0F0E;
        }

        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        @media (max-width: 540px) { .grid-2 { grid-template-columns: 1fr; } }

        .submit-btn {
          width: 100%; padding: 1rem;
          background: ${DARK}; color: ${BG};
          border: none; border-radius: 0.625rem;
          font-family: Metropolis;
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
          font-family: Metropolis;
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
          font-family: Metropolis;
          font-size: 0.6875rem; font-weight: 600;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: ${GOLD}; margin-bottom: 0.375rem;
        }
        .info-item-value {
          font-family: Metropolis;
          font-size: 0.875rem; color: ${MUTED}; line-height: 1.5;
        }
        .info-item-value a { color: ${DARK}; text-decoration: none; }
        .info-item-value a:hover { color: ${GOLD}; }
      `}</style>

      <PublicHeader />
      <div className="contact-wrap">
        <div className="contact-body">
          <p className="eyebrow">Get in touch</p>
          <h1 className="page-title">Contact Ascentor</h1>
          <p className="page-sub">
            Send us a message about partnerships, the Summit, or the platform. We read every one.
          </p>

          {status === 'success' ? (
            <div className="success-box">
              <div className="success-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h2 style={{ fontFamily: "Metropolis", fontWeight: 800, fontSize: '1.25rem', color: DARK, margin: '0 0 0.5rem' }}>
                Message received.
              </h2>
              <p style={{ fontSize: '0.9375rem', color: MUTED, lineHeight: 1.6, margin: '0 0 1.5rem' }}>
                We'll be in touch within 2 or 3 business days.
              </p>
              <button
                type="button"
                onClick={() => setStatus('idle')}
                style={{
                  background: 'transparent', border: `1.5px solid ${BORDER}`,
                  borderRadius: '0.625rem', padding: '0.625rem 1.25rem',
                  fontSize: '0.875rem', fontWeight: 600, color: MUTED,
                  cursor: 'pointer', fontFamily: 'Metropolis',
                }}
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className="grid-2">
                <div className={`field-group ${touched.name && errors.name ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="ct-name">Full name</label>
                  <input
                    id="ct-name" className="field-input" type="text"
                    placeholder="Ajiboye Samuel"
                    value={form.name}
                    onChange={e => update('name', e.target.value)}
                    onBlur={() => blur('name')}
                    disabled={status === 'loading'} autoComplete="name"
                  />
                  {touched.name && <p className="field-error">{errors.name}</p>}
                </div>
                <div className={`field-group ${touched.email && errors.email ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="ct-email">Email address</label>
                  <input
                    id="ct-email" className="field-input" type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={e => update('email', e.target.value)}
                    onBlur={() => blur('email')}
                    disabled={status === 'loading'} autoComplete="email"
                  />
                  {touched.email && <p className="field-error">{errors.email}</p>}
                </div>
              </div>

              <CustomSubjectSelect
                value={form.subject}
                onChange={(v: string) => update('subject', v)}
                onBlur={() => blur('subject')}
                error={touched.subject ? errors.subject : ''}
                disabled={status === 'loading'}
              />

              <div className={`field-group ${touched.message && errors.message ? 'has-error' : ''}`}>
                <label className="field-label" htmlFor="ct-message">Your message</label>
                <textarea
                  id="ct-message" className="field-input"
                  placeholder="Tell us what's on your mind…"
                  value={form.message}
                  onChange={e => update('message', e.target.value)}
                  onBlur={() => blur('message')}
                  disabled={status === 'loading'}
                />
                {touched.message && <p className="field-error">{errors.message}</p>}
              </div>

              <button className="submit-btn" type="submit" disabled={status === 'loading'}>
                {status === 'loading' ? 'Sending…' : 'Send message'}
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
                <a href="mailto:contact@joinascentor.com">contact@joinascentor.com</a>
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
      <PublicFooter />
    </>
  );
}
