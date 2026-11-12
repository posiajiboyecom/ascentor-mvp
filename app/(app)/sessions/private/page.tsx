// app/(app)/sessions/private/page.tsx
// Pinnacle: one private 20-minute session a month with a mentor, booked from the mentor's open times, with an agenda.
// Members on other plans see what it is and how to get it.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/rx/server';
import { getMemberAccess } from '@/lib/access';
import { bookableMentors, memberPrivateSessions } from '@/lib/rx/private-mentor';
import { AGENDA_MAX, MEMBER_CHANGE_HOURS, monthKey, memberCanChange, PRIVATE_SESSION_MINUTES, BOOK_AHEAD_HOURS } from '@/lib/rx/private-mentor-rules';
import { whenLabel } from '@/lib/rx/dates';
import { Aside, BackLink, GoLink, Page, Title } from '@/components/rx/ui';
import { PrivateAgendaEditor, PrivateBooking, PrivateCancel } from '@/components/rx/sessions/PrivateSessionClient';

export const dynamic = 'force-dynamic';

export default async function PrivateSessionPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const access = await getMemberAccess(me.userId);
  const tz = me.tz;

  const side = (
    <Aside>
      <p className="rx-label">How it works</p>
      <p className="rx-p">One private session a month, {PRIVATE_SESSION_MINUTES} minutes, with the mentor you choose.</p>
      <p className="rx-p">Book at least {BOOK_AHEAD_HOURS / 24} days ahead and write an agenda. Your mentor gets it with the booking.</p>
      <p className="rx-p">You can change the agenda or cancel up to {MEMBER_CHANGE_HOURS} hours before. Cancelling gives you the month back.</p>
      <p className="rx-p">Mentors give their time for free. Your agenda is how you respect it.</p>
      <GoLink href="/sessions">Circle mentorship</GoLink>
    </Aside>
  );

  if (!access.features.privateMentor) {
    const paused = access.level === 'light';
    return (
      <Page>
        <BackLink href="/sessions">Sessions</BackLink>
        <Title>Private mentor session</Title>
        <div className="rx-two">
          <div className="rx-card rx-stack-sm" style={{ maxWidth: 560 }}>
            <p className="rx-h3">{paused ? 'Private sessions are paused' : 'Part of Pinnacle'}</p>
            <p className="rx-p">{paused
              ? 'Reactivate your plan in Billing and you can book straight away.'
              : 'Pinnacle members get a private 20-minute session with a mentor every month, on top of Circle mentorship. Pinnacle also includes Sage with no daily cap, four live expert sessions a month and priority support.'}</p>
            <div><Link href="/settings/billing" className="rx-btn primary">{paused ? 'Reactivate' : 'See Pinnacle in Billing'}</Link></div>
          </div>
          {side}
        </div>
      </Page>
    );
  }

  const now = new Date();
  const [sessions, mentors] = await Promise.all([memberPrivateSessions(me.userId), bookableMentors(me.userId, now)]);
  const live = sessions.filter((s) => s.status !== 'cancelled');
  const upcoming = live.filter((s) => new Date(s.startsAt).getTime() + s.durationMin * 60000 > now.getTime()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = live.filter((s) => !upcoming.includes(s)).slice(0, 6);
  const blockedMonths = [...new Set(live.map((s) => monthKey(s.startsAt)))];
  const thisMonthUsed = blockedMonths.includes(monthKey(now));

  const label = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: tz });

  return (
    <Page>
      <BackLink href="/sessions">Sessions</BackLink>
      <Title>Private mentor session</Title>
      <div className="rx-two">
        <div className="rx-stack-lg">
          {upcoming.map((s) => (
            <div key={s.id} className="rx-card rx-stack-sm">
              <p className="rx-label">Booked · with {s.mentorName}</p>
              <p className="rx-h2">{whenLabel(s.startsAt, tz)}</p>
              <p className="rx-sm">{s.durationMin} minutes · audio by default · the room opens 5 minutes before</p>
              <p className="rx-sm rx-strong">Your agenda</p>
              <p className="rx-p" style={{ whiteSpace: 'pre-wrap' }}>{s.agenda}</p>
              <div className="rx-row" style={{ gap: 16, alignItems: 'center' }}>
                <a href={`/call/private/${s.id}`} className="rx-btn primary">Join the call room</a>
                {memberCanChange(new Date(s.startsAt), now) && <PrivateAgendaEditor sessionId={s.id} agenda={s.agenda} agendaMax={AGENDA_MAX} />}
                {memberCanChange(new Date(s.startsAt), now) && <PrivateCancel sessionId={s.id} role="member" />}
              </div>
            </div>
          ))}

          <div className="rx-stack-sm">
            <p className="rx-label">{upcoming.length ? 'Book another month' : thisMonthUsed ? 'Book next month' : 'Book this month’s session'}</p>
            {mentors.length === 0
              ? <div className="rx-card rx-empty"><p className="rx-p">No mentor has open times in the next few weeks. Check back soon: mentors add times regularly.</p></div>
              : <PrivateBooking blockedMonths={blockedMonths} agendaMax={AGENDA_MAX} mentors={mentors.map((m) => ({
                  id: m.id, name: m.name, headline: m.headline, tags: m.tags, avatarUrl: m.avatarUrl,
                  slots: m.slots.slice(0, 12).map((x) => ({ id: x.id, label: label(x.startsAt), month: monthKey(x.startsAt) })),
                }))} />}
          </div>

          {past.length > 0 && (
            <div className="rx-card rx-stack-sm">
              <p className="rx-label">Earlier sessions</p>
              {past.map((s) => <p key={s.id} className="rx-sm">{label(s.startsAt)} · {s.mentorName}</p>)}
            </div>
          )}
        </div>
        {side}
      </div>
    </Page>
  );
}
