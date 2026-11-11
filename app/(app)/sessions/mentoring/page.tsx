// Mentor view: Circles that asked for you, Circles you mentor (sessions, questions, agreement), capacity in Circles and your
// open times. Only aggregated Circle information is shown here: never the Circle chat, weekly reports or survey answers.

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/rx/server';
import { myMentorProfile } from '@/lib/rx/mentors';
import { mentorCircles, MAX_AGREEMENT_GOALS } from '@/lib/rx/cmentor';
import { mentorPrivateSessions } from '@/lib/rx/private-mentor';
import { PrivateCancel } from '@/components/rx/sessions/PrivateSessionClient';
import { whenLabel } from '@/lib/rx/dates';
import { Aside, BackLink, GoLink, Page, Tag, Title } from '@/components/rx/ui';
import { AgreementWorkspace, CapacityStepper, CircleRequestActions, ScheduleGrid, SlotManager, type SlotGridItem } from '@/components/rx/sessions/SessionsClient';

export const dynamic = 'force-dynamic';

export default async function MentoringPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const mentor = await myMentorProfile();
  if (!mentor) redirect('/sessions');
  const db = await createClient();
  const [circles, { data: slots }, privates] = await Promise.all([
    mentorCircles(mentor.id),
    db.from('mentor_slots').select('id, starts_at, taken').eq('mentor_id', mentor.id).gt('starts_at', new Date().toISOString()).order('starts_at'),
    mentorPrivateSessions(mentor.id),
  ]);
  const requests = circles.filter((c) => c.status === 'requested');
  const scheduling = circles.filter((c) => c.status === 'scheduling');
  const running = circles.filter((c) => c.status === 'active' || c.status === 'paused');
  const tz = me.tz;
  const fmt = (iso: string): Pick<SlotGridItem, 'day' | 'time'> => ({ day: new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz }), time: new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }) });

  return (
    <Page>
      <BackLink href="/sessions">Sessions</BackLink>
      <p className="rx-sm" style={{ marginTop: 8 }}>Mentor view · {mentor.name}</p>
      <Title>Mentoring</Title>
      <div className="rx-two">
        <div className="rx-stack-lg">
          <div className="rx-card rx-stack">
            <p className="rx-label">Requests from Circles</p>
            {requests.length === 0 && <p className="rx-sm">No Circles are waiting for your answer.</p>}
            {requests.map((c) => (
              <div key={c.cmId} className="rx-stack-sm" style={{ paddingBottom: 14, borderBottom: '1px solid var(--rx-border)' }}>
                <p className="rx-p rx-strong">{c.circleName}</p>
                <p className="rx-sm">{c.members} members{c.language ? ` · ${c.language}` : ''} · {Object.entries(c.stages).map(([k, n]) => `${n} ${k}`).join(', ') || 'stages not shared'}{c.zones.length ? ` · ${c.zones.length} time ${c.zones.length === 1 ? 'zone' : 'zones'}` : ''}</p>
                {c.topInterests.length > 0 && <div className="rx-row" style={{ gap: 6 }}>{c.topInterests.map((t) => <Tag key={t.tag}>{t.tag} · {t.n}</Tag>)}</div>}
                <div className="rx-row"><CircleRequestActions cmId={c.cmId} /></div>
              </div>
            ))}
          </div>

          {privates.length > 0 && (
            <div className="rx-card rx-stack">
              <p className="rx-label">Private sessions · Pinnacle members</p>
              {privates.map((s) => (
                <div key={s.id} className="rx-stack-sm" style={{ paddingBottom: 14, borderBottom: '1px solid var(--rx-border)' }}>
                  <p className="rx-p rx-strong" style={{ margin: 0 }}>{s.memberName} · {whenLabel(s.startsAt, tz)}</p>
                  <p className="rx-sm">{s.durationMin} minutes, one to one</p>
                  <p className="rx-sm rx-strong">Their agenda</p>
                  <p className="rx-p" style={{ whiteSpace: 'pre-wrap', fontSize: 15 }}>{s.agenda}</p>
                  <div className="rx-row" style={{ gap: 16, alignItems: 'center' }}>
                    <a href={`/call/private/${s.id}`} className="rx-btn primary">Join the call room</a>
                    <PrivateCancel sessionId={s.id} role="mentor" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {scheduling.map((c) => (
            <div key={c.cmId} className="rx-card rx-stack">
              <p className="rx-label">Choosing a time · {c.circleName}</p>
              <ScheduleGrid cmId={c.cmId} slots={c.slots.map((s) => ({ ...s, ...fmt(s.startsAt) }))} total={c.members} canConfirm isMember={false} min={c.needed} />
            </div>
          ))}

          {running.map((c) => (
            <div key={c.cmId} className="rx-stack">
              <div className="rx-card rx-stack-sm">
                <p className="rx-label">{c.circleName}{c.status === 'paused' ? ' · paused' : ''}</p>
                {c.nextSession ? (<>
                  <p className="rx-h2">{whenLabel(c.nextSession.startsAt, tz)}</p>
                  <p className="rx-sm">{c.nextSession.going} of {c.members} going · {c.nextSession.durationMin} minutes</p>
                  {c.nextSession.questions.length > 0 && <div className="rx-stack-sm"><p className="rx-sm rx-strong">Questions from the Circle</p>{c.nextSession.questions.map((q, i) => <p key={i} className="rx-p" style={{ fontSize: 15 }}><b>{q.name}:</b> {q.text}</p>)}</div>}
                  <div><a href={`/call/${c.circleId}/mentor`} className="rx-btn primary">Join the call room</a></div>
                </>) : <p className="rx-sm">No session is booked.</p>}
              </div>
              {c.agreement && <AgreementWorkspace cmId={c.cmId} agreement={{ goals: c.agreement.goals, tasks: c.agreement.tasks }} role="mentor" members={[]} meId={me.userId} maxGoals={MAX_AGREEMENT_GOALS} />}
            </div>
          ))}
          {running.length === 0 && scheduling.length === 0 && requests.length === 0 && privates.length === 0 && <div className="rx-card rx-empty"><p className="rx-p">You don’t mentor a Circle yet. Requests appear here when a Circle chooses you.</p></div>}
        </div>
        <Aside>
          <p className="rx-label">Capacity, in Circles</p>
          <CapacityStepper value={mentor.capacity} />
          <p className="rx-sm">{circles.filter((c) => c.status !== 'requested').length} Circles now. Requests pause when you’re full.</p>
          <p className="rx-sm">Pinnacle members can also book one of your open times for a private 20-minute session, with their agenda attached.</p>
          <p className="rx-label">Open times</p>
          <SlotManager slots={((slots ?? []) as { id: string; starts_at: string; taken: boolean }[]).map((s) => ({ id: s.id, label: whenLabel(s.starts_at, tz), taken: s.taken }))} />
          <p className="rx-sm">You see your Circle’s agreement, the questions members send and first names. The Circle chat, weekly reports and survey answers stay private.</p>
          <GoLink href="/sessions">Back to my own sessions</GoLink>
        </Aside>
      </div>
    </Page>
  );
}
