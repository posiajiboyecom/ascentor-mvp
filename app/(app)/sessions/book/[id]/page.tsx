import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/rx/server';
import { freeSlots } from '@/lib/rx/mentors';
import { Aside, BackLink, Page, Title } from '@/components/rx/ui';
import { BookGrid, type BookSlot } from '@/components/rx/sessions/SessionsClient';

export const dynamic = 'force-dynamic';

export default async function BookPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ match?: string; mode?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const me = await getMe();
  if (!me) redirect('/login');
  const db = await createClient();
  const { data: m } = await db.from('human_mentors').select('id, name').eq('id', id).eq('active', true).maybeSingle();
  if (!m) notFound();
  const slots = ((await freeSlots(db, [id])).get(id) ?? []).slice(0, 40);
  const tz = me.tz;
  const slotViews: BookSlot[] = slots.map((s) => ({
    id: s.id, iso: s.starts_at,
    day: new Date(s.starts_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz }),
    time: new Date(s.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }),
  }));
  const mode = sp.mode === 'reschedule' ? 'reschedule' : 'request';

  return (
    <Page>
      <BackLink href={sp.match ? '/sessions' : `/sessions/mentor/${id}`}>Back</BackLink>
      <Title>{mode === 'reschedule' ? 'Pick a new time' : 'Pick a time'}</Title>
      <div className="rx-two">
        <div className="rx-card rx-stack hero">
          <p className="rx-sm">{m.name as string} · times shown in {me.profile?.timezone_label ?? tz}</p>
          <BookGrid slots={slotViews} mentorId={id} matchId={sp.match} mode={mode} />
        </div>
        <Aside><p className="rx-label">Tip</p><p className="rx-p">Pick a time you can protect. A taster is 30 minutes.</p></Aside>
      </div>
    </Page>
  );
}
