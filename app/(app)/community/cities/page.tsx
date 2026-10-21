import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, MapPin } from 'lucide-react';
import { getMe } from '@/lib/rx/server';
import { getCityGroups } from '@/lib/rx/cities';
import { Aside, Page, Title } from '@/components/rx/ui';
import { CityList, SuggestCity } from '@/components/rx/pages/CitiesClient';
import '@/styles/rx-pages.css';

export const dynamic = 'force-dynamic';

export default async function CitiesPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const cities = await getCityGroups(me.profile?.city);
  const mine = cities.find((c) => c.isMine) ?? null;

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
                <p className="rx-h3">{mine.name} · {mine.count} members</p>
                {mine.slug === 'city-lagos' && (
                  <>
                {/* TODO(meetups): the next meetup is static sample content until there is a meetups table. */}
                    <Link href="/community/meetups/yaba-study" className="rx-link" style={{ minHeight: 32, fontSize: 14 }}>
                      Next meetup: Sat 24 Oct, study meetup in Yaba<ArrowRight aria-hidden />
                    </Link>
                  </>
                )}
              </div>
              <Link href={`/community/groups/${mine.slug}`} className="rx-btn primary">Open chat</Link>
            </div>
          )}
          <CityList cities={cities.map((c) => ({ id: c.id, slug: c.slug, name: c.name, country: c.country, count: c.count, description: c.description, joined: c.joined, isMine: c.isMine }))} />
        </div>
        <Aside>
          <p className="rx-label">How city groups work</p>
          <p className="rx-p">One chat per city, for members who live or work nearby. Join any city, including one you’re moving to.</p>
          <p className="rx-p">Meetups are organised by members. Meet in public places and tell someone where you’re going.</p>
          <p className="rx-label">Can’t find your city?</p>
          <div><SuggestCity link /></div>
        </Aside>
      </div>
    </Page>
  );
}
