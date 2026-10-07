'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, MessageSquare, Pin, Search, Send } from 'lucide-react';
import { DIMENSIONS, POST_TYPES } from '@/lib/rx/constants';
import type { PostView, ReplyView, GroupView } from '@/lib/rx/community';
import type { ChatMsg } from '@/lib/rx/chat-types';
import { createPost, declineOpenHouse, joinGroup, leaveGroup, pollGroupMessages, replyToPost, requestGroup, sendGroupMessage, deletePost } from '@/app/(app)/community/actions';
import ChatThread from '@/components/rx/ChatThread';
import { Avatar, Tag } from '@/components/rx/ui';
import { useToast } from '@/components/rx/Toast';

// ── compose ─────────────────────────────────────────────────────────────────
export function Compose() {
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState('');
  const [type, setType] = useState<string>('Question');
  const [dim, setDim] = useState<string>('Vocation');
  const [sub, setSub] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  return (
    <div className="rx-card rx-stack">
      <label htmlFor="cmp" className="rx-label">Share with the community</label>
      <textarea id="cmp" className="rx-in" style={{ minHeight: 76 }} placeholder="A question, a win, a reflection or a resource" value={text} maxLength={1500} onChange={(e) => setText(e.target.value)} />
      <div className="rx-opts">{POST_TYPES.map((t) => <button key={t} type="button" className="rx-opt" aria-pressed={type === t} onClick={() => setType(t)}>{t}</button>)}</div>
      <div className="rx-row" style={{ gap: 8 }} role="group" aria-label="Dimension tag">
        {DIMENSIONS.map((d) => <button key={d} type="button" className="rx-chip" aria-pressed={dim === d} onClick={() => setDim(d)}>{dim === d && <Check aria-hidden />}{d}</button>)}
      </div>
      <div className="rx-row rx-nw">
        <input className="rx-in" style={{ flex: 1 }} placeholder="Subtopic (optional)" aria-label="Subtopic" value={sub} maxLength={60} onChange={(e) => setSub(e.target.value)} />
        <button type="button" className="rx-btn primary" disabled={pending} onClick={() => start(async () => {
          setError('');
          if (!text.trim()) { setError('Write something first.'); return; }
          const r = await createPost({ text, type, dimension: dim, sub });
          if (!r.ok) { setError(r.error); return; }
          setText(''); setSub('');
          toast(type === 'Win' ? 'Posted. It’s on the Wins board too.' : 'Posted to the feed.');
          router.refresh();
        })}>{pending ? 'Posting…' : 'Post'}</button>
      </div>
      {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}
    </div>
  );
}

// ── replies ─────────────────────────────────────────────────────────────────
function Replies({ replies, onSend, label }: { replies: ReplyView[]; onSend: (body: string) => Promise<string | null>; label: string }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="rx-stack-sm rx-rise">
      {replies.map((r) => <div key={r.id} className="rx-bub oth" style={{ maxWidth: '100%' }}><div className="rx-who">{r.name}</div>{r.body}</div>)}
      <div className="rx-row rx-nw" style={{ gap: 6 }}>
        <input className="rx-in" style={{ borderRadius: 999 }} placeholder="Write a reply" aria-label={label} value={draft} maxLength={1000} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (draft.trim()) start(async () => { const err = await onSend(draft); if (err) setError(err); else { setDraft(''); setError(''); } }); } }} />
        <button type="button" className="rx-ib" aria-label="Send reply" disabled={pending || !draft.trim()} onClick={() => start(async () => { const err = await onSend(draft); if (err) setError(err); else { setDraft(''); setError(''); } })}><Send aria-hidden /></button>
      </div>
      {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}
    </div>
  );
}

