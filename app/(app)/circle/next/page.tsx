import '@/styles/rx-circle.css';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMe, getMyCircle } from '@/lib/rx/server';
import { cycleSummary } from '@/lib/rx/circle';
import { Aside, BackLink, GoLink, Page, Tag, Title } from '@/components/rx/ui';
import { NextCycleForm } from '@/components/rx/circle/NextCycleForm';

export const dynamic = 'force-dynamic';

function cycleTwoStart(cycleStart: string | null, tz: string | null): string {
  const base = cycleStart ? new Date(`${cycleStart.slice(0, 10)}T12:00:00Z`) : new Date();
  base.setUTCDate(base.getUTCDate() + 84);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(base).replace(',', '');
}

export default async function NextPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const me = await getMe();
  if (!me) redirect('/login');
  const circle = await getMyCircle('member', c);
  if (!circle || !circle.pledged) redirect('/circle');
  const db = await createClient();
  const [sum, { data: review }] = await Promise.all([
    cycleSummary(me.userId, circle.circle.id, circle.circle.cycle_start),
    db.from('circle_reviews').select('next_choice').eq('circle_id', circle.circle.id).eq('user_id', me.userId).maybeSingle(),
  ]);
  const start = cycleTwoStart(circle.circle.cycle_start, circle.circle.timezone);
  const saved = review?.next_choice as string | null | undefined;
  const initial = saved === 'join' ? 'new' : (saved as 'stay' | 'new' | 'lead' | 'break' | null | undefined) ?? null;

  return (
    <Page>
      <BackLink href={`/circle/review?c=${circle.circle.id}`}>Cycle review</BackLink>
      <Title tag={<Tag>Cycle 1 complete</Tag>}>What’s next</Title>
      <div className="rx-two">
        <div className="rx-stack-lg">
          <p className="rx-p" style={{ fontSize: 17 }}>Your 90 days with {circle.circle.name} · Circle {circle.circle.number} are done. Choose how you want to continue. Cycle 2 starts {start}.</p>
          <NextCycleForm circleId={circle.circle.id} start={start} initial={initial ?? null} />
        </div>
        <Aside>
          <p className="rx-label">Your cycle</p>
          <div className="rx-between"><span>Reports shared</span><span className="rx-strong">{sum.reports}</span></div>
          <div className="rx-between"><span>Practices kept</span><span className="rx-strong">{sum.keptCount} of {sum.setCount}</span></div>
          <div><GoLink href="/growth">My Growth</GoLink></div>
        </Aside>
      </div>
    </Page>
  );
}
