import { members } from '@/lib/rx/plural';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, MapPin } from 'lucide-react';
import { getMe } from '@/lib/rx/server';
import { getCityGroups } from '@/lib/rx/cities';
import { upcomingMeetups, whenLabel } from '@/lib/rx/meetups';
import { Aside, Page, Title } from '@/components/rx/ui';
import { CityList, JoinCityButton, SuggestCity } from '@/components/rx/pages/CitiesClient';
import '@/styles/rx-pages.css';

export const dynamic = 'force-dynamic';

export default async function CitiesPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const cities = await getCityGroups(me.profile?.city);
  const mine = cities.find((c) => c.isMine) ?? null;
  const next = mine?.joined ? (await upcomingMeetups(me.userId, mine.id, 1))[0] ?? null : null;

  return (
    <Page>
      <Title>City groups</Title>
      <div className="rx-two">
        <div className="rx-stack-lg">
          {mine && (
            <div className="rx-cityhero">
              <span className="rx-dimdot"><MapPin aria-hidden /></span>
              <div className="grow">
                <p className="rx-label">Your city</p>
                <p className="rx-h3">{mine.name} · {members(mine.count)}</p>
                {next ? (
                  <Link href={`/community/meetups/${next.id}`} className="rx-link" style={{ minHeight: 32, fontSize: 14 }}>
                    Next meetup: {whenLabel(next.startsAt, next.endsAt, me.tz).split(' · ')[0]}, {next.title}<ArrowRight aria-hidden />
                  </Link>
                ) : mine.joined ? (
                  <Link href={`/community/meetups/new?group=${mine.slug}`} className="rx-link" style={{ minHeight: 32, fontSize: 14 }}>
                    No meetup planned yet. Plan one<ArrowRight aria-hidden />
                  </Link>
                ) : (
                  <p className="rx-sm">You haven’t joined yet. Join to chat with members nearby and see their meetups.</p>
                )}
              </div>
              {mine.joined
                ? <Link href={`/community/groups/${mine.slug}`} className="rx-btn primary">Open chat</Link>
                : <JoinCityButton id={mine.id} name={mine.name} />}
            </div>
          )}
          <CityList cities={cities.map((c) => ({ id: c.id, slug: c.slug, name: c.name, country: c.country, count: c.count, description: c.description, joined: c.joined, isMine: c.isMine }))} />
        </div>
        <Aside>
          <p className="rx-label">How city groups work</p>
          <p className="rx-p">One chat per city, for members who live or work nearby. Join any city, including one you’re moving to.</p>
          <p className="rx-p">Meetups are organised by members. Meet in public places and tell someone where you’re going.</p>
          <div><Link href="/community/meetups" className="rx-link">See all meetups<ArrowRight aria-hidden /></Link></div>
          <p className="rx-label">Can’t find your city?</p>
          <div><SuggestCity link /></div>
        </Aside>
      </div>
    </Page>
  );
}
