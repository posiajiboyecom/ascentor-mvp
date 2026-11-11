// Meetups in the member's city groups: upcoming list and a way to plan one.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Calendar, MapPin, Plus } from 'lucide-react';
import { getMe } from '@/lib/rx/server';
import { myCityGroups, upcomingMeetups, whenLabel } from '@/lib/rx/meetups';
import { Aside, Page, Title } from '@/components/rx/ui';
import '@/styles/rx-pages.css';

export const dynamic = 'force-dynamic';

export default async function MeetupsPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const [cities, list] = await Promise.all([myCityGroups(me.userId), upcomingMeetups(me.userId)]);
  const hasCity = cities.size > 0;

  return (
    <Page>
      <Title>Meetups</Title>
      <div className="rx-two">
        <div className="rx-stack-lg">
          {hasCity && <div><Link href="/community/meetups/new" className="rx-btn primary"><Plus aria-hidden />Plan a meetup</Link></div>}
          {!hasCity ? (
            <div className="rx-card rx-empty rx-stack-sm">
              <p className="rx-p">Meetups happen inside city groups. Join your city to see and plan meetups near you.</p>
              <Link href="/community/cities" className="rx-btn secondary">Join your city group</Link>
            </div>
          ) : list.length === 0 ? (
            <div className="rx-card rx-empty rx-stack-sm">
              <p className="rx-p">No meetups planned in your cities yet.</p>
              <p className="rx-sm">Start one: a study session, a walk, a coffee. Two people is a meetup.</p>
            </div>
          ) : (
            <div className="rx-stack">
              {list.map((m) => (
                <Link key={m.id} href={`/community/meetups/${m.id}`} className="rx-card rx-stack-sm" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="rx-row" style={{ gap: 8 }}>
                    <span className="rx-tag gold">{m.cityName}</span>
                    {m.mine === 'going' && <span className="rx-tag">You’re going</span>}
                  </div>
                  <p className="rx-h3">{m.title}</p>
                  <p className="rx-meta-line rx-sm"><Calendar aria-hidden />{whenLabel(m.startsAt, m.endsAt, me.tz)}</p>
                  <p className="rx-meta-line rx-sm"><MapPin aria-hidden />{m.area} · {m.going} going</p>
                  <span className="rx-link" style={{ minHeight: 28 }}>Open<ArrowRight aria-hidden /></span>
                </Link>
              ))}
            </div>
          )}
        </div>
        <Aside>
          <p className="rx-label">How meetups work</p>
          <p className="rx-p">Any member of a city group can plan a meetup for that city. The area shows to everyone in the group; the exact place shows only to people going.</p>
          <p className="rx-p">Meet in public places and tell someone where you’re going.</p>
        </Aside>
      </div>
    </Page>
  );
}
