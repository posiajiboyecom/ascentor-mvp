// app/(app)/circle/detail.tsx
// Circle: the confidentiality pledge on first entry, then home (seats, next meeting, welcome thread, reports).

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Check, FileText, TrendingUp, ChevronRight, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getMe, getMyCircle } from '@/lib/rx/server';
import { circleMessages } from '@/lib/rx/circle';
import { CIRCLE_FOCUS, CIRCLE_MAX, CIRCLE_MIN_TO_START } from '@/lib/rx/constants';
import { nextWeekdayAt, whenLabel } from '@/lib/rx/dates';
import { Aside, Avatar, Bar, BackLink, Page, Title, Tag } from '@/components/rx/ui';
import { circleTitle, getMyCircles } from '@/lib/rx/circles';
import { PledgeButtons } from '@/components/rx/circle/CircleClient';
import { AgendaDrawer } from '@/components/rx/circle/AgendaDrawer';

export async function CircleDetail({ circleId }: { circleId: string }) {
  const me = await getMe();
  if (!me) redirect('/login');
  const circle = await getMyCircle('member', circleId);
  const card = (await getMyCircles()).find((x) => x.id === circleId) ?? null;
  const db = await createClient();
  const { data: facil } = await db.from('circle_seats').select('circle_id').eq('user_id', me.userId).eq('role', 'facilitator').limit(1).maybeSingle();

  if (!circle) redirect('/circle');

  // Confidentiality pledge comes first.
  if (!circle.pledged) {
    return (
      <Page>
        <Title>Before you enter</Title>
        <div className="rx-two">
          <div className="rx-card rx-stack">
            <p className="rx-label">Confidentiality pledge</p>
            <p className="rx-big" style={{ fontSize: 20 }}>What’s shared in this Circle stays among its members.</p>
            <div className="rx-stack-sm">
              {['I won’t share others’ stories, names or screenshots.', 'I’ll listen first and advise only when asked.', 'I’ll tell the facilitator if I can’t make it.'].map((t) => (
                <p key={t} className="rx-row rx-nw rx-p" style={{ gap: 10, alignItems: 'flex-start' }}><Check aria-hidden style={{ width: 18, height: 18, marginTop: 3, flex: 'none', color: 'var(--rx-gold)' }} />{t}</p>
              ))}
            </div>
            <PledgeButtons circleId={circle.circle.id} />
          </div>
          <Aside><p className="rx-label">Why this matters</p><p className="rx-p">People share more when they feel safe. Wins you choose to post publicly are the one exception, and only your own.</p><p className="rx-sm">The Ascentor team can review chats for safety and to improve Ascentor, as you agreed when you joined. Other members outside your Circle cannot read them.</p></Aside>
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

  const nextList: [string, 'done' | 'cur' | ''][] = (card?.state.steps ?? []).map((st) => [st.label, st.status === 'done' ? 'done' : st.status === 'current' ? 'cur' : ''] as [string, 'done' | 'cur' | '']);
  const actionHref = card?.state.action?.to === 'sessions' ? `/sessions?c=${circle.circle.id}` : `/circle/chat?c=${circle.circle.id}`;

  return (
    <Page>
      <BackLink href="/circle">All my Circles</BackLink>
      <p className="rx-sm">{circleTitle(circle.circle)}{circle.facilitatorName ? ` · with ${circle.facilitatorName}` : ''}{card?.isDemo ? ' · Demo' : ''}</p>
      <Title tag={<Tag>{ready ? `Week ${week} of 12` : 'Meetings start at 4'}</Tag>}>Circle</Title>
      <div className="rx-two">
        <div className="rx-stack-lg">
          {card && (
            <div className="rx-card rx-stack-sm" role="status">
              <p className="rx-label">Where we are</p>
              <p className="rx-h2">{card.state.headline}</p>
              {card.state.detail && <p className="rx-p" style={{ color: 'var(--rx-muted)' }}>{card.state.detail}</p>}
              {card.state.action && <div style={{ marginTop: 4 }}><Link href={actionHref} className="rx-btn primary">{card.state.action.label}</Link></div>}
            </div>
          )}
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
                <div><p className="rx-p rx-strong">Your meetings start when 4 members have joined.</p><p className="rx-sm">{members.length} of 4 so far.</p></div>
              </div>
              <Bar pct={pct} label={`${members.length} of 4 so far`} />
            </div>
          )}

          {ready && next && (
            <div className="rx-card rx-stack-sm">
              <p className="rx-label">Next meeting</p>
              <p className="rx-h2">{whenLabel(next, me.tz)}</p>
              <p className="rx-sm">Audio call, camera optional · 15 minutes · focus: {focus}</p>
              <div className="rx-row" style={{ marginTop: 6 }}>
                <Link href={`/call/${circle.circle.id}`} className="rx-btn primary">Join</Link>
                <Link href={`/circle/meeting?c=${circle.circle.id}`} className="rx-link">See agenda</Link>
              </div>
            </div>
          )}

          <AgendaDrawer circleId={circle.circle.id} meId={me.userId} />

          <div className="rx-card rx-stack-sm">
            <div className="rx-between"><p className="rx-label">Welcome thread</p><span className="rx-sm">Pinned</span></div>
            {pinned && <div className="rx-bub oth" style={{ maxWidth: '100%' }}><div className="rx-who">{pinned.name}</div>{pinned.body}</div>}
            {rest.map((m) => <div key={m.id} className="rx-bub oth" style={{ maxWidth: '100%' }}><div className="rx-who">{m.userId === me.userId ? 'You' : m.name}</div>{m.body.startsWith('[') ? 'Shared a file' : m.body}</div>)}
            <div style={{ marginTop: 4 }}><Link href={`/circle/chat?c=${circle.circle.id}`} className={`rx-btn ${ready ? 'secondary' : 'primary'}`}>Open group chat</Link></div>
          </div>

          {ready && (
            <div className="rx-card" style={{ padding: '4px 16px' }}>
              <Link href={`/circle/reports?c=${circle.circle.id}`} className="rx-rowlink"><span className="ri"><FileText aria-hidden /></span><span className="rt"><span className="t">Weekly reports</span><span className="m">Yours is open</span></span><ChevronRight aria-hidden /></Link>
              <Link href={`/circle/review?c=${circle.circle.id}`} className="rx-rowlink"><span className="ri"><TrendingUp aria-hidden /></span><span className="rt"><span className="t">End-of-cycle review</span><span className="m">Opens in week 12</span></span><ChevronRight aria-hidden /></Link>
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
