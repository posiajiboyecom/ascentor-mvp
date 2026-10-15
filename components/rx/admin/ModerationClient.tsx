'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { removeContent, resolveItem, setMessagingBlocked } from '@/app/admin/moderation/actions';
import { useToast } from '@/components/rx/Toast';

export interface ModItem {
  source: 'flag' | 'report';
  id: string;
  kind: string;
  /** The post, comment or message this is about, when it is still there. */
  refId: string | null;
  reason: string;
  when: string;
  person: { id: string; name: string } | null;
  blocked: boolean;
  lines: { who: string; text: string }[];
}

export default function ModerationClient({ items }: { items: ModItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) => start(async () => {
    setError('');
    const r = await fn();
    if (!r.ok) { setError(r.error ?? 'Something went wrong.'); return; }
    toast(ok); router.refresh();
  });

  return (
    <div className="rx-stack">
      {items.length === 0 && <div className="rx-card rx-empty"><p className="rx-p">Nothing waiting. Reports and automatic flags appear here.</p></div>}
      {items.map((it) => (
        <div key={`${it.source}-${it.id}`} className="rx-card rx-stack">
          <div className="rx-between">
            <div><p className="rx-h3">{it.source === 'flag' ? 'Automatic flag' : 'Member report'} · {it.kind}</p><p className="rx-sm">{it.when}{it.person ? ` · ${it.person.name}` : ''}</p></div>
          </div>
          <p className="rx-p" style={{ fontSize: 15 }}>{it.reason || 'No reason given.'}</p>
          <div className="rx-stack-sm">
            {it.lines.map((l, i) => <div key={i} className="rx-bub oth" style={{ maxWidth: '100%' }}><div className="rx-who">{l.who}</div>{l.text}</div>)}
            {it.lines.length === 0 && <p className="rx-sm">The message is no longer available.</p>}
          </div>
          <div className="rx-row">
            <button type="button" className="rx-btn secondary" disabled={pending} onClick={() => run(() => resolveItem(it.source, it.id, 'dismissed'), 'Dismissed.')}>Dismiss</button>
            <button type="button" className="rx-btn secondary" disabled={pending} onClick={() => run(() => resolveItem(it.source, it.id, 'actioned'), 'Marked as handled.')}>Mark handled</button>
            {(it.kind === 'post' || it.kind === 'comment') && it.refId && (
              <button type="button" className="rx-btn primary" disabled={pending} onClick={() => run(async () => { const r = await removeContent(it.kind, it.refId!); if (r.ok) await resolveItem(it.source, it.id, 'actioned'); return r; }, it.kind === 'post' ? 'Post removed from the feed.' : 'Comment removed.')}>{it.kind === 'post' ? 'Remove post' : 'Remove comment'}</button>
            )}
            {it.person && (
              <button type="button" className="rx-btn secondary" disabled={pending} onClick={() => run(async () => { const r = await setMessagingBlocked(it.person!.id, !it.blocked); if (r.ok) await resolveItem(it.source, it.id, 'actioned'); return r; }, it.blocked ? 'Messaging and posting turned back on.' : 'Messaging and posting turned off for this member.')}>{it.blocked ? 'Turn messaging and posting back on' : 'Turn off messaging and posting'}</button>
            )}
          </div>
        </div>
      ))}
      {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}
    </div>
  );
}
