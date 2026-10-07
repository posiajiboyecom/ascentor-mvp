// app/(app)/circle/page.tsx
// Circle: the confidentiality pledge on first entry, then home (seats, next meeting, welcome thread, reports).

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Check, FileText, TrendingUp, ChevronRight, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getMe, getMyCircle } from '@/lib/rx/server';
import { circleMessages } from '@/lib/rx/circle';
import { CIRCLE_FOCUS, CIRCLE_MAX, CIRCLE_MIN_TO_START } from '@/lib/rx/constants';
import { nextWeekdayAt, whenLabel } from '@/lib/rx/dates';
import { Aside, Avatar, Bar, Page, Title, Tag } from '@/components/rx/ui';
import { PlaceMeButton, PledgeButtons } from '@/components/rx/circle/CircleClient';

export const dynamic = 'force-dynamic';

export default async function CirclePage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const circle = await getMyCircle();
  const db = await createClient();
  const { data: facil } = await db.from('circle_seats').select('circle_id').eq('user_id', me.userId).eq('role', 'facilitator').limit(1).maybeSingle();

  if (!circle) {
    return (
      <Page>
        <Title>Circle</Title>
        <div className="rx-two">
          <div className="rx-card rx-empty">
            <p className="rx-h2">Your Circle is being set up</p>
            <p className="rx-p" style={{ color: 'var(--rx-muted)', maxWidth: 420 }}>A Circle is 6 to 8 people with a facilitator, meeting weekly for 90 days. We place you with members who share your language and time zone.</p>
            <PlaceMeButton />
          </div>
          <Aside>
            <p className="rx-label">How a Circle works</p>
            <p className="rx-p">You join a small group and open your chat on day one.</p>
            <p className="rx-p">Meetings start once 6 members have joined.</p>
            <p className="rx-p">Each week you share a short report with your Circle.</p>
            {facil && <Link href="/circle/facilitator" className="rx-link">Facilitator view</Link>}
          </Aside>
        </div>
      </Page>
    );
  }

  // Confidentiality pledge comes first.
  if (!circle.pledged) {
    return (
      <Page>
        <Title>Before you enter</Title>
        <div className="rx-two">
          <div className="rx-card rx-stack">
            <p className="rx-label">Confidentiality pledge</p>
            <p className="rx-big" style={{ fontSize: 20 }}>What’s shared in this Circle stays in this Circle.</p>
            <div className="rx-stack-sm">
              {['I won’t share others’ stories, names or screenshots.', 'I’ll listen first and advise only when asked.', 'I’ll tell the facilitator if I can’t make it.'].map((t) => (
                <p key={t} className="rx-row rx-nw rx-p" style={{ gap: 10, alignItems: 'flex-start' }}><Check aria-hidden style={{ width: 18, height: 18, marginTop: 3, flex: 'none', color: 'var(--rx-gold)' }} />{t}</p>
              ))}
            </div>
            <PledgeButtons />
          </div>
          <Aside><p className="rx-label">Why this matters</p><p className="rx-p">People share more when they feel safe. Wins you choose to post publicly are the one exception, and only your own.</p></Aside>
        </div>
      </Page>
    );
  }

  const ready = circle.memberCount >= CIRCLE_MIN_TO_START && !!circle.circle.cycle_start;
  const msgs = (await circleMessages(db, circle.circle.id, null, 3)).slice(-3);
  const pinned = msgs.find((m) => m.pinned) ?? null;
  const rest = msgs.filter((m) => !m.pinned).slice(-2);
  const week = circle.week ?? 1;
  const focus = CIRCLE_FOCUS[week - 1];
  const next = ready ? nextWeekdayAt(circle.circle.meeting_dow, circle.circle.meeting_time.slice(0, 5), circle.circle.timezone) : null;
  const members = circle.seats.filter((s) => s.role === 'member');
  const open = Math.max(0, CIRCLE_MAX - members.length);
  const pct = Math.round((Math.min(members.length, CIRCLE_MIN_TO_START) / CIRCLE_MIN_TO_START) * 100);

  const nextList: [string, 'done' | 'cur' | ''][] = ready
    ? [['Your Circle has 6 or more members.', 'done'], ['Weekly meetings are on.', 'done'], ['Share your report before Thursday.', 'cur'], ['Review together in week 12.', '']]
    : [['You joined and your group chat opened.', 'done'], ['Say hello in the welcome thread.', 'cur'], ['Your first meeting is set once 6 have joined.', ''], ['Your 90-day cycle starts at that meeting.', '']];

  return (
    <Page>
      <p className="rx-sm">{circle.circle.name} · Circle {circle.circle.number}{circle.facilitatorName ? ` · with ${circle.facilitatorName}` : ''}</p>
      <Title tag={<Tag>{ready ? `Week ${week} of 12` : 'Meetings start at 6'}</Tag>}>Circle</Title>
      <div className="rx-two">
        <div className="rx-stack-lg">
          <div className="rx-card rx-stack">
            <div className="rx-between"><p className="rx-label">Your Circle</p><span className="rx-sm">{members.length} of {CIRCLE_MAX} seats filled</span></div>
            <div className="rx-seats">
              {members.map((m) => (
                <div key={m.userId} className="rx-seat"><Avatar name={m.name} url={m.avatarUrl} size="md" seed={m.userId} /><span className="rx-sm" style={{ whiteSpace: 'nowrap' }}>{m.isMe ? 'You' : m.name.split(' ')[0]}</span></div>
              ))}
              {Array.from({ length: open }).map((_, i) => (
                <div key={`o${i}`} className="rx-seat"><span className="rx-avatar md empty" aria-hidden /><span className="rx-sm" style={{ whiteSpace: 'nowrap' }}>Open seat</span></div>
              ))}
            </div>
          </div>

          {!ready && (
            <div className="rx-soft rx-stack-sm">
              <div className="rx-row rx-nw" style={{ gap: 12 }}>
                <Clock aria-hidden style={{ width: 20, height: 20, color: 'var(--rx-muted)', flex: 'none' }} />
                <div><p className="rx-p rx-strong">Your meetings start when 6 members have joined.</p><p className="rx-sm">{members.length} of 6 so far.</p></div>
              </div>
              <Bar pct={pct} label={`${members.length} of 6 so far`} />
            </div>
          )}

          {ready && next && (
            <div className="rx-card rx-stack-sm">
              <p className="rx-label">Next meeting</p>
              <p className="rx-h2">{whenLabel(next, me.tz)}</p>
              <p className="rx-sm">Video · 60 minutes · focus: {focus}</p>
              <div className="rx-row" style={{ marginTop: 6 }}>
                <Link href="/circle/meeting" className="rx-btn primary">Join</Link>
                <Link href="/circle/meeting" className="rx-link">See agenda</Link>
              </div>
            </div>
          )}

          <div className="rx-card rx-stack-sm">
            <div className="rx-between"><p className="rx-label">Welcome thread</p><span className="rx-sm">Pinned</span></div>
            {pinned && <div className="rx-bub oth" style={{ maxWidth: '100%' }}><div className="rx-who">{pinned.name}</div>{pinned.body}</div>}
            {rest.map((m) => <div key={m.id} className="rx-bub oth" style={{ maxWidth: '100%' }}><div className="rx-who">{m.userId === me.userId ? 'You' : m.name}</div>{m.body.startsWith('[') ? 'Shared a file' : m.body}</div>)}
            <div style={{ marginTop: 4 }}><Link href="/circle/chat" className={`rx-btn ${ready ? 'secondary' : 'primary'}`}>Open group chat</Link></div>
          </div>

          {ready && (
            <div className="rx-card" style={{ padding: '4px 16px' }}>
              <Link href="/circle/reports" className="rx-rowlink"><span className="ri"><FileText aria-hidden /></span><span className="rt"><span className="t">Weekly reports</span><span className="m">Yours is open</span></span><ChevronRight aria-hidden /></Link>
              <Link href="/circle/review" className="rx-rowlink"><span className="ri"><TrendingUp aria-hidden /></span><span className="rt"><span className="t">End-of-cycle review</span><span className="m">Opens in week 12</span></span><ChevronRight aria-hidden /></Link>
            </div>
          )}
        </div>

        <Aside>
          <p className="rx-label">What happens next</p>
          {nextList.map(([t, st]) => (
            <p key={t} className="rx-row rx-nw rx-p" style={{ gap: 10, alignItems: 'flex-start' }}>
              <span className={`rx-pd${st === 'done' ? ' done' : st === 'cur' ? ' cur' : ''}`} style={{ marginTop: 2 }}>{st === 'done' && <Check aria-hidden />}</span>{t}
            </p>
          ))}
          {facil && <div><Link href="/circle/facilitator" className="rx-link">Facilitator view</Link></div>}
        </Aside>
      </div>
    </Page>
  );
}
