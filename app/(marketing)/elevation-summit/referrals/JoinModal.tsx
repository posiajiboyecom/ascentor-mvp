'use client';

// Register (or find your link) without leaving the leaderboard. On success the visitor's own referral link is shown right
// here, ready to copy or share, and the board refreshes so a friend who referred them climbs straight away.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import 'react-phone-number-input/style.css';
import PhoneInput from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import { summitFormSchema } from '../summitFormSchema';

const REF_KEY = 'summit_ref';
const DEV_KEY = 'summit_device';
function storedRef(): string | undefined {
  try { const v = JSON.parse(localStorage.getItem(REF_KEY) || 'null'); return v && v.exp > Date.now() ? String(v.code) : undefined; } catch { return undefined; }
}
function deviceId(): string | undefined {
  try { let d = localStorage.getItem(DEV_KEY); if (!d) { d = crypto.randomUUID(); localStorage.setItem(DEV_KEY, d); } return d; } catch { return undefined; }
}

type Mode = 'register' | 'find';
type Fields = { full_name: string; email: string; whatsapp: string; location: string; organisation: string; current_role: string; attendance_type: 'onsite' | 'virtual'; consent: boolean };
const EMPTY: Fields = { full_name: '', email: '', whatsapp: '', location: '', organisation: '', current_role: '', attendance_type: 'onsite', consent: false };

