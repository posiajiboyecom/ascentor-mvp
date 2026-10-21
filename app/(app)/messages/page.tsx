// app/(app)/messages/page.tsx
// Messages: inbox, message requests, a conversation, and the other member's profile card.
// Three panes on desktop; one pane at a time on mobile, chosen by the URL.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ArrowRight, TriangleAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getMe, getMyCircle } from '@/lib/rx/server';
import { dmMessages, listRequests, listThreads, memberCard, peerReadAt, suggestedPeople, type PersonItem } from '@/lib/rx/messages';
import { looksLikeScam } from '@/lib/rx/safety';
import { Avatar, Tag } from '@/components/rx/ui';
import { circleMessages } from '@/lib/rx/circle';
import { groupMessages } from '@/lib/rx/community';
import { CircleChat } from '@/components/rx/circle/CircleClient';
import { GroupRoomChat } from '@/components/rx/community/CommunityClient';
import { DmChat, DmHeader, InboxPane, NewMessagePane, RequestActions } from '@/components/rx/messages/MessagesClient';
import InboxLive from '@/components/rx/messages/InboxLive';

export const dynamic = 'force-dynamic';

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ tab?: string; t?: string; view?: string; new?: string; to?: string }> }) {
  const sp = await searchParams;
  const me = await getMe();
  if (!me) redirect('/login');
  const db = await createClient();

  const [threads, requests] = await Promise.all([listThreads(), listRequests()]);
  const tab = sp.tab === 'requests' ? 'requests' : 'inbox';
  const selected = sp.t ?? null;

  // Deep link from People search: /messages?to=<member id>. An existing conversation opens; otherwise New message with that person ready.
  let preselect: PersonItem | null = null;
  const toId = sp.to && /^[0-9a-f-]{36}$/i.test(sp.to) && sp.to !== me.userId ? sp.to : null;
  if (toId && !selected) {
    const { data: existing } = await db.from('dm_threads').select('id, status').or(`and(user_a.eq.${me.userId},user_b.eq.${toId}),and(user_a.eq.${toId},user_b.eq.${me.userId})`).maybeSingle();
    if (existing && (existing.status === 'accepted' || existing.status === 'request')) redirect(`/messages?t=${existing.id}`);
    const { data: person } = await db.from('member_directory').select('id, full_name, avatar_url').eq('id', toId).maybeSingle();
    if (person && (person as { full_name: string | null }).full_name) {
      const pp = person as { id: string; full_name: string; avatar_url: string | null };
      const circle = await getMyCircle().catch(() => null);
      const inCircle = !!circle?.seats.some((x) => x.userId === pp.id);
      preselect = { id: pp.id, name: pp.full_name.trim(), avatarUrl: pp.avatar_url, inCircle, meta: inCircle ? 'Your Circle' : 'Member · sends a message request' };
    }
  }
  const showNew = !selected && (sp.new === '1' || !!toId);
  const suggested = showNew ? await suggestedPeople() : [];

  // The selected conversation, if it is a direct message.
  let convo: null | { id: string; otherId: string; name: string; avatarUrl: string | null; status: string; iRequested: boolean; msgs: Awaited<ReturnType<typeof dmMessages>>; flagged: boolean; seenAt: string | null } = null;
  if (selected && !selected.startsWith('g:') && !selected.startsWith('c:') && selected !== 'circle') {
    const { data: t } = await db.from('dm_threads').select('id, user_a, user_b, requested_by, status').eq('id', selected).maybeSingle();
    if (t) {
      const otherId = t.user_a === me.userId ? t.user_b : t.user_a;
      const [card, msgs, seenAt] = await Promise.all([memberCard(otherId), dmMessages(db, t.id), peerReadAt(db, t.id, otherId)]);
      convo = { id: t.id, otherId, name: card?.name ?? 'Member', avatarUrl: card?.avatarUrl ?? null, status: t.status, iRequested: t.requested_by === me.userId, msgs, seenAt, flagged: msgs.some((m) => m.userId !== me.userId && looksLikeScam(m.body)) };
    }
  }
  // Circle and group chats open in this pane too, so the inbox works like WhatsApp Web: no page change.
  let room: null | { kind: 'circle'; id: string; title: string; sub: string; msgs: Awaited<ReturnType<typeof circleMessages>> } | { kind: 'group'; id: string; title: string; sub: string; msgs: Awaited<ReturnType<typeof groupMessages>>; joined: boolean } = null;
  if (selected?.startsWith('c:')) {
    const circle = await getMyCircle('member', selected.slice(2)).catch(() => null);
    if (circle && circle.pledged) room = { kind: 'circle', id: circle.circle.id, title: threads.find((x) => x.key === selected)?.name ?? 'Circle chat', sub: `${circle.memberCount} members · private`, msgs: await circleMessages(db, circle.circle.id) };
  } else if (selected?.startsWith('g:')) {
    const { data: g } = await db.from('rx_groups').select('id, name, description').eq('slug', selected.slice(2)).eq('status', 'active').maybeSingle();
    if (g) {
      const [{ data: mine }, msgs] = await Promise.all([
        db.from('rx_group_members').select('group_id').eq('group_id', g.id).eq('user_id', me.userId).maybeSingle(),
        groupMessages(db, g.id),
      ]);
      room = { kind: 'group', id: g.id as string, title: g.name as string, sub: (g.description as string | null) ?? 'Group chat', msgs, joined: !!mine };
    }
  }
  const card = convo ? await memberCard(convo.otherId) : null;
  const pane: 'list' | 'convo' | 'card' = convo && sp.view === 'card' ? 'card' : convo || room || showNew ? 'convo' : 'list';
  const canMsg = !!convo && (convo.status === 'accepted' || (convo.status === 'request' && convo.iRequested && convo.msgs.length === 0));
  const wasUnread = !!convo && threads.some((x) => x.key === convo!.id && x.unread);
  const meta = card ? [card.stage, card.city].filter(Boolean).join(' · ') || 'Member' : 'Member';

  const requestsNode = (
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
            <Link href={`/messages?t=${r.threadId}&view=card`} className="rx-link">Profile<ArrowRight aria-hidden /></Link>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="rx rx-panes" data-pane={pane}>
      <InboxLive />
      {/* ── list pane ── */}
      <div className="rx-pane rx-pane-list">
        <InboxPane threads={threads} selected={selected} tab={tab} requestCount={requests.length} requests={requestsNode} />
      </div>

      {/* ── conversation pane ── */}
      <div className="rx-pane rx-pane-convo">
        {showNew ? (
          <NewMessagePane suggested={suggested} preselect={preselect} />
        ) : convo ? (
          <div className="rxm-cv">
            <DmHeader presence={convo.status === 'accepted'} threadId={convo.id} otherId={convo.otherId} name={convo.name} avatarUrl={convo.avatarUrl} meta={convo.status === 'request' ? 'Message request' : meta} />
            {convo.flagged && (
              <div style={{ padding: '12px 16px 0' }}><div className="rx-banner" role="note"><TriangleAlert aria-hidden style={{ width: 20, height: 20, flex: 'none' }} /><div><b>This asks for payment and has an unknown link.</b> Don’t send money or codes. Ascentor never asks for payment in chat.</div></div></div>
            )}
            <div style={{ flex: 1, minHeight: 0 }}>
              <DmChat
                key={convo.id}
                threadId={convo.id} meId={me.userId} meName={me.fullName ?? 'You'} meAvatarUrl={me.avatarUrl ?? null} initial={convo.msgs}
                canSend={canMsg} wasUnread={wasUnread} peerReadAt={convo.seenAt}
                intro={(
                  <div className="rxm-intro">
                    <Avatar name={convo.name} url={convo.avatarUrl} size="md" seed={convo.otherId} />
                    <p className="rx-h3" style={{ marginTop: 6 }}>{convo.name}</p>
                    <p className="rx-sm">{meta}</p>
                    <Link href={`/messages?t=${convo.id}&view=card`} className="rx-link" style={{ minHeight: 36, fontSize: 14 }}>View profile<ArrowRight aria-hidden /></Link>
                  </div>
                )}
                notice={convo.status === 'request' && !convo.iRequested
                  ? <p className="rx-sm">You can’t reply to this message. Accept or decline it under Requests.</p>
                  : <p className="rx-sm">{convo.status === 'request' ? 'Waiting for them to accept your request.' : 'This conversation is closed.'}</p>}
              />
            </div>
          </div>
        ) : room ? (
          <div className="rxm-cv">
            <div className="rx-chat-head">
              <Link href="/messages" className="rx-ib rx-mob" aria-label="Back to inbox"><ArrowLeft aria-hidden /></Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="rx-h3" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{room.title}</p>
                <p className="rx-sm" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{room.sub}</p>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {room.kind === 'circle'
                ? <CircleChat key={room.id} circleId={room.id} meId={me.userId} initial={room.msgs} />
                : <GroupRoomChat key={room.id} groupId={room.id} meId={me.userId} initial={room.msgs} joined={room.joined} name={room.title} />}
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
              {canMsg
                ? <div style={{ marginTop: 12 }}><Link href={`/messages?t=${convo.id}`} className="rx-btn secondary">Message</Link></div>
                : <p className="rx-sm" style={{ marginTop: 12 }}>Messaging isn’t available with this member.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
