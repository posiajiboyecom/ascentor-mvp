'use client';
// Small pieces shared by the Circles, Groups and Posts consoles.
import { useCallback, useEffect, useRef, useState } from 'react';

export type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string };
export interface PersonLite { id: string; name: string; email: string | null; avatar: string | null }

export function useFlash() {
  const [toast, setToast] = useState<{ text: string; bad: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = useCallback((text: string, bad = false) => {
    setToast({ text, bad });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 6000);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const node = toast ? <div className="toast" role={toast.bad ? 'alert' : 'status'} style={toast.bad ? { borderColor: 'var(--err)' } : undefined}>{toast.text}</div> : null;
  return { flash, node };
}

/**
 * Runs an action. A "FULL:" error (a Circle or group at its usual size) asks to go ahead anyway and retries with force.
 * Returns the result when it succeeded, otherwise null after flashing the error.
 */
export async function run<T>(flash: (t: string, bad?: boolean) => void, call: (force: boolean) => Promise<Res<T>>, okText?: string): Promise<({ ok: true } & T) | null> {
  let r = await call(false);
  if (!r.ok && r.error.startsWith('FULL:')) {
    if (!window.confirm(`${r.error.slice(5)} Add them anyway?`)) return null;
    r = await call(true);
  }
  if (!r.ok) { flash(r.error.replace(/^FULL:/, ''), true); return null; }
  if (okText) flash(okText);
  return r;
}

export const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '–');
export const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '–');
export const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

export function Tag({ tone, children }: { tone: 'good' | 'warn' | 'bad' | ''; children: React.ReactNode }) {
  return <span className={`tag ${tone}`}><i />{children}</span>;
}

export function Avatar({ p, size = 30 }: { p: { name: string; avatar: string | null }; size?: number }) {
  const initials = p.name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  return p.avatar
    // eslint-disable-next-line @next/next/no-img-element
    ? <img className="cm-av" src={p.avatar} alt="" width={size} height={size} style={{ width: size, height: size }} />
    : <span className="cm-av" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>{initials || '·'}</span>;
}

/** Search box that finds members by name or email and hands back the one picked. */
export function PersonPicker({ search, onPick, placeholder = 'Search members by name or email', busy, exclude }: {
  search: (q: string) => Promise<Res<{ people: PersonLite[] }>>;
  onPick: (p: PersonLite) => void | Promise<void>;
  placeholder?: string; busy?: boolean; exclude?: Set<string>;
}) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PersonLite[]>([]);
  const [err, setErr] = useState('');
  const seq = useRef(0);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); setErr(''); return; }
    const n = ++seq.current;
    const t = setTimeout(async () => {
      const r = await search(term);
      if (n !== seq.current) return;
      if (r.ok) { setHits(r.people.filter((p) => !exclude?.has(p.id))); setErr(r.people.length ? '' : 'No one matches.'); } else setErr(r.error);
    }, 250);
    return () => clearTimeout(t);
  }, [q, search, exclude]);
  return (
    <div className="cm-picker">
      <input className="in" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} disabled={busy} />
      {(hits.length > 0 || err) && (
        <div className="cm-hits" role="listbox">
          {hits.map((p) => (
            <button key={p.id} type="button" role="option" aria-selected={false} disabled={busy} onClick={async () => { await onPick(p); setQ(''); setHits([]); }}>
              <Avatar p={p} size={26} /><span><b>{p.name}</b><small>{p.email ?? ''}</small></span>
            </button>
          ))}
          {err && !hits.length && <p className="sm" style={{ padding: '8px 10px' }}>{err}</p>}
        </div>
      )}
    </div>
  );
}

/** A small "send a notice" form used by Circles and Groups. */
export function NoticeForm({ to, onSend, disabled }: { to: string; onSend: (title: string, body: string) => Promise<boolean>; disabled?: boolean }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form className="cm-stack" onSubmit={async (e) => { e.preventDefault(); setBusy(true); if (await onSend(title, body)) { setTitle(''); setBody(''); } setBusy(false); }}>
      <p className="sm">Goes to {to} as an in-app notice, and by email to members who allow those emails.</p>
      <div className="fld"><label htmlFor="ntitle">Title</label><input id="ntitle" className="in" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} disabled={disabled || busy} /></div>
      <div className="fld"><label htmlFor="nbody">Message</label><textarea id="nbody" className="in cm-ta" value={body} maxLength={1000} rows={4} onChange={(e) => setBody(e.target.value)} disabled={disabled || busy} /></div>
      <div><button type="submit" className="btn bp" disabled={disabled || busy || !title.trim() || !body.trim()}>{busy ? 'Sending…' : 'Send notice'}</button></div>
    </form>
  );
}
