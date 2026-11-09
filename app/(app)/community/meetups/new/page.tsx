import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/rx/server';
import { myCityGroups } from '@/lib/rx/meetups';
import { localISODate } from '@/lib/rx/dates';
import { Aside, BackLink, Page, Title } from '@/components/rx/ui';
import { PlanMeetupForm } from '@/components/rx/pages/MeetupClient';
import '@/styles/rx-pages.css';

export const dynamic = 'force-dynamic';

export default async function NewMeetupPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const me = await getMe();
  if (!me) redirect('/login');
  const { group } = await searchParams;
  const cities = await myCityGroups(me.userId);
  const list = [...cities.entries()].map(([id, c]) => ({ id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name));
  const initial = group ? [...cities.entries()].find(([id, c]) => id === group || c.slug === group)?.[0] : undefined;

  return (
    <Page>
      <BackLink href="/community/meetups">Meetups</BackLink>
      <Title>Plan a meetup</Title>
      <div className="rx-two">
        {list.length === 0 ? (
          <div className="rx-card rx-empty rx-stack-sm">
            <p className="rx-p">Join a city group first. Meetups are planned for a city.</p>
            <Link href="/community/cities" className="rx-btn secondary">Find your city</Link>
          </div>
        ) : <PlanMeetupForm cities={list} initialGroupId={initial} today={localISODate(me.tz)} />}
        <Aside>
          <p className="rx-label">Good meetups</p>
          <p className="rx-p">Pick a public place that’s easy to reach. Say what you’ll do and what to bring.</p>
          <p className="rx-p">You can have up to three upcoming meetups at a time, and you can cancel yours any time.</p>
        </Aside>
      </div>
    </Page>
  );
}
