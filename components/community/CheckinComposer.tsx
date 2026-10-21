'use client';

// components/community/CheckinComposer.tsx
// Modal for writing this week's ritual check-in. Posts to /api/community/checkin
// (one per week - a 409 comes back friendly). On success the parent updates the
// hero + circle status optimistically from the returned message.

import { useState } from 'react';
import { POSTABLE_DIMENSIONS, DIMENSION_META, type Message } from './types';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { enqueue, outboxOn, subscribeOutbox, flushOutbox } from '@/lib/outbox';
import { useEffect } from 'react';

export function CheckinComposer({
  prompt,
  onClose,
  onDone,
}: {
  prompt: string;
  onClose: () => void;
  onDone: (message: Message) => void;
}) {
  const [draft, setDraft] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queuedId, setQueuedId] = useState<string | null>(null);   // set while the check-in waits in the outbox
  const MAX = 2000;

  // When a waiting check-in goes through (or the server says it already has one), finish as if it had been sent now.
  useEffect(() => {
    if (!queuedId) return;
    return subscribeOutbox((e) => {
      if (e.item.id !== queuedId) return;
      if (e.type === 'sent') { const m = e.data as Message | undefined; if (m && m.id) onDone(m); else onClose(); }
      else if (e.type === 'dropped') { setQueuedId(null); setError(e.error || 'Check-in failed. Try again.'); }
    });
  }, [queuedId, onDone]);

  async function queueIt() {
    try {
      const { data } = await createClient().auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) throw new Error('no session');
      const item = await enqueue({ userId: uid, kind: 'checkin', payload: { content: draft.trim(), dimensionTag: tag } });
      setQueuedId(item.id);
      void flushOutbox();
    } catch { setError('Check-in failed, check your connection.'); }
  }

  async function submit() {
    if (!draft.trim() || submitting || queuedId) return;
    setSubmitting(true);
    setError(null);
    if (outboxOn('checkin') && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await queueIt();
      setSubmitting(false);
      return;
    }
    try {
      const res = await fetch('/api/community/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft.trim(), dimensionTag: tag }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Check-in failed. Try again.');
        return;
      }
      onDone(data.message as Message);
    } catch {
      // No answer. The server allows one check-in a week, so sending it again later is safe.
      if (outboxOn('checkin')) await queueIt(); else setError('Check-in failed, check your connection.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/60 backdrop-blur-sm p-0 lg:p-6"
      onClick={onClose}
    >
      <div
        className="w-full lg:max-w-lg rounded-t-2xl lg:rounded-2xl border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b-[0.5px] border-[var(--color-border-tertiary)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#C8A96E]">This week&apos;s ascent</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--color-text-secondary)] text-lg leading-none">
            <X size={13} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-4">
          <h3 className="text-xl leading-snug text-[var(--color-text-primary)] mb-4" style={{ fontFamily: 'var(--font-accent)' }}>
            {prompt}
          </h3>

          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
            placeholder="Answer honestly. This goes to your circle."
            rows={5}
            className="w-full resize-none rounded-xl border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3 text-[15px] leading-relaxed text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96E]"
          />

          <div className="flex flex-wrap gap-1.5 mt-3">
            {POSTABLE_DIMENSIONS.map((dim) => {
              const meta = DIMENSION_META[dim];
              const on = tag === dim;
              return (
                <button
                  key={dim}
                  type="button"
                  onClick={() => setTag((t) => (t === dim ? null : dim))}
                  className="rounded-full border-[0.5px] px-2.5 py-1 text-[11px] font-medium transition-colors"
                  style={{
                    color: on ? meta.color : 'var(--color-text-secondary)',
                    backgroundColor: on ? meta.bg : 'transparent',
                    borderColor: on ? meta.border : 'var(--color-border-tertiary)',
                  }}
                >
                  <meta.Icon size={13} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />{dim}
                </button>
              );
            })}
          </div>

          {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t-[0.5px] border-[var(--color-border-tertiary)]">
          <span className="text-xs text-[var(--color-text-secondary)]">{draft.length > 0 && `${draft.length}/${MAX}`}</span>
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim() || submitting || !!queuedId}
            className="rounded-full bg-[#C8A96E] px-6 py-2 text-sm font-semibold text-[#0F0F0E] disabled:opacity-40"
          >
            {queuedId ? 'Waiting to send' : submitting ? 'Sending…' : 'Check in →'}
          </button>
        </div>
      </div>
    </div>
  );
}
