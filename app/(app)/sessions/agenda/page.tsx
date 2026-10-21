// Session agenda: what the Circle wants from the next mentor session, built from the agreement's goals and the members'
// questions. The agenda is ready once AGENDA_MIN_QUESTIONS members have asked one. No separate table: the questions are the agenda.

import '@/styles/rx-circle.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/rx/server';
import { circleTitle } from '@/lib/rx/circles';
import { getMentorship } from '@/lib/rx/cmentor';
import { whenLabel } from '@/lib/rx/dates';
import { asInt, getSetting } from '@/lib/admin/settings';
import { Aside, Avatar, BackLink, Page, Tag, Title } from '@/components/rx/ui';
import { QuestionBox } from '@/components/rx/sessions/SessionsClient';
import { SageSuggest } from '@/components/rx/sessions/SageSuggest';

export const dynamic = 'force-dynamic';

const ORDER: [string, string][] = [['Check-in', '2 min'], ['The Circle’s goal', '3 min'], ['Members’ questions', '12 min'], ['Next steps and owners', '3 min']];

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const sp = await searchParams;
  const me = await getMe();
  if (!me) redirect('/login');
  const circleId = sp.c && /^[0-9a-f-]{36}$/i.test(sp.c) ? sp.c : null;
  const ms = await getMentorship(circleId);
  if (!ms) redirect('/login');
  const { state, circle, isFacilitator } = ms;
  const back = `/sessions${circleId ? `?c=${circleId}` : ''}`;
  if (state.kind !== 'active' && state.kind !== 'paused') redirect(back);
  const { mentor, next, agreement } = state;
  const first = mentor.name.split(' ')[0];
  const questions = next?.questions ?? [];
  const AGENDA_MIN_QUESTIONS = asInt(await getSetting('mentor.agenda_questions'), 3, 1, 50);
  const ready = questions.length >= AGENDA_MIN_QUESTIONS;
  const startMs = next ? new Date(next.startsAt).getTime() : 0;
  const locked = !next || (startMs - Date.now() < 24 * 3600000 && !next.myQuestion);

  return (
    <Page>
      <BackLink href={back}>Sessions</BackLink>
      <Title>Session agenda</Title>
      <div className="rx-two">
        <div className="rx-card rx-stack rx-hero">
          <div className="rx-between">
            <p className="rx-label">{next ? whenLabel(next.startsAt, me.tz) : 'No session booked'} · with {mentor.name}</p>
            <Tag gold={ready}>{ready ? 'Ready' : 'Draft'}</Tag>
          </div>
          <div className="rx-stack-sm">
            <p className="rx-label">What the Circle wants from this session</p>
            {agreement.goals.length ? agreement.goals.map((g, i) => <p key={g.id} className="rx-p">{i + 1}. {g.text}</p>) : <p className="rx-sm">Add a goal to your Circle’s agreement on Sessions and it shows here.</p>}
          </div>
          <div className="rx-stack-sm">
            <p className="rx-label">Questions from members</p>
            <p className="rx-sm">At least {AGENDA_MIN_QUESTIONS}, so the time goes to what matters.</p>
            {questions.map((q, i) => (
              <div key={i} className="rx-row rx-nw" style={{ gap: 10, alignItems: 'flex-start' }}>
                <Avatar name={q.name} size="sm" seed={q.name} />
                <div style={{ flex: 1, minWidth: 0 }}><p className="rx-sm">{q.name}</p><p className="rx-p">{q.text}</p></div>
              </div>
            ))}
            {questions.length === 0 && <p className="rx-sm">No questions yet.</p>}
          </div>
          {next && !isFacilitator && <QuestionBox sessionId={next.id} initial={next.myQuestion} locked={locked} />}
          <div className="rx-stack-sm">
            <p className="rx-label">Running order · {next?.durationMin ?? 20} minutes</p>
            {ORDER.map(([item, min]) => <div key={item} className="rx-between" style={{ minHeight: 40, borderBottom: '1px solid var(--rx-border)' }}><span>{item}</span><span className="rx-sm">{min}</span></div>)}
          </div>
          <div className="rx-row"><SageSuggest /></div>
          <p className="rx-sm">{ready ? `${first} can see it now. You can still add notes.` : `Needs at least ${AGENDA_MIN_QUESTIONS} questions. ${questions.length} of ${AGENDA_MIN_QUESTIONS} so far.`}</p>
        </div>
        <Aside>
          <p className="rx-label">Why an agenda</p>
          <p className="rx-p">Mentor calls only start once the agenda is ready. It keeps the session focused and respects the mentor’s time.</p>
          <p className="rx-label">Who sees it</p>
          <p className="rx-p">Your Circle and {first}. Aim to finish it a day before so they can prepare.</p>
          <p className="rx-sm">{circleTitle(circle.circle)}</p>
          <Link href={back} className="rx-link muted">Back to Sessions</Link>
        </Aside>
      </div>
    </Page>
  );
}
