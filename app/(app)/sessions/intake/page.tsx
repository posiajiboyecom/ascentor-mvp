import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/rx/server';
import { ALL_INTERESTS } from '@/lib/rx/constants';
import { Aside, BackLink, Page, Title } from '@/components/rx/ui';
import { IntakeForm } from '@/components/rx/sessions/SessionsClient';

export const dynamic = 'force-dynamic';

export default async function IntakePage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const db = await createClient();
  const [{ data: intake }, { data: goal }] = await Promise.all([
    db.from('mentee_intake').select('goal, interests, frequency, format, times').eq('user_id', me.userId).maybeSingle(),
    db.from('user_goals').select('goal_text').eq('user_id', me.userId).order('position').limit(1).maybeSingle(),
  ]);
  const mine = me.profile?.interests ?? [];
  // Their own interests first, then a few more to pick from.
  const options = [...mine, ...ALL_INTERESTS.filter((i) => !mine.includes(i)).slice(0, 8)];
  const i = intake as { goal: string | null; interests: string[]; frequency: string | null; format: string | null; times: string[] } | null;

  return (
    <Page>
      <BackLink href="/sessions">Sessions</BackLink>
      <Title>What do you want?</Title>
      <div className="rx-two">
        <IntakeForm
          interests={options}
          initial={{ goal: i?.goal ?? goal?.goal_text ?? '', interests: i?.interests?.length ? i.interests : mine.slice(0, 5), frequency: i?.frequency ?? 'Every two weeks', format: i?.format ?? 'Video', times: i?.times?.length ? i.times : ['Weekday evenings'] }}
        />
        <Aside>
          <p className="rx-label">Good to know</p>
          <p className="rx-p">Mentors are people further along your path.</p>
          <p className="rx-p">A taster is one 30-minute meeting, no commitment.</p>
        </Aside>
      </div>
    </Page>
  );
}
