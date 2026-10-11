// app/(app)/circle/page.tsx
// Circles: every Circle you belong to, where each one stands, and the Circles you can still join. A member can sit in up to
// three. Open one to see its seats, chat, calls, reports and mentor vote.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Users } from 'lucide-react';
import { getMe } from '@/lib/rx/server';
import { circleTitle, findCircles, getMyCircles } from '@/lib/rx/circles';
import { CIRCLES_PER_MEMBER, CIRCLE_MAX } from '@/lib/rx/constants';
import { Aside, Avatar, Page, Tag, Title } from '@/components/rx/ui';
import { JoinCircleButton, LeaveCircleButton, PlaceMeCard } from '@/components/rx/circle/CircleList';
import { CircleDetail } from './detail';

export const dynamic = 'force-dynamic';

export default async function CirclesPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const sp = await searchParams;
  const me = await getMe();
  if (!me) redirect('/login');
  if (sp.c && /^[0-9a-f-]{36}$/i.test(sp.c)) return <CircleDetail circleId={sp.c} />;

  const [mine, open] = await Promise.all([getMyCircles(), findCircles()]);
  const memberOf = mine.filter((c) => c.role === 'member').length;
  const canJoin = memberOf < CIRCLES_PER_MEMBER;

  return (
    <Page>
      <Title tag={mine.length > 0 ? <Tag>{memberOf} of {CIRCLES_PER_MEMBER} Circles</Tag> : undefined}>Circles</Title>
      <div className="rx-two">
        <div className="rx-stack-lg">
          {mine.length === 0 && (
            <div className="rx-card rx-empty">
              <span className="rx-dimdot" aria-hidden><Users /></span>
              <p className="rx-h2">You’re not in a Circle yet</p>
              <p className="rx-p" style={{ color: 'var(--rx-muted)', maxWidth: 440 }}>A Circle is up to {CIRCLE_MAX} people who meet weekly for 90 days. We can place you with members who share your language and time, or you can pick one by interest below.</p>
              <PlaceMeCard />
            </div>
          )}

          {mine.map((c) => (
            <section key={c.id} className="rx-card rx-stack-sm" aria-label={circleTitle(c)}>
              <div className="rx-between" style={{ alignItems: 'flex-start', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <h2 className="rx-h2" style={{ margin: 0 }}>{circleTitle(c)}</h2>
                  <p className="rx-sm">{c.isHome ? 'Your home Circle' : 'Interest Circle'}{c.facilitatorName ? ` · with ${c.facilitatorName}` : ''}{c.language && c.language !== 'English' ? ` · ${c.language}` : ''}</p>
                </div>
                <div className="rx-row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {c.isDemo && <Tag>Demo</Tag>}
                  {c.role === 'facilitator' && <Tag gold>Facilitator</Tag>}
                </div>
              </div>

              <div className="rx-row" style={{ gap: 4, flexWrap: 'wrap' }} aria-label={`${c.members} of ${CIRCLE_MAX} seats filled`}>
                {c.seats.map((s) => <Avatar key={s.userId} name={s.name} url={s.avatarUrl} size="sm" seed={s.userId} />)}
                {Array.from({ length: Math.max(0, CIRCLE_MAX - c.members) }).map((_, i) => <span key={i} className="rx-avatar sm empty" aria-hidden />)}
                <span className="rx-sm" style={{ marginLeft: 6 }}>{c.members} of {CIRCLE_MAX}</span>
              </div>

              <p className="rx-p rx-strong" style={{ margin: 0 }}>{c.state.headline}</p>
              {c.state.detail && <p className="rx-sm">{c.state.detail}</p>}

              <div className="rx-row" style={{ gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
                <Link href={c.role === 'facilitator' ? `/circle/facilitator?c=${c.id}` : `/circle?c=${c.id}`} className="rx-btn primary">Open Circle</Link>
                {c.role === 'member' && c.state.action && c.state.action.to === 'sessions' && <Link href={`/sessions?c=${c.id}`} className="rx-btn secondary">{c.state.action.label}</Link>}
                {c.role === 'member' && c.ready && <Link href={`/call/${c.id}`} className="rx-btn secondary">{c.callOpenNow ? 'Join the call now' : 'Call'}</Link>}
                {c.role === 'member' && !c.isHome && <LeaveCircleButton circleId={c.id} name={circleTitle(c)} />}
              </div>
            </section>
          ))}

          {open.length > 0 && (
            <div className="rx-stack">
              <div>
                <h2 className="rx-h2" style={{ margin: 0 }}>Find a Circle</h2>
                <p className="rx-sm">{canJoin ? `Pick one that fits what you want to grow. You can be in up to ${CIRCLES_PER_MEMBER}.` : `You’re in ${CIRCLES_PER_MEMBER} Circles. Leave one to join another.`}</p>
              </div>
              {open.map((c) => (
                <div key={c.id} className="rx-card" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="rx-h3" style={{ margin: 0 }}>{circleTitle(c)}{c.isDemo && <span style={{ marginLeft: 8 }}><Tag>Demo</Tag></span>}</p>
                    <p className="rx-sm">{c.members} of {CIRCLE_MAX} joined · {c.seatsLeft} {c.seatsLeft === 1 ? 'seat' : 'seats'} left{c.ready ? ' · meetings running' : ' · meetings start at 6'}</p>
                    {c.reason && <p className="rx-p" style={{ fontSize: 14, marginTop: 4 }}>{c.reason}</p>}
                  </div>
                  {canJoin ? <JoinCircleButton circleId={c.id} /> : <span className="rx-sm">Full</span>}
                </div>
              ))}
            </div>
          )}
          {open.length === 0 && mine.length > 0 && <p className="rx-sm">No other Circles have open seats right now. New ones open as members join.</p>}
        </div>

        <Aside>
          <p className="rx-label">How Circles work</p>
          <p className="rx-p">A Circle is up to {CIRCLE_MAX} people who share an interest and meet each week for 90 days.</p>
          <p className="rx-p">Meetings start once 6 have joined. Calls are 15 minutes, audio only.</p>
          <p className="rx-p">Each Circle chooses its own mentor by vote. The highest vote wins.</p>
          <p className="rx-sm">You can be in up to {CIRCLES_PER_MEMBER} Circles. Your first is your home Circle and stays.</p>
        </Aside>
      </div>
    </Page>
  );
}
