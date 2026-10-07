import { redirect } from 'next/navigation';
import { getMe } from '@/lib/rx/server';
import { Aside, BackLink, Page, Title } from '@/components/rx/ui';
import { ReminderSettings } from '@/components/rx/sage/SageClient';

export const dynamic = 'force-dynamic';

export default async function SageRemindersPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const p = me.profile;
  const paused = !!p?.reminders_paused_until && new Date(p.reminders_paused_until) > new Date();

  return (
    <Page>
      <BackLink href="/settings">Settings</BackLink>
      <Title>Reminders</Title>
      <div className="rx-two">
        <ReminderSettings maxPerDay={p?.max_per_day ?? 1} quiet={p?.quiet_hours ?? true} paused={paused} />
        <Aside><p className="rx-label">Why so few</p><p className="rx-p">Reminders only help when they’re rare. You’ll never get more than two a day.</p></Aside>
      </div>
    </Page>
  );
}