export function PostCard({ post }: { post: PostView }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const label = open ? 'Hide replies' : post.replies.length ? `${post.replies.length} ${post.replies.length === 1 ? 'reply' : 'replies'} · Reply` : 'Reply';
  return (
    <div className="rx-card rx-stack-sm rx-rise">
      <div className="rx-row rx-nw" style={{ gap: 10 }}>
        <Avatar name={post.name} url={post.avatarUrl} seed={post.userId} />
        <span className="rx-strong" style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.name}</span>
        <span className="rx-sm">{post.time}</span>
      </div>
      <div className="rx-row" style={{ gap: 6 }}><Tag>{post.type}</Tag>{post.dimension && <Tag gold>{post.dimension}</Tag>}{post.sub && <Tag>{post.sub}</Tag>}</div>
      <p className="rx-p">{post.body}</p>
      <div className="rx-row">
        <button type="button" className="rx-link" style={{ minHeight: 36, fontSize: 14 }} onClick={() => setOpen((o) => !o)}>{label}<ArrowRight aria-hidden /></button>
        {post.mine && <button type="button" className="rx-link muted" style={{ minHeight: 36, fontSize: 13 }} onClick={() => start(async () => { const r = await deletePost(post.id); toast(r.ok ? 'Post removed.' : r.error); router.refresh(); })}>Delete</button>}
      </div>
      {open && <Replies replies={post.replies} label="Write a reply" onSend={async (b) => { const r = await replyToPost(post.id, b); if (!r.ok) return r.error; toast('Reply posted.'); router.refresh(); return null; }} />}
    </div>
  );
}

export function PromptCard({ id, body, replies, count }: { id: string; body: string; replies: ReplyView[]; count: number }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  return (
    <div className="rx-card rx-stack-sm">
      <div className="rx-row rx-nw" style={{ gap: 8 }}><Pin aria-hidden style={{ width: 16, height: 16, color: 'var(--rx-muted)' }} /><p className="rx-label">Pinned · this week’s prompt</p></div>
      <p className="rx-h3">{body}</p>
      <p className="rx-sm">From the Ascentor team · {count} {count === 1 ? 'reply' : 'replies'}</p>
      <div><button type="button" className="rx-link" onClick={() => setOpen((o) => !o)}>{open ? 'Hide replies' : 'Reply'}<ArrowRight aria-hidden /></button></div>
      {open && <Replies replies={replies} label="Reply to the weekly prompt" onSend={async (b) => { const r = await replyToPost(id, b); if (!r.ok) return r.error; toast('Reply posted.'); router.refresh(); return null; }} />}
    </div>
  );
}

// ── groups ──────────────────────────────────────────────────────────────────
function GroupCard({ g }: { g: GroupView }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <div className="rx-card" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: 16 }}>
      <span className="rx-dimdot"><MessageSquare aria-hidden /></span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Link href={`/community/groups/${g.slug}`} className="rx-h3" style={{ color: 'inherit', textDecoration: 'none' }}>{g.name}</Link>
        <p className="rx-sm">{g.description}</p>
        <p className="rx-sm">{g.count} {g.count === 1 ? 'member' : 'members'}{g.isNew ? ' · New' : ''}</p>
        {g.reason && <p className="rx-p" style={{ fontSize: 14, marginTop: 4 }}>{g.reason}</p>}
      </div>
      {g.joined
        ? <Link href={`/community/groups/${g.slug}`} className="rx-btn secondary">Open</Link>
        : <button type="button" className="rx-btn secondary" disabled={pending} onClick={() => start(async () => {
            const r = await joinGroup(g.id);
            toast(r.ok ? `You joined ${g.name}.` : r.error);
            router.refresh();
          })}>Join</button>}
    </div>
  );
}

export function OpenHouseInvite({ id, count }: { id: string; count: number }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <div className="rx-card rx-stack-sm rx-rise">
      <div className="rx-row rx-nw" style={{ gap: 12 }}><span className="rx-dimdot"><MessageSquare aria-hidden /></span><div style={{ minWidth: 0 }}><p className="rx-p rx-strong">You’re invited to Open house</p><p className="rx-sm">A general group for every member. Say hello, ask anything.</p></div></div>
      <p className="rx-sm">{count} members</p>
      <div className="rx-row">
        <button type="button" className="rx-btn primary" disabled={pending} onClick={() => start(async () => { const r = await joinGroup(id); toast(r.ok ? 'You joined Open house.' : r.error); router.refresh(); })}>Join</button>
        <button type="button" className="rx-link" disabled={pending} onClick={() => start(async () => { await declineOpenHouse(); toast('No problem. Open house is in Groups any time.'); router.refresh(); })}>Not now</button>
      </div>
    </div>
  );
}

