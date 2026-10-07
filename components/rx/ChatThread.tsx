'use client';

// One chat surface for the whole app: messages, photos, voice notes, realtime updates with a polling safety net.
// The page decides who can post and where messages go through the `send` and `poll` actions it passes in.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ImageIcon, Mic, Send, Square, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useVoiceRecorder, formatRecordingTime } from '@/hooks/useVoiceRecorder';
import { mediaToken, parseBody } from '@/lib/rx/media';
import { relTime } from '@/lib/rx/dates';
import type { ChatMsg, RealtimeSpec } from '@/lib/rx/chat-types';
import type { ActionResult } from '@/lib/rx/types';
import { Avatar } from '@/components/rx/ui';

export interface ChatThreadProps {
  initial: ChatMsg[];
  meId: string;
  send: (body: string) => Promise<ActionResult<{ message: ChatMsg }>>;
  poll: (afterISO: string | null) => Promise<ChatMsg[]>;
  realtime?: RealtimeSpec;
  placeholder?: string;
  /** When false the composer is replaced by `notice`. */
  canSend?: boolean;
  notice?: ReactNode;
  /** Extra controls under a message (e.g. "Share this win"). */
  extra?: (m: ChatMsg, mine: boolean) => ReactNode;
  /** Shown above the messages (e.g. a pinned prompt). */
  top?: ReactNode;
  empty?: ReactNode;
  showNames?: boolean;
}

async function upload(blob: Blob, kind: 'voice' | 'img'): Promise<string> {
  const fd = new FormData();
  fd.append('file', blob);
  fd.append('kind', kind);
  const res = await fetch('/api/rx/upload', { method: 'POST', body: fd });
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error || 'Upload failed. Please try again.');
  return json.url;
}

export default function ChatThread({ initial, meId, send, poll, realtime, placeholder = 'Write a message', canSend = true, notice, extra, top, empty, showNames = true }: ChatThreadProps) {
  const [msgs, setMsgs] = useState<ChatMsg[]>(initial);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastRef = useRef<string | null>(initial.length ? initial[initial.length - 1].createdAt : null);

  const merge = useCallback((incoming: ChatMsg[]) => {
    if (!incoming.length) return;
    setMsgs((cur) => {
      const seen = new Set(cur.map((m) => m.id));
      const add = incoming.filter((m) => !seen.has(m.id));
      if (!add.length) return cur;
      const next = [...cur, ...add].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      lastRef.current = next[next.length - 1].createdAt;
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    try { merge(await poll(lastRef.current)); } catch { /* the next poll will retry */ }
  }, [poll, merge]);

  // Realtime nudges a refresh; polling is the safety net if realtime is unavailable.
  useEffect(() => {
    const timer = setInterval(refresh, 20000);
    let cleanup = () => {};
    if (realtime) {
      const sb = createClient();
      const ch = sb.channel(`rx:${realtime.table}:${realtime.value}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: realtime.table, filter: `${realtime.column}=eq.${realtime.value}` }, () => { void refresh(); })
        .subscribe();
      cleanup = () => { void sb.removeChannel(ch); };
    }
    const onVis = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(timer); cleanup(); document.removeEventListener('visibilitychange', onVis); };
  }, [realtime, refresh]);

  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight }); }, [msgs.length]);

  async function sendBody(body: string) {
    setError(''); setBusy(true);
    try {
      const r = await send(body);
      if (!r.ok) { setError(r.error); return false; }
      merge([r.message]);
      return true;
    } finally { setBusy(false); }
  }

  async function submitText() {
    const t = draft.trim();
    if (!t || busy) return;
    if (await sendBody(t)) setDraft('');
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true); setError('');
    try { const url = await upload(f, 'img'); await sendBody(mediaToken('img', url)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Upload failed.'); setBusy(false); }
  }

  const rec = useVoiceRecorder(async (blob) => {
    setBusy(true); setError('');
    try { const url = await upload(blob, 'voice'); await sendBody(mediaToken('voice', url)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Upload failed.'); setBusy(false); }
  });

  const rendered = useMemo(() => msgs.map((m) => ({ m, p: parseBody(m.body), mine: m.userId === meId })), [msgs, meId]);

  return (
    <div className="rx-chat">
      {top}
      <div className="rx-chat-body" ref={bodyRef} aria-live="polite">
        {rendered.length === 0 && (empty ?? <p className="rx-sm" style={{ textAlign: 'center', padding: 24 }}>No messages yet. Say hello.</p>)}
        {rendered.map(({ m, p, mine }) => (
          <div key={m.id} className={`rx-bub ${mine ? 'me' : 'oth'}`} title={new Date(m.createdAt).toLocaleString()}>
            {!mine && showNames && <div className="rx-who"><Avatar name={m.name} url={m.avatarUrl} size="sm" seed={m.userId} />{m.name}<span style={{ fontWeight: 400 }}>· {relTime(m.createdAt)}</span></div>}
            {p.kind === 'text' && <span>{p.text}</span>}
            {p.kind === 'img' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.url} alt="Shared photo" style={{ maxWidth: 240, maxHeight: 240, borderRadius: 10, display: 'block' }} />
            )}
            {p.kind === 'voice' && <audio controls preload="none" src={p.url} style={{ maxWidth: 240, height: 36 }} />}
            {extra?.(m, mine)}
          </div>
        ))}
      </div>

      {canSend ? (
        <div className="rx-chat-foot">
          {rec.isRecording ? (
            <>
              <button type="button" className="rx-ib" aria-label="Cancel recording" onClick={() => rec.stop(false)}><X aria-hidden /></button>
              <div className="rx-row rx-nw" style={{ flex: 1, gap: 3, height: 28 }} aria-hidden>
                {rec.levels.map((l, i) => <i key={i} style={{ display: 'block', width: 3, height: `${6 + l * 22}px`, borderRadius: 2, background: 'var(--rx-gold)' }} />)}
              </div>
              <span className="rx-sm">{formatRecordingTime(rec.seconds)}</span>
              <button type="button" className="rx-ib" aria-label="Send voice note" onClick={() => rec.stop(true)}><Square aria-hidden /></button>
            </>
          ) : (
            <>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={onPhoto} />
              <button type="button" className="rx-ib" aria-label="Add photo" disabled={busy} onClick={() => fileRef.current?.click()}><ImageIcon aria-hidden /></button>
              <input className="rx-in" placeholder={placeholder} aria-label={placeholder} value={draft} maxLength={2000}
                onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submitText(); } }} />
              <button type="button" className="rx-ib" aria-label="Record voice note" disabled={busy} onClick={() => { void rec.start(); }}><Mic aria-hidden /></button>
              <button type="button" className="rx-ib" aria-label="Send" disabled={busy || !draft.trim()} onClick={() => void submitText()}><Send aria-hidden /></button>
            </>
          )}
        </div>
      ) : (
        <div className="rx-chat-foot" style={{ justifyContent: 'space-between' }}>{notice}</div>
      )}
      {(error || rec.error) && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)', padding: '0 14px 10px' }}>{error || rec.error}</p>}
    </div>
  );
}
