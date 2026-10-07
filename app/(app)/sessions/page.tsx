// app/(app)/sessions/page.tsx
// Sessions: one-to-one time with a mentor. Shows the right state: no mentor yet, a request waiting, or an active mentorship.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Users2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/rx/server';
import { agreementFor, mentorMessages, myMatch, myMentorProfile } from '@/lib/rx/mentors';
import { whenLabel } from '@/lib/rx/dates';
import { Aside, Avatar, GoLink, Page, Title } from '@/components/rx/ui';
import { EndMentorshipButton, PendingCard, Workspace } from '@/components/rx/sessions/SessionsClient';

export const dynamic = 'force-dynamic';

export default async function SessionsPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const [current, mentorProfile] = await Promise.all([myMatch(), myMentorProfile()]);

  // ── no mentor yet ──
  if (!current) {
    return (
      <Page>
        <Title>Sessions</Title>
        <div className="rx-two">
          <div className="rx-card rx-empty" style={{ padding: '32px 20px' }}>
            <span className="rx-dimdot" aria-hidden><Users2 /></span>
            <p className="rx-h2">One-to-one time with a mentor</p>
            <p className="rx-p" style={{ color: 'var(--rx-muted)', maxWidth: 420 }}>People further along your road. You choose them. Nobody is assigned.</p>
            <Link href="/sessions/intake" className="rx-btn primary">Find a mentor</Link>
          </div>
          <Aside>
            <p className="rx-label">How it works</p>
            <p className="rx-p">Tell us what you want.</p><p className="rx-p">Pick from two or three people.</p>
            <p className="rx-p">Meet for a taster session.</p><p className="rx-p">Agree goals and tasks together.</p>
            <GoLink href="/experts">Live expert sessions</GoLink>
            {mentorProfile && <GoLink href="/sessions/mentoring">Mentor view</GoLink>}
          </Aside>
        </div>
      </Page>
    );
  }

  const { match, mentor } = current;
  const first = mentor.name.split(' ')[0];

  // ── a request is waiting ──
  if (match.status === 'requested') {
    return (
      <Page>
        <Title>Sessions</Title>
        <div className="rx-two">
          <div className="rx-card rx-stack">
            <div className="rx-row rx-nw" style={{ gap: 14 }}>
              <Avatar name={mentor.name} url={mentor.avatar_url} size="lg" seed={mentor.id} />
              <div><p className="rx-sm">Taster requested</p><p className="rx-h2">{mentor.name}</p></div>
            </div>
            <p className="rx-p">Waiting for {first} to accept. Most mentors reply within two days.</p>
            <PendingCard matchId={match.id} mentorFirst={first} initialAsk={match.first_ask ?? ''} />
          </div>
          <Aside>
            <p className="rx-label">Proposed time</p>
            <p className="rx-p rx-strong">{match.slot_at ? whenLabel(match.slot_at, me.tz) : 'Not chosen yet'}</p>
            <p className="rx-sm">In your time zone.</p>
            <GoLink href={`/sessions/book/${mentor.id}?match=${match.id}`}>{match.slot_at ? 'Change time' : 'Pick a time'}</GoLink>
          </Aside>
        </div>
      </Page>
    );
  }

  // ── active mentorship ──
  const db = await createClient();
  const [agreement, msgs] = await Promise.all([agreementFor(db, match.id), mentorMessages(db, match.id)]);
  const upcoming = match.slot_at && new Date(match.slot_at) > new Date();

  return (
    <Page>
      <p className="rx-sm">With {mentor.name}</p>
      <Title>Sessions</Title>
      <div className="rx-two">
        <div className="rx-stack-lg">
          <div className="rx-card rx-stack-sm">
            <p className="rx-label">{upcoming ? 'Next session' : 'Your sessions'}</p>
            <p className="rx-h2">{upcoming ? whenLabel(match.slot_at as string, me.tz) : 'No session booked'}</p>
            <p className="rx-sm">{upcoming ? `${(mentor.formats ?? ['Video']).join(' or ')} · ${first} will share the call link in the chat below.` : 'Pick a time that suits you both.'}</p>
            <div className="rx-row" style={{ marginTop: 6 }}><Link href={`/sessions/book/${mentor.id}?match=${match.id}&mode=reschedule`} className="rx-btn secondary">{upcoming ? 'Reschedule' : 'Pick a time'}</Link></div>
          </div>
          <Workspace matchId={match.id} role="member" agreement={agreement} meId={me.userId} initialMessages={msgs} otherName={first} />
        </div>
        <Aside>
          <p className="rx-label">Past sessions</p>
          {match.slot_at && !upcoming ? <><p className="rx-p">Session · {whenLabel(match.slot_at, me.tz)}</p></> : <p className="rx-sm">Your first session is a taster. Nothing here yet.</p>}
          <EndMentorshipButton matchId={match.id} />
          <GoLink href="/experts">Live expert sessions</GoLink>
          {mentorProfile && <GoLink href="/sessions/mentoring">Mentor view</GoLink>}
        </Aside>
      </div>
    </Page>
  );
}
