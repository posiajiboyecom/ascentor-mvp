// app/(app)/sessions/page.tsx
// Sessions: Circle mentorship. The Circle is recommended mentors and votes; the highest vote becomes its mentor. Sessions are
// 20 minutes, every two weeks, as an audio call. The Circle keeps one agreement with its mentor.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Headphones, Users2 } from 'lucide-react';
import { getMe } from '@/lib/rx/server';
import { circleTitle, getMyCircles } from '@/lib/rx/circles';
import { AGENDA_MIN_QUESTIONS, getMentorship, MAX_AGREEMENT_GOALS, MIN_GOING, READY_MEMBERS } from '@/lib/rx/cmentor';
import { myMentorProfile } from '@/lib/rx/mentors';
import { whenLabel } from '@/lib/rx/dates';
import '@/styles/rx-circle.css';
import { Aside, Avatar, Banner, Bar, GoLink, Page, SageLine, Tick, Title } from '@/components/rx/ui';
import { AgreementWorkspace, PauseButton, QuestionBox, RsvpButtons, ScheduleGrid, StartVoteButton, SwapButton, VoteCards, type SlotGridItem } from '@/components/rx/sessions/SessionsClient';

export const dynamic = 'force-dynamic';

export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const sp = await searchParams;
  const me = await getMe();
  if (!me) redirect('/login');

  // Mentorship belongs to a Circle. With several Circles and none chosen, pick one first.
  let circleId = sp.c && /^[0-9a-f-]{36}$/i.test(sp.c) ? sp.c : null;
  const mine = await getMyCircles();
  if (!circleId && mine.length > 1) {
    return (
      <Page><Title>Sessions</Title>
        <div className="rx-two">
          <div className="rx-stack">
            <p className="rx-p">Each Circle chooses its own mentor. Pick a Circle to see its vote, times and sessions.</p>
            {mine.map((c) => (
              <Link key={c.id} href={`/sessions?c=${c.id}`} className="rx-card rx-stack-sm" style={{ textDecoration: 'none', color: 'inherit' }}>
                <p className="rx-h3" style={{ margin: 0 }}>{circleTitle(c)}</p>
                <p className="rx-p rx-strong" style={{ margin: 0 }}>{c.state.headline}</p>
                {c.state.detail && <p className="rx-sm">{c.state.detail}</p>}
              </Link>
            ))}
          </div>
          <Aside><p className="rx-label">How it works</p><p className="rx-p">Your Circle is recommended a few mentors.</p><p className="rx-p">Members vote. The highest vote wins.</p><GoLink href="/circle">All my Circles</GoLink></Aside>
        </div>
      </Page>
    );
  }
  if (!circleId && mine.length === 1) circleId = mine[0].id;
  const [ms, mentorProfile] = await Promise.all([getMentorship(circleId), myMentorProfile()]);
  if (!ms) redirect('/login');
  const { state, circle, isFacilitator } = ms;
  const agendaCount = state.kind === 'active' || state.kind === 'paused' ? (state.next?.questions.length ?? 0) : 0;
  const agendaReady = agendaCount >= AGENDA_MIN_QUESTIONS;
  const stepsDone = [
    state.kind !== 'idle' && state.kind !== 'none' && state.kind !== 'voting' && state.kind !== 'tie',
    state.kind === 'scheduling' || state.kind === 'active' || state.kind === 'paused',
    (state.kind === 'active' || state.kind === 'paused') && !!state.next,
    (state.kind === 'active' || state.kind === 'paused') && !!state.next && agendaReady,
    false,
  ];
  const stepLabels = ['Your Circle votes for a mentor', `${circle?.facilitatorName ?? 'Your facilitator'} confirms the choice`, 'Book a time from the mentor’s schedule', 'Prepare the agenda together', 'Meet as a Circle'];
  const side = (
    <Aside>
      <p className="rx-label">How Circle mentorship works</p>
      {stepLabels.map((t, i) => {
        const cur = !stepsDone[i] && stepsDone.slice(0, i).every(Boolean);
        return <p key={t} className="rx-row rx-nw rx-p" style={{ gap: 10, alignItems: 'flex-start' }}><span className={`rx-pd${stepsDone[i] ? ' done' : cur ? ' cur' : ''}`} style={{ marginTop: 2 }}>{stepsDone[i] && <Tick />}</span>{t}</p>;
      })}
      <p className="rx-label">Good to know</p>
      <p className="rx-p">Mentors give their time for free. The agenda is how your Circle respects it.</p>
      <p className="rx-label">How it works</p>
      <p className="rx-p">Your Circle is recommended a few mentors.</p><p className="rx-p">Members vote. The highest vote wins.</p>
      <p className="rx-p">Your Circle picks a time that works for {MIN_GOING} or more.</p><p className="rx-p">Sessions are 20 minutes, every two weeks, audio by default.</p>
      <GoLink href="/experts">Live expert sessions</GoLink>
      {mine.length > 1 && <GoLink href="/sessions">All my Circles</GoLink>}
      {mentorProfile && <GoLink href="/sessions/mentoring">Mentor view</GoLink>}
    </Aside>
  );

  if (state.kind === 'none') {
    return (
      <Page><Title>Sessions</Title>
        <div className="rx-two">
          <div className="rx-card rx-empty">
            <span className="rx-dimdot" aria-hidden><Users2 /></span>
            <p className="rx-h2">{state.reason === 'nocircle' ? 'Sessions are for Circles' : 'Mentor sessions begin with 6 members'}</p>
            <p className="rx-p" style={{ color: 'var(--rx-muted)', maxWidth: 440 }}>{state.reason === 'nocircle' ? 'Join your Circle first. Your Circle chooses a mentor together.' : `Your Circle has ${circle.memberCount} of ${READY_MEMBERS} members so far. When it reaches ${READY_MEMBERS}, you can choose a mentor.`}</p>
            {state.reason === 'notready' && <div style={{ width: '100%', maxWidth: 320 }}><Bar pct={(circle.memberCount / READY_MEMBERS) * 100} label={`${circle.memberCount} of ${READY_MEMBERS}`} /></div>}
            <Link href="/circle" className="rx-btn secondary">Go to Circle</Link>
          </div>
          {side}
        </div>
      </Page>
    );
  }

  if (state.kind === 'idle') {
    return (
      <Page><Title>Sessions</Title>
        <div className="rx-two">
          <div className="rx-card rx-empty" style={{ padding: '32px 20px' }}>
            <span className="rx-dimdot" aria-hidden><Users2 /></span>
            <p className="rx-h2">A mentor for your whole Circle</p>
            <p className="rx-p" style={{ color: 'var(--rx-muted)', maxWidth: 440 }}>People further along your road. We recommend up to three who fit your Circle. You vote together, and nobody is assigned.</p>
            <StartVoteButton circleId={circle.circle.id} />
          </div>
          {side}
        </div>
      </Page>
    );
  }

  if (state.kind === 'voting' || state.kind === 'tie') {
    const tie = state.kind === 'tie';
    return (
      <Page><p className="rx-sm">{circleTitle(circle.circle)}</p><Title>{state.kind === 'voting' && state.isSwap ? 'Choose a different mentor' : 'Choose a mentor'}</Title>
        <SageLine label="Sage · AI coach">Three mentors who fit your Circle’s goals.</SageLine>
        <div className="rx-two">
          <div className="rx-stack">
            {state.kind === 'voting' && (
              <div className="rx-soft rx-stack-sm"><p className="rx-p rx-strong">{state.voted} of {state.total} have voted</p><Bar pct={(state.voted / Math.max(1, state.total)) * 100} label={`${state.voted} of ${state.total} voted`} /><p className="rx-sm">Voting closes {new Date(state.closesAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: me.tz })}. It also closes as soon as everyone has voted. You can change your vote until then. The mentor with the most votes is asked first.</p></div>
            )}
            {tie && <div className="rx-soft"><p className="rx-p rx-strong">It’s a tie.</p><p className="rx-sm">Your facilitator chooses between the top mentors.</p></div>}
            <VoteCards roundId={state.roundId} candidates={state.candidates} tie={tie} canBreak={tie ? state.canBreak : false} tied={tie ? state.tied : []} isMember={!isFacilitator} nameOfCircle={circleTitle(circle.circle)} />
            {state.kind === 'voting' && <p className="rx-sm">{state.voted} of {state.total} voted · closes {new Date(state.closesAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: me.tz })} · {circle?.facilitatorName ?? 'Your facilitator'} confirms the result.</p>}
          </div>
          {side}
        </div>
      </Page>
    );
  }

  if (state.kind === 'requested') {
    return (
      <Page><Title>Sessions</Title>
        <div className="rx-two">
          <div className="rx-card rx-stack">
            <div className="rx-row rx-nw" style={{ gap: 14 }}><Avatar name={state.mentor.name} url={state.mentor.avatar_url} size="lg" seed={state.mentor.id} /><div><p className="rx-sm">Request sent</p><p className="rx-h2">{state.mentor.name}</p></div></div>
            <p className="rx-p">Your Circle chose {state.mentor.name.split(' ')[0]}. Waiting for them to accept. Mentors usually reply within 2 days. If they can’t, your Circle votes again.</p>
          </div>
          {side}
        </div>
      </Page>
    );
  }

  if (state.kind === 'scheduling') {
    const tz = me.tz;
    const items: SlotGridItem[] = state.slots.map((s) => ({ ...s, day: new Date(s.startsAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz }), time: new Date(s.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }) }));
    return (
      <Page><Title>Pick a time</Title>
        <div className="rx-two">
          <div className="rx-card rx-stack">
            <p className="rx-sm">{state.mentor.name}’s free times · {me.profile?.timezone_label ?? tz}. Each slot shows how many of your Circle can make it.</p>
            <ScheduleGrid cmId={state.cmId} slots={items} total={state.total} canConfirm={isFacilitator || circle.isFacilitator} isMember={!isFacilitator} min={MIN_GOING} />
            {(isFacilitator || circle.isFacilitator) ? <p className="rx-sm">As facilitator you confirm a time once {MIN_GOING} or more members can attend. Sessions then repeat every two weeks.</p> : <p className="rx-sm">Your facilitator or the mentor confirms a time once {MIN_GOING} or more of you can attend. Sessions then repeat every two weeks at the same time.</p>}
          </div>
          <Aside>
            <p className="rx-label">Who books</p>
            <p className="rx-p">{circle?.facilitatorName ? `${circle?.facilitatorName}, your facilitator, books.` : 'Your facilitator books.'} Everyone sees the time on Today and gets a reminder an hour before.</p>
            <p className="rx-label">After booking</p>
            <p className="rx-p">Prepare the agenda together. The call can’t start without it.</p>
          </Aside>
        </div>
      </Page>
    );
  }

  // active or paused
  const { mentor, sessions, next, agreement, canSwap, cmId } = state;
  const first = mentor.name.split(' ')[0];
  const nowMs = Date.now();
  const startMs = next ? new Date(next.startsAt).getTime() : 0;
  const joinOpen = !!next && nowMs >= startMs - 5 * 60000 && nowMs < startMs + next.durationMin * 60000;
  const questionsOpen = !!next && startMs - nowMs >= 24 * 3600000;
  const past = sessions.filter((s) => s.status === 'held' || (s.status === 'scheduled' && new Date(s.startsAt).getTime() + s.durationMin * 60000 < nowMs)).slice(-4).reverse();
  const memberOptions = circle.seats.filter((s) => s.role === 'member').map((s) => ({ id: s.userId, name: s.name.split(' ')[0] }));

  return (
    <Page>
      <p className="rx-sm">With {mentor.name} · {circleTitle(circle.circle)}{state.kind === 'paused' ? ' · paused' : ''}</p>
      <Title>Sessions</Title>
      <div className="rx-two">
        <div className="rx-stack-lg">
          <div className="rx-card rx-stack-sm">
            <p className="rx-label">Next session</p>
            {next ? (<>
              <p className="rx-h2">{whenLabel(next.startsAt, me.tz)}</p>
              <p className="rx-sm">With your whole Circle · {next.durationMin} minutes · starts as an audio call, video optional</p>
              <div className="rx-row" style={{ marginTop: 6 }}>
                {joinOpen && agendaReady ? <Link href={`/call/${circle.circle.id}/mentor`} className="rx-btn primary"><Headphones aria-hidden style={{ width: 18, height: 18 }} />Join</Link> : <span className="rx-btn secondary" aria-disabled="true">{joinOpen ? 'Join call' : 'Opens 5 minutes before'}</span>}
              </div>
              {!agendaReady && <Banner><b>No agenda yet.</b> This call can’t start until your Circle’s agenda is ready. {agendaCount} of {AGENDA_MIN_QUESTIONS} member questions so far.</Banner>}
              {agendaReady && <div className="rx-row rx-nw" style={{ gap: 10 }}><Tick /><span style={{ flex: 1 }}>Agenda ready · shared with {first}</span></div>}
              <div className="rx-row"><Link href={`/sessions/agenda?c=${circle.circle.id}`} className={`rx-btn ${agendaReady ? 'secondary' : 'primary'}`}>{agendaReady ? 'View agenda' : 'Prepare the agenda'}</Link></div>
              {!isFacilitator && <RsvpButtons sessionId={next.id} mine={next.myRsvp} going={next.going} min={MIN_GOING} />}
            </>) : <p className="rx-p">No session is booked right now.</p>}
          </div>

          {next && !isFacilitator && <div className="rx-card"><QuestionBox sessionId={next.id} initial={next.myQuestion} locked={!questionsOpen && !next.myQuestion} /></div>}

          <div className="rx-card rx-stack-sm">
            <p className="rx-label">Past sessions</p>
            {past.length ? past.map((s) => <p key={s.id} className="rx-p rx-strong">Session · {whenLabel(s.startsAt, me.tz)}</p>) : <p className="rx-sm">Your first session hasn’t happened yet.</p>}
          </div>

          <AgreementWorkspace cmId={cmId} agreement={agreement} role="member" members={memberOptions} meId={me.userId} maxGoals={MAX_AGREEMENT_GOALS} />
        </div>
        <Aside>
          <p className="rx-label">Your mentor</p>
          <div className="rx-row rx-nw" style={{ gap: 12 }}><Avatar name={mentor.name} url={mentor.avatar_url} size="md" seed={mentor.id} /><div><p className="rx-p rx-strong">{mentor.name}</p><p className="rx-sm">{mentor.headline}</p></div></div>
          {!isFacilitator && canSwap && <SwapButton cmId={cmId} />}
          {!isFacilitator && !canSwap && <p className="rx-sm">{state.swapUsed ? 'Your Circle has used its free swap.' : 'You can suggest a different mentor after your first session.'}</p>}
          {(isFacilitator || circle.isFacilitator) && <PauseButton cmId={cmId} paused={state.kind === 'paused'} />}
          <p className="rx-sm">{first} sees your Circle’s agreement, the questions you send and first names. Your Circle chat and weekly reports stay private from mentors.</p>
          <GoLink href="/experts">Live expert sessions</GoLink>
          {mentorProfile && <GoLink href="/sessions/mentoring">Mentor view</GoLink>}
        </Aside>
      </div>
    </Page>
  );
}