export function GroupDirectory({ groups, suggested, facilitators }: { groups: GroupView[]; suggested: GroupView[]; facilitators: GroupView | null }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const list = useMemo(() => groups.filter((g) => !query || g.name.toLowerCase().includes(query) || g.description.toLowerCase().includes(query)), [groups, query]);
  return (
    <div className="rx-stack-lg">
      <label className="rx-in" style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 'none' }}>
        <Search aria-hidden style={{ width: 20, height: 20, color: 'var(--rx-muted)' }} />
        <input style={{ border: 0, outline: 0, background: 'none', flex: 1, height: 44, fontSize: 16, fontFamily: 'inherit' }} placeholder="Search groups" aria-label="Search groups" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {!query && suggested.length > 0 && (
        <div className="rx-stack-sm"><p className="rx-label">Suggested for you</p>{suggested.map((g) => <GroupCard key={g.id} g={g} />)}</div>
      )}
      <div className="rx-stack-sm">
        <p className="rx-label">{query ? 'Results' : 'All groups'}</p>
        {list.map((g) => <GroupCard key={g.id} g={g} />)}
        {list.length === 0 && <div className="rx-empty"><p className="rx-p">No group matches that yet.</p><RequestGroup /></div>}
      </div>
      {facilitators && (
        <div className="rx-stack-sm">
          <p className="rx-label">Private · facilitators only</p>
          <GroupCard g={{ ...facilitators, joined: true }} />
        </div>
      )}
    </div>
  );
}

export function RequestGroup({ link = false }: { link?: boolean }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  return (
    <>
      {link
        ? <button type="button" className="rx-link" onClick={() => setOpen((o) => !o)}>Request a group<ArrowRight aria-hidden /></button>
        : <button type="button" className="rx-btn secondary" onClick={() => setOpen((o) => !o)}>Request a group</button>}
      {open && (
        <div className="rx-stack-sm rx-rise" style={{ width: '100%' }}>
          <input className="rx-in" aria-label="The group you’d like" placeholder="What would you like a group for?" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} />
          <div><button type="button" className="rx-btn primary" disabled={pending} onClick={() => start(async () => {
            const r = await requestGroup(text);
            if (!r.ok) { setError(r.error); return; }
            setOpen(false); setText(''); setError(''); toast('Thanks. Requests help us decide which groups to open.');
          })}>Send request</button></div>
          {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}
        </div>
      )}
    </>
  );
}

export function GroupRoomChat({ groupId, meId, initial, joined, name }: { groupId: string; meId: string; initial: ChatMsg[]; joined: boolean; name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <ChatThread
      initial={initial} meId={meId} canSend={joined}
      send={(b) => sendGroupMessage(groupId, b)} poll={(a) => pollGroupMessages(groupId, a)}
      realtime={{ table: 'rx_group_messages', column: 'group_id', value: groupId }}
      placeholder="Message the group"
      notice={<>
        <span className="rx-sm">Join to post in this group.</span>
        <button type="button" className="rx-btn primary" disabled={pending} onClick={() => start(async () => { const r = await joinGroup(groupId); toast(r.ok ? `You joined ${name}.` : r.error); router.refresh(); })}>Join group</button>
      </>}
    />
  );
}

export function LeaveGroupButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return <button type="button" className="rx-link muted" disabled={pending} onClick={() => start(async () => { const r = await leaveGroup(groupId); toast(r.ok ? 'You left the group.' : r.error); router.refresh(); })}>Leave group</button>;
}
