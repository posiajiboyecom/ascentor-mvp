'use client';

// Walk-in check-in: three fields, then a full-screen green pass. The pass has a live clock and a moving bar, so a
// volunteer can tell a live screen from a screenshot at a glance. It is kept on this phone for the rest of the day.
import { useEffect, useRef, useState, useTransition } from 'react';
import { walkInAction } from './actions';

const RUST = '#B6502A';
const INK = '#161616';
const MUTED = '#5F6672';
const BG = '#F6F5F2';
const GREEN = '#177245';
const STORE = 'es2026_walkin_pass';

interface Pass { name: string; at: string; ref: string; day: string; earlier: boolean }

const watDay = (d = new Date()) => new Date(d.getTime() + 3600_000).toISOString().slice(0, 10);
const clock = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Africa/Lagos' });
const hm = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });

function loadPass(): Pass | null {
  try {
    const p = JSON.parse(localStorage.getItem(STORE) || 'null') as Pass | null;
    return p && p.day === watDay() ? p : null;
  } catch { return null; }
}

function PassScreen({ pass, onNotMe }: { pass: Pass; onNotMe: () => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);

  // Keep the screen awake while the pass is showing, so it isn't dark by the time they reach the volunteer.
  useEffect(() => {
    type WakeLock = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLock> } };
    let lock: WakeLock | null = null;
    nav.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {});
    return () => { void lock?.release().catch(() => {}); };
  }, []);

  const first = pass.name.split(' ')[0];
  return (
    <main style={{ position: 'fixed', inset: 0, background: GREEN, color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', textAlign: 'center', fontFamily: 'Metropolis, system-ui, sans-serif', overflow: 'hidden' }}>
      <style>{`
        @keyframes wi-sweep { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
        @keyframes wi-pulse { 0%,100% { transform: scale(1); opacity: .95; } 50% { transform: scale(1.08); opacity: 1; } }
      `}</style>
      <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 10, overflow: 'hidden', background: 'rgba(255,255,255,.18)' }}>
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, transparent, #fff, transparent)', animation: 'wi-sweep 1.6s linear infinite' }} />
      </div>
      <div aria-hidden style={{ width: 92, height: 92, borderRadius: '50%', background: '#fff', color: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, fontWeight: 800, animation: 'wi-pulse 1.4s ease-in-out infinite' }}>✓</div>
      <p style={{ margin: '22px 0 0', fontSize: 15, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', opacity: 0.92 }}>You’re in</p>
      <p style={{ margin: '8px 0 0', fontSize: 'clamp(34px, 10vw, 56px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-.02em', wordBreak: 'break-word' }}>{pass.name}</p>
      <p style={{ margin: '14px 0 0', fontSize: 16, opacity: 0.92 }}>The Elevation Summit · {pass.earlier ? 'checked in earlier at' : 'checked in at'} {hm(pass.at)}</p>
      <p aria-live="off" style={{ margin: '26px 0 0', fontSize: 'clamp(44px, 14vw, 72px)', fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '.02em' }}>{clock(now)}</p>
      <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.85, letterSpacing: '.08em', textTransform: 'uppercase' }}>Live time · Ref {pass.ref}</p>
      <p style={{ margin: '28px 0 0', fontSize: 17, fontWeight: 700 }}>Show this screen to a volunteer, {first}.</p>
      <button type="button" onClick={onNotMe} style={{ position: 'absolute', bottom: 18, background: 'none', border: 'none', color: 'rgba(255,255,255,.8)', fontSize: 13, textDecoration: 'underline', cursor: 'pointer' }}>Not you? Check in someone else</button>
    </main>
  );
}

const label: React.CSSProperties = { display: 'block', fontSize: 14, fontWeight: 700, color: INK, margin: '0 0 6px' };
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', minHeight: 52, padding: '12px 14px', fontSize: 17, border: '1.5px solid #CFCAC2', borderRadius: 12, background: '#fff', color: INK, outline: 'none' };

export default function WalkInClient({ open }: { open: boolean }) {
  const [pass, setPass] = useState<Pass | null>(null);
  const [ready, setReady] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const [busy, start] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setPass(loadPass()); setReady(true); }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await walkInAction(fullName, email, whatsapp).catch(() => ({ ok: false as const, error: 'No connection. Check your data or Wi-Fi and try again.' }));
      if (!r.ok) { setError({ text: r.error, field: 'field' in r ? r.field : undefined }); return; }
      const p: Pass = { name: r.name, at: r.checkedInAt, ref: r.ref, day: watDay(), earlier: r.earlier };
      try { localStorage.setItem(STORE, JSON.stringify(p)); } catch { /* the pass still shows */ }
      try { navigator.vibrate?.(80); } catch { /* not supported */ }
      setPass(p);
    });
  };

  const notMe = () => {
    try { localStorage.removeItem(STORE); } catch { /* ignore */ }
    setPass(null); setFullName(''); setEmail(''); setWhatsapp('');
    setTimeout(() => nameRef.current?.focus(), 50);
  };

  if (!ready) return <main style={{ minHeight: '100dvh', background: BG }} />;
  if (pass) return <PassScreen pass={pass} onNotMe={notMe} />;

  const bad = (f: string) => (error?.field === f ? { borderColor: '#9B1C31' } : {});

  return (
    <main style={{ minHeight: '100dvh', background: BG, color: INK, fontFamily: 'Metropolis, system-ui, sans-serif', padding: '28px 18px 40px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 440, margin: '0 auto' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ascentor-mark.png" alt="Ascentor" width={44} height={44} style={{ display: 'block', width: 44, height: 'auto' }} />
        <p style={{ margin: '22px 0 0', fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: MUTED }}>The Elevation Summit</p>
        <h1 style={{ margin: '6px 0 0', fontSize: 32, fontWeight: 800, lineHeight: 1.08, letterSpacing: '-.02em' }}>Check in</h1>
        <span aria-hidden style={{ display: 'block', width: 56, height: 4, background: '#CAA228', borderRadius: 2, margin: '12px 0 0' }} />

        {!open ? (
          <p style={{ margin: '22px 0 0', fontSize: 17, lineHeight: 1.6, color: MUTED }}>Walk-in check-in opens on the day of the Summit. If you are here now, please go to the help desk at the entrance.</p>
        ) : (
          <form onSubmit={submit} noValidate style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: MUTED }}>Didn’t register? No problem. Fill this in and show the green screen at the door.</p>
            <div>
              <label htmlFor="wi-name" style={label}>Full name</label>
              <input ref={nameRef} id="wi-name" name="name" autoComplete="name" autoCapitalize="words" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} style={{ ...input, ...bad('fullName') }} />
            </div>
            <div>
              <label htmlFor="wi-email" style={label}>Email</label>
              <input id="wi-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200} style={{ ...input, ...bad('email') }} />
            </div>
            <div>
              <label htmlFor="wi-wa" style={label}>WhatsApp number</label>
              <input id="wi-wa" name="tel" type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} required maxLength={24} style={{ ...input, ...bad('whatsapp') }} />
            </div>
            {error && <p role="alert" style={{ margin: 0, fontSize: 15, color: '#9B1C31', fontWeight: 600 }}>{error.text}</p>}
            <button type="submit" disabled={busy} style={{ minHeight: 56, border: 'none', borderRadius: 12, background: RUST, color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
              {busy ? 'Checking you in…' : 'Check me in'}
            </button>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: MUTED }}>
              We’ll use these details to send you Summit updates and invite you to the Ascentor app. See our <a href="/privacy" style={{ color: MUTED }}>privacy policy</a>.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
