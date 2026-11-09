import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Calendar, Lock, MessageSquare, Pin } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/rx/server';
import { groupMembers, groupMessages } from '@/lib/rx/community';
import { upcomingMeetups, whenLabel } from '@/lib/rx/meetups';
import { Avatar } from '@/components/rx/ui';
import { GroupRoomChat, LeaveGroupButton } from '@/components/rx/community/CommunityClient';

export const dynamic = 'force-dynamic';

export default async function GroupRoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await getMe();
  if (!me) redirect('/login');
  const db = await createClient();

  const { data: g } = await db.from('rx_groups').select('id, slug, name, description, prompt, is_facilitators, is_city').eq('slug', slug).eq('status', 'active').maybeSingle();
  if (!g) {
    // The facilitators' room is invisible to everyone else, so say what it is instead of a bare 404.
    if (slug === 'facilitators-room') {
      return (
        <div className="rx rx-page"><div className="rx-card rx-empty">
          <Lock aria-hidden style={{ width: 28, height: 28, color: 'var(--rx-muted)' }} />
          <p className="rx-p">This room is only for active Circle facilitators.</p>
          <Link href="/community/groups" className="rx-btn secondary">Back to groups</Link>
        </div></div>
      );
    }
    notFound();
  }

  const [{ data: stat }, { data: mine }, msgs, members] = await Promise.all([
    db.from('rx_group_stats').select('member_count').eq('group_id', g.id).maybeSingle(),
    db.from('rx_group_members').select('group_id').eq('group_id', g.id).eq('user_id', me.userId).maybeSingle(),
    groupMessages(db, g.id),
    groupMembers(db, g.id, 6),
  ]);
  const count = (stat?.member_count as number | undefined) ?? 0;
  const joined = !!mine;
  const nextMeetup = g.is_city && joined ? (await upcomingMeetups(me.userId, g.id, 1))[0] ?? null : null;

  return (
    <div className="rx rx-room">
      <div className="rx-chat">
        <div className="rx-chat-head">
          <Link href="/community/groups" className="rx-ib" aria-label="Back to groups"><ArrowLeft aria-hidden /></Link>
          <span className="rx-dimdot">{g.is_facilitators ? <Lock aria-hidden /> : <MessageSquare aria-hidden />}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="rx-h3" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</p>
            <p className="rx-sm" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{count} {count === 1 ? 'member' : 'members'} · {g.description}</p>
          </div>
          {joined && !g.is_facilitators && <LeaveGroupButton groupId={g.id} />}
        </div>
        {g.prompt && (
          <div style={{ padding: '12px 16px 0' }}>
            <div className="rx-soft rx-row rx-nw" style={{ gap: 10 }}><Pin aria-hidden style={{ width: 16, height: 16, color: 'var(--rx-muted)', flex: 'none' }} /><div style={{ minWidth: 0 }}><p className="rx-sm">Pinned prompt</p><p className="rx-p">{g.prompt}</p></div></div>
          </div>
        )}
        {g.is_city && joined && (
          <div style={{ padding: '12px 16px 0' }}>
            <div className="rx-soft rx-row rx-nw" style={{ gap: 10 }}>
              <Calendar aria-hidden style={{ width: 16, height: 16, color: 'var(--rx-muted)', flex: 'none' }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                {nextMeetup
                  ? <Link href={`/community/meetups/${nextMeetup.id}`} className="rx-p" style={{ color: 'inherit' }}><b>Next meetup:</b> {nextMeetup.title} · {whenLabel(nextMeetup.startsAt, nextMeetup.endsAt, me.tz).split(' · ')[0]} · {nextMeetup.going} going</Link>
                  : <p className="rx-p">No meetup planned in {g.name} yet.</p>}
              </div>
              <Link href={`/community/meetups/new?group=${g.slug}`} className="rx-link" style={{ minHeight: 32, fontSize: 14, flex: 'none' }}>Plan one</Link>
            </div>
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0 }}>
          <GroupRoomChat groupId={g.id} meId={me.userId} initial={msgs} joined={joined} name={g.name} />
        </div>
      </div>
      <aside className="rx-room-members rx-dsk" style={{ flexDirection: 'column' }}>
        <p className="rx-label">Members · {count}</p>
        {members.map((m) => (<div key={m.id} className="rx-row rx-nw" style={{ gap: 10, minHeight: 40 }}><Avatar name={m.name} url={m.avatarUrl} size="sm" seed={m.id} /><span>{m.name}</span></div>))}
        {count > members.length && <p className="rx-sm">and {count - members.length} more</p>}
      </aside>
    </div>
  );
}
