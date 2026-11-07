'use client';

// In-call chat. Messages travel only between the people in the call (Daily sendAppMessage) and are never stored:
// calls are not recorded, and that includes their chat. Someone who joins late receives the messages so far from the
// member who has been in the call longest. When the call ends, the chat is gone.

import { useEffect, useRef, useState } from 'react';

export interface ChatMsg { id: string; fromId: string; name: string; text: string; at: number; mine: boolean }
export type ChatWire =
  | { type: 'chat'; id: string; text: string; at: number }
  | { type: 'chat-history'; items: { id: string; name: string; text: string; at: number }[] };

export const CHAT_MAX = 500;        // characters per message
export const CHAT_KEEP = 200;       // messages kept on screen (and offered to late joiners)
const WIRE_BUDGET = 3500;           // Daily app messages are limited to about 4 KB each

/** Adds messages, dropping duplicates (by id), in time order, keeping the most recent CHAT_KEEP. */
export function mergeChat(prev: ChatMsg[], add: ChatMsg[]): ChatMsg[] {
  const seen = new Set(prev.map((m) => m.id));
  const fresh = add.filter((m) => !seen.has(m.id) && (seen.add(m.id), true));
  if (!fresh.length) return prev;
  return [...prev, ...fresh].sort((a, b) => a.at - b.at).slice(-CHAT_KEEP);
}

/** Cleans an incoming message; null if it isn't a valid chat message. */
export function cleanText(t: unknown): string | null {
  if (typeof t !== 'string') return null;
  const s = t.replace(/\s+$/g, '').replace(/^\s+/g, '').slice(0, CHAT_MAX);
  return s ? s : null;
}

/** Splits the history into app-message-sized batches. */
export function historyBatches(msgs: ChatMsg[]): ChatWire[] {
  const out: ChatWire[] = [];
  let cur: { id: string; name: string; text: string; at: number }[] = [];
  let size = 0;
  for (const m of msgs) {
    const item = { id: m.id, name: m.name.slice(0, 40), text: m.text, at: m.at };
    const n = JSON.stringify(item).length + 1;
    if (cur.length && size + n > WIRE_BUDGET) { out.push({ type: 'chat-history', items: cur }); cur = []; size = 0; }
    cur.push(item); size += n;
  }
  if (cur.length) out.push({ type: 'chat-history', items: cur });
  return out;
}

/** Plain text with web links made clickable (React escapes everything else). */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"']+)/g);
  return <>{parts.map((p, i) => (/^https?:\/\//.test(p)
    ? <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow">{p}</a>
    : <span key={i}>{p}</span>))}</>;
}

const hhmm = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function ChatPanel({ messages, onSend, autoFocus }: { messages: ChatMsg[]; onSend: (text: string) => void; autoFocus?: boolean }) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [messages.length]);
  useEffect(() => { if (autoFocus) inputRef.current?.focus({ preventScroll: true }); }, [autoFocus]);

  const send = () => {
    const t = cleanText(draft);
    if (!t) return;
    onSend(t);
    setDraft('');
    inputRef.current?.focus();
  };

  return (
    <div className="sg-chat">
      <ol className="sg-chat-list" ref={listRef} aria-label="Chat messages" aria-live="polite">
        {messages.length === 0 && <li className="sg-chat-empty">Messages here are seen only by people in this call and disappear when it ends.</li>}
        {messages.map((m, i) => {
          const grouped = i > 0 && messages[i - 1].fromId === m.fromId && m.at - messages[i - 1].at < 120000;
          return (
            <li key={m.id} className={`sg-msg${m.mine ? ' mine' : ''}${grouped ? ' grouped' : ''}`}>
              {!grouped && <div className="sg-msg-h"><b>{m.mine ? 'You' : m.name}</b><time>{hhmm(m.at)}</time></div>}
              <div className="sg-msg-b"><Linkified text={m.text} /></div>
            </li>
          );
        })}
      </ol>
      <form className="sg-chat-f" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <textarea
          ref={inputRef}
          rows={1}
          value={draft}
          maxLength={CHAT_MAX}
          placeholder="Message everyone"
          aria-label="Message everyone in the call"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
        />
        <button type="submit" className="sg-chat-send" disabled={!draft.trim()} aria-label="Send message">
          <svg viewBox="0 0 24 24" aria-hidden><path d="M4 12l16-8-6 16-2.5-6.5z" /><path d="M11.5 13.5L20 4" /></svg>
        </button>
      </form>
    </div>
  );
}
