import { members } from '@/lib/rx/plural';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/rx/server';
import { getGroups } from '@/lib/rx/community';
import { Aside, GoLink, Page, Title } from '@/components/rx/ui';
import CommunityTabs from '@/components/rx/community/CommunityTabs';
import { GroupDirectory, OpenHouseInvite, RequestGroup } from '@/components/rx/community/CommunityClient';

export const dynamic = 'force-dynamic';

export default async function GroupsPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const all = await getGroups();
  const directory = all.filter((g) => !g.isCity && !g.isFacilitators);
  const city = all.find((g) => g.isCity && me.profile?.city && g.slug === `city-${me.profile.city.toLowerCase().replace(/\s+/g, '-')}`) ?? null;
  const facil = all.find((g) => g.isFacilitators) ?? null;
  const openHouse = all.find((g) => g.isGeneral) ?? null;
  const inviteOpen = !!openHouse && !openHouse.joined && (me.profile?.oh_invite ?? 'pending') === 'pending';
  const suggested = directory.filter((g) => g.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);

  return (
    <Page>
      <Title>Community</Title>
      <CommunityTabs active="groups" />
      <div className="rx-two">
        <div className="rx-stack-lg">
          {inviteOpen && openHouse && <OpenHouseInvite id={openHouse.id} count={openHouse.count} />}
          <GroupDirectory groups={directory} suggested={suggested} facilitators={facil} />
        </div>
        <Aside>
          <p className="rx-label">How groups work</p>
          <p className="rx-p">Groups are named by interest and open to every stage.</p>
          <p className="rx-p">Suggestions only change what you see first. You can find every group here.</p>
          <p className="rx-p">Nobody is added to a group automatically.</p>
          {city && (<><p className="rx-label">City groups</p><GoLink href={`/community/groups/${city.slug}`}>{city.name} · {members(city.count)}</GoLink></>)}
          <p className="rx-label">Can’t find your group?</p>
          <RequestGroup link />
        </Aside>
      </div>
    </Page>
  );
}
