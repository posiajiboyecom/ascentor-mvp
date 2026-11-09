import { notFound, redirect } from 'next/navigation';
import { getMe } from '@/lib/rx/server';
import { getMeetup, whenLabel } from '@/lib/rx/meetups';
import { Aside, BackLink, Page, Title } from '@/components/rx/ui';
import { MeetupBody, ReportMeetup } from '@/components/rx/pages/MeetupClient';
import '@/styles/rx-pages.css';

export const dynamic = 'force-dynamic';

export default async function MeetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMe();
  if (!me) redirect('/login');
  const m = await getMeetup(id, me.userId, me.isStaff);
  if (!m) notFound();
  const cityChatHref = `/community/groups/${m.citySlug}`;

  return (
    <Page>
      <BackLink href="/community/meetups">Meetups</BackLink>
      <p className="rx-sm" style={{ marginTop: 6 }}>{m.cityName} · member meetup</p>
      <Title>{m.title}</Title>
      <div className="rx-two">
        <MeetupBody
          id={m.id} title={m.title} when={whenLabel(m.startsAt, m.endsAt, me.tz)} area={m.area} venue={m.venue} hostName={m.hostName}
          description={m.description} startsAt={m.startsAt} endsAt={m.endsAt} mine={m.mine} going={m.going} maybe={m.maybe}
          isHost={m.isHost} cancelled={m.cancelled} past={new Date(m.endsAt).getTime() < Date.now()} people={m.people}
          cityChatHref={cityChatHref} canCancel={m.isHost || me.isStaff}
        />
        <Aside>
          <p className="rx-label">Meeting safely</p>
          <p className="rx-p">Meet in public places. Tell someone where you’re going.</p>
          <p className="rx-p">Never send money or bank details to someone you met here.</p>
          {!m.isHost && <div><ReportMeetup id={m.id} /></div>}
        </Aside>
      </div>
    </Page>
  );
}
