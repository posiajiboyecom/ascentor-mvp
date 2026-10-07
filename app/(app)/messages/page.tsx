// app/(app)/messages/page.tsx
// Messages: inbox, message requests, a conversation, and the other member's profile card.
// Three panes on desktop; one pane at a time on mobile, chosen by the URL.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, TriangleAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/rx/server';
import { dmMessages, listRequests, listThreads, memberCard } from '@/lib/rx/messages';
import { looksLikeScam } from '@/lib/rx/safety';
import { Avatar, Tag } from '@/components/rx/ui';
import { DmChat, RequestActions, ThreadActions } from '@/components/rx/messages/MessagesClient';

export const dynamic = 'force-dynamic';

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ tab?: string; t?: string; view?: string }> }) {
  const sp = await searchParams;
  const me = await getMe();
  if (!me) redirect('/login');
  const db = await createClient();

  const [threads, requests] = await Promise.all([listThreads(), listRequests()]);
  const tab = sp.tab === 'requests' ? 'requests' : 'inbox';
  const selected = sp.t ?? null;

  // The selected conversation, if it is a direct message.
  let convo: null | { id: string; otherId: string; name: string; avatarUrl: string | null; status: string; iRequested: boolean; msgs: Awaited<ReturnType<typeof dmMessages>>; flagged: boolean } = null;
  if (selected && !selected.startsWith('g:') && selected !== 'circle') {
    const { data: t } = await db.from('dm_threads').select('id, user_a, user_b, requested_by, status').eq('id', selected).maybeSingle();
    if (t) {
      const otherId = t.user_a === me.userId ? t.user_b : t.user_a;
      const [card, msgs] = await Promise.all([memberCard(otherId), dmMessages(db, t.id)]);
      convo = { id: t.id, otherId, name: card?.name ?? 'Member', avatarUrl: card?.avatarUrl ?? null, status: t.status, iRequested: t.requested_by === me.userId, msgs, flagged: msgs.some((m) => m.userId !== me.userId && looksLikeScam(m.body)) };
    }
  }
  const card = convo ? await memberCard(convo.otherId) : null;
  const pane: 'list' | 'convo' | 'card' = convo && sp.view === 'card' ? 'card' : convo ? 'convo' : 'list';

  return (
    <div className="rx rx-panes" data-pane={pane}>
      {/* ── list pane ── */}
      <div className="rx-pane rx-pane-list">
        <div className="rx-page" style={{ paddingBottom: 24, paddingTop: 24 }}>
          <h1 className="rx-title">Messages</h1><span className="rx-rule" />
          <div className="rx-opts" style={{ marginBottom: 12 }}>
            <Link href="/messages" className={`rx-opt${tab === 'inbox' ? ' on' : ''}`}>Inbox</Link>
            <Link href="/messages?tab=requests" className={`rx-opt${tab === 'requests' ? ' on' : ''}`}>Requests · {requests.length}</Link>
          </div>

          {tab === 'inbox' && (threads.length === 0 ? (
            <div className="rx-empty"><p className="rx-p">No messages yet.</p><Link href="/community" className="rx-btn secondary">Visit Community</Link></div>
          ) : (
            <div className="rx-stack-sm" style={{ gap: 2 }}>
              {threads.map((t) => {
                const href = t.kind === 'circle' ? '/circle/chat' : t.kind === 'group' ? `/community/groups/${t.key.slice(2)}` : `/messages?t=${t.key}`;
                return (
                  <Link key={t.key} href={href} className="rx-li" aria-current={selected === t.key ? 'true' : undefined}>
                    <Avatar name={t.name} url={t.avatarUrl} seed={t.seed} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="rx-between"><span className="rx-strong" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span><span className="rx-sm">{t.time}</span></span>
                      <span className="rx-sm" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.last}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}

          {tab === 'requests' && (
            <div className="rx-stack">
              <p className="rx-sm">First messages from outside your Circle wait here.</p>
              {requests.length === 0 && <p className="rx-sm">No requests right now.</p>}
              {requests.map((r, i) => (
                <div key={r.threadId} className="rx-card rx-stack-sm">
                  <div className="rx-row rx-nw"><Avatar name={r.name} url={r.avatarUrl} seed={r.fromId} /><div style={{ flex: 1, minWidth: 0 }}><p className="rx-p rx-strong">{r.name}</p><p className="rx-sm">{[r.stage, r.city].filter(Boolean).join(' · ') || 'Not in your Circle'} · not in your Circle</p></div></div>
                  {r.flagged && <div className="rx-banner" role="note"><TriangleAlert aria-hidden style={{ width: 20, height: 20, flex: 'none' }} /><div><b>Be careful.</b> This asks for payment and has an unknown link.</div></div>}
                  <p className="rx-p" style={{ fontSize: 15 }}>{r.text}</p>
                  <div className="rx-row">
                    <RequestActions threadId={r.threadId} primary={!r.flagged && requests.findIndex((x) => !x.flagged) === i} />
                    <Link href={`/messages?t=${r.threadId}&view=card`} className="rx-link">Profile</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── conversation pane ── */}
      <div className="rx-pane rx-pane-convo">
        {convo ? (
          <div className="rx-chat" style={{ height: '100%' }}>
            <div className="rx-chat-head">
              <Link href="/messages" className="rx-ib rx-mob" aria-label="Back to inbox"><ArrowLeft aria-hidden /></Link>
              <Link href={`/messages?t=${convo.id}&view=card`} aria-label="View profile"><Avatar name={convo.name} url={convo.avatarUrl} seed={convo.otherId} /></Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="rx-h3" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{convo.name}</p>
                <p className="rx-sm">{convo.status === 'request' ? 'Message request' : 'Direct message'}</p>
              </div>
              <ThreadActions threadId={convo.id} />
            </div>
            {convo.flagged && (
              <div style={{ padding: '12px 16px 0' }}><div className="rx-banner" role="note"><TriangleAlert aria-hidden style={{ width: 20, height: 20, flex: 'none' }} /><div><b>This asks for payment and has an unknown link.</b> Don’t send money or codes. Ascentor never asks for payment in chat.</div></div></div>
            )}
            <div style={{ flex: 1, minHeight: 0 }}>
              <DmChat
                threadId={convo.id} meId={me.userId} initial={convo.msgs}
                canSend={convo.status === 'accepted' || (convo.status === 'request' && convo.iRequested && convo.msgs.length === 0)}
                notice={convo.status === 'request' && !convo.iRequested
                  ? <span className="rx-sm">Accept this request from the Requests tab to reply.</span>
                  : <span className="rx-sm">{convo.status === 'request' ? 'Waiting for them to accept your request.' : 'This conversation is closed.'}</span>}
              />
            </div>
          </div>
        ) : (
          <div className="rx-empty rx-dsk" style={{ height: '100%', justifyContent: 'center' }}><p className="rx-p">Choose a conversation.</p></div>
        )}
      </div>

      {/* ── profile card pane ── */}
      <div className="rx-pane rx-pane-card">
        {convo && (
          <div className="rx-page" style={{ paddingTop: 24 }}>
            <Link href={`/messages?t=${convo.id}`} className="rx-link muted rx-mob"><ArrowLeft aria-hidden style={{ transform: 'none' }} />Conversation</Link>
            <div className="rx-stack-sm" style={{ alignItems: 'flex-start', marginTop: 8 }}>
              <Avatar name={convo.name} url={convo.avatarUrl} size="lg" seed={convo.otherId} />
              <p className="rx-h2">{convo.name}</p>
              {card && <>
                <div className="rx-row" style={{ gap: 6 }}>{card.stage && <Tag>{card.stage}</Tag>}{card.city && <Tag>{card.city}</Tag>}</div>
                <p className="rx-label" style={{ marginTop: 8 }}>Interests</p>
                <div className="rx-row" style={{ gap: 6 }}>{card.interests.length ? card.interests.map((t) => <Tag key={t}>{t}</Tag>) : <span className="rx-sm">Not shared</span>}</div>
              </>}
              <div style={{ marginTop: 12 }}><Link href={`/messages?t=${convo.id}`} className="rx-btn secondary">Message</Link></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
