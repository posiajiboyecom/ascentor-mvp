import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Headphones } from 'lucide-react';
import { getMe, getMyCircle } from '@/lib/rx/server';
import { createClient } from '@/lib/supabase/server';
import { loadAgenda } from '@/lib/rx/agenda';
import { CIRCLE_FOCUS, MEETING_AGENDA } from '@/lib/rx/constants';
import { nextWeekdayAt, whenLabel } from '@/lib/rx/dates';
import { Aside, BackLink, Page, Title } from '@/components/rx/ui';

export const dynamic = 'force-dynamic';

export default async function MeetingPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const me = await getMe();
  if (!me) redirect('/login');
  const circle = await getMyCircle('member', c);
  if (!circle || !circle.pledged) redirect('/circle');

  const next = nextWeekdayAt(circle.circle.meeting_dow, circle.circle.meeting_time.slice(0, 5), circle.circle.timezone);
  const started = circle.memberCount >= 4 && !!circle.circle.cycle_start;
  const focus = CIRCLE_FOCUS[(circle.week ?? 1) - 1];
  // The agenda the Circle prepared; the suggested 15-minute format until someone adds one.
  const prepared = (await loadAgenda(await createClient(), circle.circle.id)).items.filter((i) => i.title.trim());
  const agendaRows: [string, string][] = prepared.length ? prepared.map((i) => [i.title, i.duration_minutes ? `${i.duration_minutes} min` : '']) : MEETING_AGENDA.map(([a, b]) => [a, b] as [string, string]);

  return (
    <Page>
      <BackLink href={`/circle?c=${circle.circle.id}`}>Circle</BackLink>
      <Title>Circle meeting</Title>
      <div className="rx-two">
        <div className="rx-stack">
          <div className="rx-video">
            <div className="rx-stack-sm" style={{ alignItems: 'center', position: 'relative', textAlign: 'center', padding: 16 }}>
              <Headphones aria-hidden style={{ width: 32, height: 32 }} />
              <p className="rx-p rx-strong" style={{ color: '#fff' }}>{started ? `Starts ${whenLabel(next, me.tz)}` : 'Calls start when 4 members have joined'}</p>
              <p className="rx-sm" style={{ color: '#D6D3CB' }}>{started ? 'Audio by default · 15 minutes · the room opens 5 minutes early.' : 'Your group chat is open in the meantime.'}</p>
            </div>
          </div>
          <div className="rx-row">
            {started ? <Link href={`/call/${circle.circle.id}`} className="rx-btn primary">Join call</Link> : <span className="rx-btn primary" aria-disabled="true">Join call</span>}
          </div>
          <p className="rx-sm">Focus this week: {focus}</p>
          <p className="rx-sm">Fifteen minutes is short, so reports are shared in the chat beforehand. The call is for one shared obstacle and each member’s commitment.</p>
        </div>
        <Aside>
          <p className="rx-label">{prepared.length ? 'Agenda · prepared by your Circle' : 'Agenda · 15 minutes'}</p>
          {agendaRows.map(([item, min]) => (
            <div key={item} className="rx-between" style={{ minHeight: 40, borderBottom: '1px solid var(--rx-border)' }}><span>{item}</span><span className="rx-sm" style={{ whiteSpace: 'nowrap' }}>{min}</span></div>
          ))}
          <p className="rx-sm">{circle.facilitatorName ?? 'Your facilitator'} keeps time. Reports are shared before the meeting. <Link href={`/circle/reports?c=${circle.circle.id}`} className="rx-link" style={{ minHeight: 0 }}>Share yours</Link></p>
          <Link href={`/circle?c=${circle.circle.id}`} className="rx-link">{prepared.length ? 'Edit the agenda' : 'Prepare the agenda'}</Link>
        </Aside>
      </div>
    </Page>
  );
}