export default function JoinButtons({ variant = 'cta' }: { variant?: 'cta' | 'hero' }) {
  const [open, setOpen] = useState<Mode | null>(null);
  // Keep a ?ref=CODE from the link this visitor arrived on, so a signup here still credits whoever shared it.
  useEffect(() => {
    try {
      const code = new URLSearchParams(window.location.search).get('ref')?.trim().toUpperCase();
      if (code && /^[A-Z0-9]{8}$/.test(code)) localStorage.setItem(REF_KEY, JSON.stringify({ code, exp: Date.now() + 30 * 86400_000 }));
    } catch { /* storage can be blocked */ }
  }, []);
  return (
    <>
      <div className="slb-btns">
        <button type="button" className="slb-btn rust" onClick={() => setOpen('register')}>Register and get my link</button>
        <button type="button" className={`slb-btn line${variant === 'hero' ? ' hero' : ''}`} onClick={() => setOpen('find')}>Already registered? Find my link</button>
      </div>
      {open && <Modal mode={open} setMode={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}

function Modal({ mode, setMode, onClose }: { mode: Mode; setMode: (m: Mode) => void; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields | 'form', string>>>({});
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [copied, setCopied] = useState(false);
  const [find, setFind] = useState({ email: '', second: '' });
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    box.current?.querySelector<HTMLElement>('input, button')?.focus();
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined, form: undefined })); };

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = summitFormSchema.safeParse({ ...f, other_messages: '' });
    if (!parsed.success) {
      const out: Partial<Record<keyof Fields, string>> = {};
      const friendly: Partial<Record<keyof Fields, string>> = { organisation: 'Add your school or company', current_role: 'Add your role, for example Student', location: 'Add where you live' };
      for (const i of parsed.error.issues) { const k = i.path[0] as keyof Fields; if (!out[k]) out[k] = friendly[k] ?? i.message; }
      setErrors(out); return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/summit/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...parsed.data, ref: storedRef(), device: deviceId() }) });
      const j = await res.json().catch(() => ({}));
      if (res.status === 409) { setErrors({ form: 'This email is already registered. Use “Find my link” with your email and WhatsApp number.' }); return; }
      if (!res.ok) { setErrors({ form: (j as { error?: string }).error || 'We couldn’t register you. Check your details and try again.' }); return; }
      setName(f.full_name.trim().split(/\s+/)[0] || '');
      setLink((j as { referralLink?: string | null }).referralLink ?? null);
      router.refresh();
    } catch { setErrors({ form: 'We couldn’t reach the server. Check your connection and try again.' }); }
    finally { setBusy(false); }
  };

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!find.email.trim() || !find.second.trim()) { setErrors({ form: 'Enter your email and the WhatsApp number you registered with.' }); return; }
    setBusy(true); setErrors({});
    const isRef = /^es-/i.test(find.second.trim());
    try {
      const res = await fetch('/api/summit/ticket', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(isRef ? { email: find.email.trim(), reference: find.second.trim() } : { email: find.email.trim(), whatsapp: find.second.trim() }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setErrors({ form: (j as { error?: string }).error || 'We couldn’t find that registration.' }); return; }
      if (!(j as { referralLink?: string }).referralLink) { setErrors({ form: 'We found your ticket, but not a referral link. Contact us and we’ll sort it.' }); return; }
      setName(''); setLink((j as { referralLink: string }).referralLink);
    } catch { setErrors({ form: 'We couldn’t reach the server. Check your connection and try again.' }); }
    finally { setBusy(false); }
  };

  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { window.prompt('Copy your link:', link); }
  };
  const share = link ? `I'm attending The Elevation Summit on 19 November 2026 at Lagos State University, Ojo. It's free. Register with my link: ${link}` : '';
  const err = (k: keyof Fields) => errors[k] ? <p className="slb-err">{errors[k]}</p> : null;

  return (
    <div className="slb-modal-wrap" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="slb-modal" role="dialog" aria-modal="true" aria-label={link ? 'Your referral link' : mode === 'register' ? 'Register for the Summit' : 'Find my link'} ref={box}>
        <button type="button" className="slb-x" aria-label="Close" onClick={onClose}>×</button>

        {link ? (
          <div className="slb-done">
            <div className="slb-burst" aria-hidden>✓</div>
            <h3>{name ? `You’re in, ${name}!` : 'Here’s your link'}</h3>
            <p>{name ? 'Your ticket is on its way to your email. Now bring your people: every friend who registers with this link counts for you instantly.' : 'Every friend who registers with this link counts for you instantly.'}</p>
            <div className="slb-linkbox">{link}</div>
            <div className="slb-btns col">
              <button type="button" className="slb-btn rust" onClick={copy}>{copied ? 'Copied ✓' : 'Copy my link'}</button>
              <a className="slb-btn wa" href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
            </div>
            <button type="button" className="slb-textbtn" onClick={onClose}>See the leaderboard</button>
          </div>
        ) : (
          <>
            <div className="slb-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'on' : ''} onClick={() => { setMode('register'); setErrors({}); }}>Register</button>
              <button type="button" role="tab" aria-selected={mode === 'find'} className={mode === 'find' ? 'on' : ''} onClick={() => { setMode('find'); setErrors({}); }}>I’m registered</button>
            </div>

            {mode === 'register' ? (
              <form onSubmit={register} noValidate className="slb-form">
                <p className="slb-mhead">Free · Thursday 19 November · Lagos State University, Ojo</p>
                <div className="slb-seg" role="radiogroup" aria-label="How will you attend?">
                  {(['onsite', 'virtual'] as const).map((t) => (
                    <button key={t} type="button" role="radio" aria-checked={f.attendance_type === t} className={f.attendance_type === t ? 'on' : ''} onClick={() => set('attendance_type', t)}>{t === 'onsite' ? 'In person' : 'Virtual'}</button>
                  ))}
                </div>
                <label>Full name<input value={f.full_name} onChange={(e) => set('full_name', e.target.value)} autoComplete="name" placeholder="Your full name" />{err('full_name')}</label>
                <label>Email<input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" placeholder="you@email.com" />{err('email')}</label>
                <label>WhatsApp number
                  <PhoneInput value={f.whatsapp || undefined} onChange={(v) => set('whatsapp', v ?? '')} international defaultCountry="NG" flags={flags} className="slb-phone" />
                  {err('whatsapp')}</label>
                <div className="slb-two">
                  <label>Location<input value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="Ojo, Lagos" />{err('location')}</label>
                  <label>Role<input value={f.current_role} onChange={(e) => set('current_role', e.target.value)} placeholder="Student, Engineer…" />{err('current_role')}</label>
                </div>
                <label>School or company<input value={f.organisation} onChange={(e) => set('organisation', e.target.value)} placeholder="e.g. LASU" />{err('organisation')}</label>
                <label className="slb-check"><input type="checkbox" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} /><span>I agree to the <a href="/privacy" target="_blank" rel="noopener noreferrer">privacy policy</a> and to being contacted about the Summit.</span></label>
                {err('consent')}
                {errors.form && <p className="slb-err form" role="alert">{errors.form}</p>}
                <button type="submit" className="slb-btn rust full" disabled={busy}>{busy ? 'Registering…' : 'Register and get my link'}</button>
              </form>
            ) : (
              <form onSubmit={lookup} noValidate className="slb-form">
                <p className="slb-mhead">Enter the email and WhatsApp number you registered with.</p>
                <label>Email<input type="email" value={find.email} onChange={(e) => setFind((x) => ({ ...x, email: e.target.value }))} autoComplete="email" /></label>
                <label>WhatsApp number, or ticket reference (ES-…)<input value={find.second} onChange={(e) => setFind((x) => ({ ...x, second: e.target.value }))} autoComplete="tel" placeholder="+234 803 000 0000" /></label>
                {errors.form && <p className="slb-err form" role="alert">{errors.form}</p>}
                <button type="submit" className="slb-btn rust full" disabled={busy}>{busy ? 'Looking…' : 'Show my link'}</button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
