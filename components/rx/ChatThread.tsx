'use client';

// One chat surface for the whole app: messages, photos, voice notes, realtime updates with a polling safety net.
// The page decides who can post and where messages go through the `send` and `poll` actions it passes in.

import Link from 'next/link';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ImageIcon, Mic, Send, Square, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useVoiceRecorder, formatRecordingTime } from '@/hooks/useVoiceRecorder';
import { mediaToken, parseBody } from '@/lib/rx/media';
import { relTime } from '@/lib/rx/dates';
import type { ChatMsg, RealtimeSpec } from '@/lib/rx/chat-types';
import type { ActionResult } from '@/lib/rx/types';
import { Avatar } from '@/components/rx/ui';
import { enqueue, newClientId, outboxOn, subscribeOutbox, type OutboxKind } from '@/lib/outbox';

// A shared Community post arrives as a plain path. Show it as a link a member can open.
const POST_PATH = /(\/community\/post\/[0-9a-f-]{36})/i;
function Linked({ text }: { text: string }) {
  const parts = text.split(POST_PATH);
  return <span>{parts.map((part, i) => (POST_PATH.test(part) ? <Link key={i} href={part} style={{ textDecoration: 'underline' }}>View the post</Link> : part))}</span>;
}

export interface ChatThreadProps {
  initial: ChatMsg[];
  meId: string;
  /** `clientId` is the idempotency key when the outbox is used. */
  send: (body: string, clientId?: string) => Promise<ActionResult<{ message: ChatMsg }>>;
  /** Opt in to "Waiting to send". Only takes effect when that kind is switched on in lib/outbox.ts. */
  outbox?: { kind: Extract<OutboxKind, 'circle_message' | 'dm_message'>; payload: (body: string) => unknown };
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
  /** 'linkedin' is the direct-message layout: intro, day dividers, grouped messages, "Seen". Default is the bubble layout. */
  layout?: 'bubbles' | 'linkedin';
  /** linkedin layout: shown at the top of the conversation (large avatar, name, View profile). */
  intro?: ReactNode;
  /** linkedin layout: 'area' is the full composer, 'mini' the docked one. */
  composer?: 'bar' | 'area' | 'mini';
  /** linkedin layout: the member's own name and photo, for messages waiting to send. */
  meInfo?: { name: string; avatarUrl: string | null };
  /** linkedin layout: when the other person last opened the conversation. Shows "Seen" or "Sent" after my last message. */
  peerReadAt?: string | null;
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

export default function ChatThread({ initial, meId, send, outbox, poll, realtime, placeholder = 'Write a message', canSend = true, notice, extra, top, empty, showNames = true, layout = 'bubbles', intro, composer = 'bar', meInfo, peerReadAt }: ChatThreadProps) {
  const [msgs, setMsgs] = useState<ChatMsg[]>(initial);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Messages not yet confirmed by the server (outbox only).
  const [pending, setPending] = useState<{ cid: string; body: string; status: 'waiting' | 'sending' }[]>([]);
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

  // `poll` and `realtime` are usually new objects on every parent render. Keeping them in refs means a re-render does not tear
  // down the live connection (and reset the poll timer), which used to drop a reply that arrived in that gap.
  const pollRef = useRef(poll);
  pollRef.current = poll;
  const refresh = useCallback(async () => {
    try { merge(await pollRef.current(lastRef.current)); } catch { /* the next poll will retry */ }
  }, [merge]);
  const rtTable = realtime?.table, rtColumn = realtime?.column, rtValue = realtime?.value;

  // Realtime nudges a refresh; polling is the safety net if realtime is unavailable.
  useEffect(() => {
    const timer = setInterval(refresh, 20000);
    let cleanup = () => {};
    if (rtTable && rtColumn && rtValue) {
      const sb = createClient();
      const ch = sb.channel(`rx:${rtTable}:${rtValue}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: rtTable, filter: `${rtColumn}=eq.${rtValue}` }, () => { void refresh(); })
        .subscribe((status) => { if (status === 'SUBSCRIBED') void refresh(); }); // catches anything sent while connecting
      cleanup = () => { void sb.removeChannel(ch); };
    }
    const onVis = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(timer); cleanup(); document.removeEventListener('visibilitychange', onVis); };
  }, [rtTable, rtColumn, rtValue, refresh]);

  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight }); }, [msgs.length, pending.length]);

  // Outbox: show the message at once as "Sending…", and as "Waiting to send" if the connection fails or is gone.
  useEffect(() => subscribeOutbox((e) => {
    if (e.item.id === '*') { setPending([]); return; }   // outbox cleared (sign-out)
    if (e.type === 'sending') setPending((p) => p.map((x) => (x.cid === e.item.id ? { ...x, status: 'sending' } : x)));
    else if (e.type === 'queued') setPending((p) => p.map((x) => (x.cid === e.item.id ? { ...x, status: 'waiting' } : x)));
    else if (e.type === 'sent') {
      setPending((p) => p.filter((x) => x.cid !== e.item.id));
      const m = e.data as ChatMsg | undefined;
      if (m && m.id) merge([m]);
    } else if (e.type === 'dropped') {
      setPending((p) => p.filter((x) => x.cid !== e.item.id));
      setError(e.error || 'We couldn’t send that message.');
    }
  }), [merge]);

  async function sendViaOutbox(body: string, ob: NonNullable<ChatThreadProps['outbox']>) {
    const cid = newClientId();
    setError('');
    const queue = async () => {
      await enqueue({ id: cid, userId: meId, kind: ob.kind, payload: ob.payload(body) });
      setPending((p) => (p.some((x) => x.cid === cid) ? p.map((x) => (x.cid === cid ? { ...x, status: 'waiting' } : x)) : [...p, { cid, body, status: 'waiting' }]));
    };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { await queue(); return true; }
    setPending((p) => [...p, { cid, body, status: 'sending' }]);
    try {
      const r = await send(body, cid);
      if (!r.ok) { setPending((p) => p.filter((x) => x.cid !== cid)); setError(r.error); return false; }
      setPending((p) => p.filter((x) => x.cid !== cid));
      merge([r.message]);
      return true;
    } catch {
      // No answer: it may or may not have arrived. The same id goes to the outbox, so a repeat is recognised.
      await queue();
      return true;
    }
  }

  async function sendBody(body: string) {
    if (outbox && outboxOn(outbox.kind)) return sendViaOutbox(body, outbox);
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

  const content = (p: ReturnType<typeof parseBody>) => (
    <>
      {p.kind === 'text' && <Linked text={p.text} />}
      {p.kind === 'img' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.url} alt="Shared photo" style={{ maxWidth: 240, maxHeight: 240, borderRadius: 10, display: 'block' }} />
      )}
      {p.kind === 'voice' && <audio controls preload="none" src={p.url} style={{ maxWidth: 240, height: 36 }} />}
    </>
  );

  const recording = (
    <>
      <button type="button" className="rx-ib" aria-label="Cancel recording" onClick={() => rec.stop(false)}><X aria-hidden /></button>
      <div className="rx-row rx-nw" style={{ flex: 1, gap: 3, height: 28 }} aria-hidden>
        {rec.levels.map((l, i) => <i key={i} style={{ display: 'block', width: 3, height: `${6 + l * 22}px`, borderRadius: 2, background: 'var(--rx-gold)' }} />)}
      </div>
      <span className="rx-sm">{formatRecordingTime(rec.seconds)}</span>
      <button type="button" className="rx-ib" aria-label="Send voice note" onClick={() => rec.stop(true)}><Square aria-hidden /></button>
    </>
  );
  const fileInput = <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={onPhoto} />;
  const onEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submitText(); } };
  const errorLine = (error || rec.error) && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)', padding: '0 14px 10px' }}>{error || rec.error}</p>;

  // Direct-message layout (design prototype: .lmsgs, .lm, .dday, .seen, .lcomp).
  if (layout === 'linkedin') {
    const dayKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
    const dayLabel = (iso: string) => {
      const d = new Date(iso); const now = new Date();
      const yest = new Date(now); yest.setDate(now.getDate() - 1);
      if (dayKey(iso) === dayKey(now.toISOString())) return 'Today';
      if (dayKey(iso) === dayKey(yest.toISOString())) return 'Yesterday';
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
    };
    const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    let prevWho: string | null = null; let prevDay = '';
    const rows = rendered.map(({ m, p, mine }) => {
      const dk = dayKey(m.createdAt);
      const newDay = dk !== prevDay;
      const head = newDay || m.userId !== prevWho;
      prevDay = dk; prevWho = m.userId;
      return (
        <Fragment key={m.id}>
          {newDay && <p className="rxm-dday" suppressHydrationWarning>{dayLabel(m.createdAt)}</p>}
          <div className={`rxm-lm${head ? ' first' : ''}`}>
            {head ? <Avatar name={m.name} url={m.avatarUrl} seed={m.userId} /> : <span className="gap" />}
            <div className="lmb">
              {head && <div className="lmh"><b>{mine ? (meInfo?.name ?? m.name) : m.name}</b><span suppressHydrationWarning>{clock(m.createdAt)}</span></div>}
              <p>{content(p)}</p>
              {extra?.(m, mine)}
            </div>
          </div>
        </Fragment>
      );
    });
    const lastMine = msgs.length > 0 && msgs[msgs.length - 1].userId === meId && pending.length === 0;
    const seen = lastMine ? (peerReadAt && peerReadAt >= msgs[msgs.length - 1].createdAt ? 'Seen' : 'Sent') : null;
    const pendRows = pending.map((x, i) => {
      const head = i === 0 && !(msgs.length > 0 && msgs[msgs.length - 1].userId === meId);
      const label = x.status === 'waiting' ? 'Waiting to send' : 'Sending…';
      return (
        <div key={x.cid} className={`rxm-lm pending${head ? ' first' : ''}`}>
          {head ? <Avatar name={meInfo?.name ?? 'You'} url={meInfo?.avatarUrl ?? null} seed={meId} /> : <span className="gap" />}
          <div className="lmb">
            {head && <div className="lmh"><b>{meInfo?.name ?? 'You'}</b><span role="status">{label}</span></div>}
            <p><Linked text={x.body} /></p>
            {!head && <div className="rxm-state" role="status">{label}</div>}
          </div>
        </div>
      );
    });

    return (
      <div className="rx-chat">
        {top}
        <div className="rxm-lmsgs" ref={bodyRef} aria-live="polite">
          {intro}
          {rendered.length === 0 && pending.length === 0 && (empty ?? <p className="rx-sm" style={{ padding: '16px 0' }}>No messages yet. Say hello.</p>)}
          {rows}
          {pendRows}
          {seen && <p className="rxm-seen">{seen}</p>}
        </div>
        {canSend ? (
          composer === 'mini' ? (
            <div className="rxm-dfoot">
              {rec.isRecording ? recording : (
                <>
                  <input className="rx-in" placeholder={placeholder} aria-label={placeholder} value={draft} maxLength={2000} onChange={(e) => setDraft(e.target.value)} onKeyDown={onEnter} />
                  <button type="button" className="rx-ib" aria-label="Send" disabled={busy || !draft.trim()} onClick={() => void submitText()}><Send aria-hidden /></button>
                </>
              )}
            </div>
          ) : (
            <div className="rxm-lcomp">
              {rec.isRecording ? <div className="rx-row rx-nw" style={{ gap: 6 }}>{recording}</div> : (
                <>
                  <textarea className="rx-in" placeholder={placeholder} aria-label={placeholder} value={draft} maxLength={2000} onChange={(e) => setDraft(e.target.value)} onKeyDown={onEnter} />
                  <div className="tools">
                    {fileInput}
                    <button type="button" className="rx-ib" aria-label="Add image" disabled={busy} onClick={() => fileRef.current?.click()}><ImageIcon aria-hidden /></button>
                    <button type="button" className="rx-ib" aria-label="Record voice note" disabled={busy} onClick={() => { void rec.start(); }}><Mic aria-hidden /></button>
                    <button type="button" className="rx-btn primary" disabled={busy || !draft.trim()} onClick={() => void submitText()}>Send</button>
                  </div>
                </>
              )}
            </div>
          )
        ) : (
          <div className="rxm-lcomp">{notice}</div>
        )}
        {errorLine}
      </div>
    );
  }

  return (
    <div className="rx-chat">
      {top}
      <div className="rx-chat-body" ref={bodyRef} aria-live="polite">
        {rendered.length === 0 && (empty ?? <p className="rx-sm" style={{ textAlign: 'center', padding: 24 }}>No messages yet. Say hello.</p>)}
        {rendered.map(({ m, p, mine }) => (
          <div key={m.id} className={`rx-bub ${mine ? 'me' : 'oth'}`} title={new Date(m.createdAt).toLocaleString()}>
            {!mine && showNames && <div className="rx-who"><Avatar name={m.name} url={m.avatarUrl} size="sm" seed={m.userId} />{m.name}<span style={{ fontWeight: 400 }}>· {relTime(m.createdAt)}</span></div>}
            {content(p)}
            {extra?.(m, mine)}
          </div>
        ))}
        {pending.map((x) => (
          <div key={x.cid} className="rx-bub me" style={{ opacity: 0.75 }}>
            <Linked text={x.body} />
            <div className="rx-sm" role="status" style={{ marginTop: 4 }}>{x.status === 'waiting' ? 'Waiting to send' : 'Sending…'}</div>
          </div>
        ))}
      </div>

      {canSend ? (
        <div className="rx-chat-foot">
          {rec.isRecording ? recording : (
            <>
              {fileInput}
              <button type="button" className="rx-ib" aria-label="Add photo" disabled={busy} onClick={() => fileRef.current?.click()}><ImageIcon aria-hidden /></button>
              <input className="rx-in" placeholder={placeholder} aria-label={placeholder} value={draft} maxLength={2000} onChange={(e) => setDraft(e.target.value)} onKeyDown={onEnter} />
              <button type="button" className="rx-ib" aria-label="Record voice note" disabled={busy} onClick={() => { void rec.start(); }}><Mic aria-hidden /></button>
              <button type="button" className="rx-ib" aria-label="Send" disabled={busy || !draft.trim()} onClick={() => void submitText()}><Send aria-hidden /></button>
            </>
          )}
        </div>
      ) : (
        <div className="rx-chat-foot" style={{ justifyContent: 'space-between' }}>{notice}</div>
      )}
      {errorLine}
    </div>
  );
}
