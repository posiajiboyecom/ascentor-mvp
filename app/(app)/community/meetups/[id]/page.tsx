import { notFound, redirect } from 'next/navigation';
import { getMe } from '@/lib/rx/server';
import { Aside, BackLink, Page, Title } from '@/components/rx/ui';
import { MeetupBody, ReportMeetup } from '@/components/rx/pages/MeetupClient';
import '@/styles/rx-pages.css';

export const dynamic = 'force-dynamic';

// TODO(meetups): STATIC SAMPLE. There is no meetups/events table for member meetups in the database yet
// (public_events and partner_events are marketing events). Only the prototype's one meetup exists, so any
// other id is a 404. Replace with a real query once a meetups table exists.
const SAMPLE_ID = 'yaba-study';

export default async function MeetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMe();
  if (!me) redirect('/login');
  if (id !== SAMPLE_ID) notFound();

  return (
    <Page>
      <BackLink href="/community/groups/city-lagos">Lagos city group</BackLink>
      <p className="rx-sm" style={{ marginTop: 6 }}>Lagos · member meetup</p>
      <Title>Study meetup in Yaba</Title>
      <div className="rx-two">
        <MeetupBody cityChatHref="/community/groups/city-lagos" />
        <Aside>
          <p className="rx-label">Meeting safely</p>
          <p className="rx-p">Meet in public places. Tell someone where you’re going.</p>
          <p className="rx-p">Never send money or bank details to someone you met here.</p>
          <div><ReportMeetup /></div>
        </Aside>
      </div>
    </Page>
  );
}
