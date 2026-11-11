'use client';

import { members } from '@/lib/rx/plural';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, MessageSquare, Search } from 'lucide-react';
import type { GroupView } from '@/lib/rx/community';
import type { ChatMsg } from '@/lib/rx/chat-types';
import { declineOpenHouse, joinGroup, leaveGroup, pollGroupMessages, requestGroup, sendGroupMessage } from '@/app/(app)/community/actions';
import ChatThread from '@/components/rx/ChatThread';
import { useToast } from '@/components/rx/Toast';

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
        : g.locked ? <span className="rx-sm" style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{g.locked}</span>
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
      <p className="rx-sm">{members(count)}</p>
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
