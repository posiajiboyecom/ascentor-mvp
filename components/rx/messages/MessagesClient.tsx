'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Ban, BellOff, Flag, Search, X } from 'lucide-react';
import ChatThread from '@/components/rx/ChatThread';
import type { ChatMsg } from '@/lib/rx/chat-types';
import { answerRequest, blockMember, markThreadRead, openThread, pollDm, reportThread, searchPeople, sendDm } from '@/app/(app)/messages/actions';
import { useToast } from '@/components/rx/Toast';
import { Avatar } from '@/components/rx/ui';
import { OnlineDot, useOnline } from '@/components/rx/messages/Presence';
import type { PersonItem, ThreadItem } from '@/lib/rx/messages';

export function ReachOutButton({ userId, name, label = 'Reach out personally', secondary = false }: { userId: string; name: string; label?: string; secondary?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  return (
    <>
      <button type="button" className={`rx-btn ${secondary ? 'secondary' : 'primary'}`} disabled={pending} aria-label={`${label}: ${name}`} onClick={() => start(async () => {
        const r = await openThread(userId);
        if (!r.ok) { setError(r.error); return; }
        router.push(`/messages?t=${r.threadId}`);
      })}>{pending ? 'Opening…' : label}</button>
      {error && <span className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</span>}
    </>
  );
}

export function RequestActions({ threadId, primary }: { threadId: string; primary: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const answer = (accept: boolean) => start(async () => {
    const r = await answerRequest(threadId, accept);
    if (!r.ok) { setError(r.error); return; }
    toast(accept ? 'Request accepted.' : 'Declined. They won’t be told.');
    if (accept) router.push(`/messages?t=${threadId}`); else router.refresh();
  });
  return (
    <>
      <button type="button" className={`rx-btn ${primary ? 'primary' : 'secondary'}`} disabled={pending} onClick={() => answer(true)}>Accept</button>
      <button type="button" className="rx-btn secondary" disabled={pending} onClick={() => answer(false)}>Decline</button>
      {error && <span className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</span>}
    </>
  );
}

export function ThreadActions({ threadId }: { threadId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();
  return (
    <>
      <button type="button" className="rx-ib" aria-label="Mute" onClick={() => toast('Conversation muted.')}><BellOff aria-hidden /></button>
      <button type="button" className="rx-ib" aria-label="Block" onClick={() => start(async () => {
        const r = await blockMember(threadId);
        toast(r.ok ? 'Blocked. They can’t message you.' : r.error);
        if (r.ok) router.push('/messages');
      })}><Ban aria-hidden /></button>
      <button type="button" className="rx-ib" aria-label="Report" onClick={() => start(async () => {
        const r = await reportThread('dm', threadId);
        toast(r.ok ? 'Reported. Our safety team will review it.' : r.error);
      })}><Flag aria-hidden /></button>
    </>
  );
}

export function DmChat({ threadId, meId, meName, meAvatarUrl, initial, canSend, notice, intro, peerReadAt, wasUnread = false, composer = 'area' }: {
  threadId: string; meId: string; meName: string; meAvatarUrl: string | null; initial: ChatMsg[]; canSend: boolean; notice?: React.ReactNode;
  intro?: React.ReactNode; peerReadAt?: string | null; wasUnread?: boolean; composer?: 'area' | 'mini';
}) {
  const router = useRouter();

  // Opening a conversation marks it read. The list and the header dot then refresh once.
  useEffect(() => {
    let live = true;
    void markThreadRead(threadId).then((r) => { if (live && r.ok && r.changed && wasUnread) router.refresh(); });
    return () => { live = false; };
  }, [threadId, wasUnread, router]);

  const poll = useCallback(async (a: string | null) => {
    const msgs = await pollDm(threadId, a);
    if (msgs.some((m) => m.userId !== meId) && document.visibilityState === 'visible') void markThreadRead(threadId);
    return msgs;
  }, [threadId, meId]);
  const send = useCallback((b: string, cid?: string) => sendDm(threadId, b, cid), [threadId]);
  const realtime = useMemo(() => ({ table: 'dm_messages', column: 'thread_id', value: threadId }), [threadId]);

  return (
    <ChatThread
      layout="linkedin" composer={composer} intro={intro} peerReadAt={peerReadAt} meInfo={{ name: meName, avatarUrl: meAvatarUrl }}
      initial={initial} meId={meId} canSend={canSend} notice={notice}
      send={send} outbox={{ kind: 'dm_message', payload: (body) => ({ threadId, body }) }} poll={poll}
      realtime={realtime}
      placeholder="Write a message…"
    />
  );
}

/** Conversation header: avatar with the online dot, name, "Active now" when they are on, and the thread actions. */
export function DmHeader({ threadId, otherId, name, avatarUrl, meta, presence = false }: { presence?: boolean; threadId: string; otherId: string; name: string; avatarUrl: string | null; meta: string }) {
  const online = useOnline();
  const on = presence && online.has(otherId);
  return (
    <div className="rxm-cvhead">
      <Link href="/messages" className="rx-ib rx-mob" aria-label="Back to inbox"><ArrowLeft aria-hidden /></Link>
      <Link href={`/messages?t=${threadId}&view=card`} className="rxm-avw" aria-label="View profile">
        <Avatar name={name} url={avatarUrl} seed={otherId} />{on && <OnlineDot />}
      </Link>
      <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
        <p className="rx-h3" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{name}</p>
        <p className="rx-sm" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{on ? 'Active now' : meta}</p>
      </div>
      <ThreadActions threadId={threadId} />
    </div>
  );
}

/** The left pane: title, new message button, search, All / Unread / Requests tabs and the thread list. Requests are rendered by the page. */
export function InboxPane({ threads, selected, tab, requestCount, requests }: { threads: ThreadItem[]; selected: string | null; tab: 'inbox' | 'requests'; requestCount: number; requests: React.ReactNode }) {
  const online = useOnline();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [q, setQ] = useState('');
  const unreadN = threads.filter((t) => t.unread).length;
  const needle = q.trim().toLowerCase();
  const shown = threads
    .filter((t) => filter === 'all' || t.unread)
    .filter((t) => !needle || t.name.toLowerCase().includes(needle) || t.last.toLowerCase().includes(needle));
  const hrefOf = (t: ThreadItem) => `/messages?t=${t.key}`;

  return (
    <div className="rx-page rxm-mpg" style={{ paddingBottom: 24 }}>
      <div className="rxm-mhead">
        <h1 className="rx-title">Messaging</h1>
        <Link href="/messages?new=1" className="rx-ib" aria-label="New message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13 7l4 4" /></svg>
        </Link>
      </div>
      <span className="rx-rule" />
      <label className="rxm-search"><Search aria-hidden /><input placeholder="Search messages" aria-label="Search messages" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <div className="rx-opts rxm-list-opts" style={{ marginBottom: 8 }}>
        {tab === 'inbox' ? (
          <>
            <button type="button" onClick={() => setFilter('all')} className={`rx-opt${filter === 'all' ? ' on' : ''}`}>All</button>
            <button type="button" onClick={() => setFilter('unread')} className={`rx-opt${filter === 'unread' ? ' on' : ''}`}>Unread · {unreadN}</button>
          </>
        ) : (
          <>
            <Link href="/messages" onClick={() => setFilter('all')} className="rx-opt">All</Link>
            <Link href="/messages" onClick={() => setFilter('unread')} className="rx-opt">Unread · {unreadN}</Link>
          </>
        )}
        <Link href="/messages?tab=requests" className={`rx-opt${tab === 'requests' ? ' on' : ''}`}>Requests · {requestCount}</Link>
      </div>

      {tab === 'inbox' && (threads.length === 0 ? (
        <div className="rx-empty"><p className="rx-p">No messages yet.</p><Link href="/community" className="rx-btn secondary">Visit Community</Link></div>
      ) : (
        <div className="rxm-tlist">
          {shown.map((t) => (
            <Link key={t.key} href={hrefOf(t)} className={`rxm-thr${selected === t.key ? ' on' : ''}${t.unread ? ' unread' : ''}`} aria-current={selected === t.key ? 'true' : undefined}>
              <span className="rxm-avw"><Avatar name={t.name} url={t.avatarUrl} seed={t.seed} />{t.kind === 'dm' && t.otherId && online.has(t.otherId) && <OnlineDot />}</span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="sb"><span className="tn">{t.name}</span><span className="sm" style={{ flex: 'none' }}>{t.time}</span></span>
                <span className="sb"><span className="tl">{t.last}</span>{t.unread && <span className="rxm-udot" role="img" aria-label="Unread" />}</span>
              </span>
            </Link>
          ))}
          {shown.length === 0 && <p className="rx-sm" style={{ padding: 20 }}>{filter === 'unread' && !needle ? 'You’re all caught up.' : 'No conversations match.'}</p>}
        </div>
      ))}
      {tab === 'requests' && requests}
    </div>
  );
}

/** "New message": To field, suggestions from the member's Circle, and a name search across members. */
export function NewMessagePane({ suggested, preselect }: { suggested: PersonItem[]; preselect: PersonItem | null }) {
  const router = useRouter();
  const online = useOnline();
  const [q, setQ] = useState(preselect?.name ?? '');
  const [found, setFound] = useState<PersonItem[] | null>(preselect ? [preselect] : null);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (preselect && term === preselect.name) { setFound([preselect]); return; }
    if (term.length < 2) { setFound(null); return; }
    const n = ++seq.current;
    const t = setTimeout(() => { void searchPeople(term).then((r) => { if (n === seq.current) setFound([...r].sort((a, b) => Number(b.inCircle) - Number(a.inCircle))); }); }, 250);
    return () => clearTimeout(t);
  }, [q, preselect]);

  const needle = q.trim().toLowerCase();
  const list = found ?? suggested.filter((p) => !needle || p.name.toLowerCase().includes(needle));
  const pick = (p: PersonItem) => start(async () => {
    setError('');
    const r = await openThread(p.id);
    if (!r.ok) { setError(r.error); return; }
    router.push(`/messages?t=${r.threadId}`);
  });

  return (
    <div className="rxm-cv">
      <div className="rxm-cvhead">
        <Link href="/messages" className="rx-ib rx-mob" aria-label="Back to inbox"><ArrowLeft aria-hidden /></Link>
        <p className="rx-h3" style={{ flex: 1, paddingLeft: 6, margin: 0 }}>New message</p>
        <Link href="/messages" className="rx-ib" aria-label="Close new message"><X aria-hidden /></Link>
      </div>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--rx-border)' }}>
        <input className="rx-in" placeholder="Type a name" aria-label="To" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      <div className="rxm-lmsgs" style={{ paddingTop: 12 }}>
        {found === null && <p className="rxm-sl">Suggested · your Circle</p>}
        {list.map((p) => (
          <button key={p.id} type="button" className="rxm-li" disabled={pending} onClick={() => pick(p)}>
            <span className="rxm-avw"><Avatar name={p.name} url={p.avatarUrl} seed={p.id} />{p.inCircle && online.has(p.id) && <OnlineDot />}</span>
            <span style={{ flex: 1, minWidth: 0 }}><span className="rx-strong" style={{ display: 'block' }}>{p.name}</span><span className="rx-sm">{p.meta}</span></span>
          </button>
        ))}
        {list.length === 0 && <p className="rx-sm" style={{ padding: 8 }}>{found === null ? 'No one by that name in your Circle.' : 'No members found with that name.'}</p>}
        {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)', padding: 8 }}>{error}</p>}
        <p className="rx-sm" style={{ marginTop: 14 }}>You can message your Circle and your mentor straight away. Anyone else gets a message request first.</p>
      </div>
    </div>
  );
}

export function ProfileLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="rx-link">{children}<ArrowRight aria-hidden /></Link>;
}
