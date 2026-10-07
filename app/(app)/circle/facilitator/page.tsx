import Link from 'next/link';
import { redirect } from 'next/navigation';
import { TriangleAlert } from 'lucide-react';
import { getMe, getMyCircle } from '@/lib/rx/server';
import { facilitatorView } from '@/lib/rx/circle';
import { Aside, Avatar, BackLink, Page, Title } from '@/components/rx/ui';
import { ReachOutButton } from '@/components/rx/messages/MessagesClient';

export const dynamic = 'force-dynamic';

export default async function FacilitatorPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const circle = await getMyCircle('facilitator');
  if (!circle) redirect('/circle');
  const members = await facilitatorView(circle.circle.id, circle.week, me.tz, me.userId);
  const quiet = members.filter((m) => (m.quietDays ?? 0) >= 5 && !m.isYou);

  return (
    <Page>
      <BackLink href="/circle">Circle</BackLink>
      <p className="rx-sm" style={{ marginTop: 8 }}>Facilitator view · {circle.circle.name} · Circle {circle.circle.number}</p>
      <Title>Your Circle</Title>
      <div className="rx-two">
        <div className="rx-stack">
          {quiet.length === 0 && <div className="rx-card rx-empty"><p className="rx-p">Everyone has checked in recently.</p></div>}
          {quiet.map((m) => (
            <div key={m.userId} className="rx-stack">
              <div className="rx-banner" role="note"><TriangleAlert aria-hidden style={{ width: 20, height: 20, flex: 'none' }} /><div><b>{m.name.split(' ')[0]} has been quiet for {m.quietDays} days.</b> A personal note often helps more than a reminder.</div></div>
              <div className="rx-card rx-stack-sm">
                <div className="rx-row rx-nw"><Avatar name={m.name} url={m.avatarUrl} seed={m.userId} /><div style={{ flex: 1 }}><p className="rx-h3">{m.name}</p><p className="rx-sm">{m.status}</p></div></div>
                <div className="rx-row" style={{ marginTop: 8 }}><ReachOutButton userId={m.userId} name={m.name} /></div>
              </div>
            </div>
          ))}
        </div>
        <Aside>
          <div><Link href="/community/groups/facilitators-room" className="rx-link">Facilitators’ room</Link></div>
          <p className="rx-label">This week</p>
          {members.map((m) => (
            <div key={m.userId} className="rx-between" style={{ minHeight: 40 }}>
              <span className="rx-row rx-nw" style={{ gap: 8 }}><Avatar name={m.name} url={m.avatarUrl} size="sm" seed={m.userId} />{m.name}</span>
              <span className="rx-sm" style={{ whiteSpace: 'nowrap' }}>{m.status}</span>
            </div>
          ))}
          <p className="rx-sm">You see whether and when someone checked in, never what they wrote.</p>
        </Aside>
      </div>
    </Page>
  );
}
