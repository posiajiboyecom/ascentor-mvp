import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMe, getMyCircle } from '@/lib/rx/server';
import { cycleSummary } from '@/lib/rx/circle';
import { Aside, BackLink, Page, Tag, Title } from '@/components/rx/ui';
import { ReviewForm } from '@/components/rx/circle/CircleClient';

export const dynamic = 'force-dynamic';

export default async function ReviewPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const circle = await getMyCircle();
  if (!circle || !circle.pledged) redirect('/circle');
  const db = await createClient();
  const [sum, { data: review }] = await Promise.all([
    cycleSummary(me.userId, circle.circle.id, circle.circle.cycle_start),
    db.from('circle_reviews').select('carry_forward, next_choice').eq('circle_id', circle.circle.id).eq('user_id', me.userId).maybeSingle(),
  ]);
  const week = circle.week ?? 0;

  return (
    <Page>
      <BackLink href="/circle">Circle</BackLink>
      <Title tag={<Tag>Week {Math.max(week, 1)} of 12</Tag>}>{week >= 12 ? 'Cycle complete' : 'Your cycle so far'}</Title>
      <div className="rx-two">
        <div className="rx-stack-lg">
          <div className="rx-card rx-stack">
            <p className="rx-label">Your 90 days</p>
            <div className="rx-between"><span>Practices set and kept</span><span className="rx-strong">{sum.keptCount} of {sum.setCount}</span></div>
            <div className="rx-between"><span>Goals met</span><span className="rx-strong">{sum.goalsMet} of {sum.goalsTotal || 3}</span></div>
            <div className="rx-between"><span>Reports shared</span><span className="rx-strong">{sum.reports} of 12</span></div>
          </div>
          <ReviewForm open={week >= 12} initialCarry={(review?.carry_forward as string) ?? ''} initialChoice={(review?.next_choice as 'join' | 'break' | null) ?? null} />
        </div>
        <Aside>
          <p className="rx-label">About the review</p>
          <p className="rx-p">In week 12 your Circle looks back together, then each of you chooses what comes next.</p>
          <p className="rx-sm">These figures come from your own check-ins and reports. Nobody else sees them.</p>
        </Aside>
      </div>
    </Page>
  );
}
