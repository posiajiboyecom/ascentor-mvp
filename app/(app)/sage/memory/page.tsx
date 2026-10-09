import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/rx/server';
import { Aside, BackLink, GoLink, Page, Title } from '@/components/rx/ui';
import { MemoryList } from '@/components/rx/sage/SageClient';

export const dynamic = 'force-dynamic';

export default async function SageMemoryPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const db = await createClient();
  const { data } = await db.from('sage_memories').select('id, text').eq('user_id', me.userId).order('created_at');

  return (
    <Page>
      <BackLink href="/settings">Settings</BackLink>
      <Title>What Sage knows</Title>
      <div className="rx-two">
        <MemoryList notes={(data ?? []) as { id: string; text: string }[]} />
        <Aside>
          <p className="rx-label">Privacy</p>
          <p className="rx-p">Sage never shares what you say with your Circle, mentor or facilitator.</p>
          <p className="rx-sm">After 5 quiet days, your facilitator is told you’ve been quiet, never what you said.</p>
          <p className="rx-sm">Ascentor’s safety team can review conversations, including Sage, to keep members safe. Every review is logged.</p>
          <GoLink href="/sage/reminders">Reminder settings</GoLink>
        </Aside>
      </div>
    </Page>
  );
}
