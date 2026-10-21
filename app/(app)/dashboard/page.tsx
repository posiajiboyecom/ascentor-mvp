// app/(app)/dashboard/page.tsx
// Today: this week's plan, today's check-in, and the few things that matter next (lesson, Circle, mentor).
// Server component: everything arrives in one parallel pass; the interactive cards are small client islands.

import '@/styles/rx-circle.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, CalendarDays, Play } from 'lucide-react';
import { getMe, getMyCircle } from '@/lib/rx/server';
import { getLessonProgress, getLessons, getTodayState, pickWeekLesson } from '@/lib/rx/practice';
import { getBannerAnnouncement } from '@/lib/rx/announcements';
import { getMentorship } from '@/lib/rx/cmentor';
import { CIRCLE_FOCUS, CIRCLE_MIN_TO_START } from '@/lib/rx/constants';
import { longDate, nextWeekdayAt, whenLabel } from '@/lib/rx/dates';
import { createClient } from '@/lib/supabase/server';
import { Check, Lock } from 'lucide-react';
import { deriveBilling } from '@/lib/billing-state';
import { Banner } from '@/components/rx/ui';
import DayOneCard from '@/components/rx/today/DayOneCard';
import { Aside, Page, SageLine, Tag } from '@/components/rx/ui';
import PlanCard from '@/components/rx/today/PlanCard';
import CheckinCard from '@/components/rx/today/CheckinCard';
import AnnouncementBanner from '@/components/rx/today/AnnouncementBanner';
import MoreForToday, { type MoreRow } from '@/components/rx/today/MoreForToday';
import ConsentCard from '@/components/rx/today/ConsentCard';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const me = await getMe();
  if (!me) redirect('/login');

  const [state, circle, banner, lessons, progress] = await Promise.all([
    getTodayState(), getMyCircle(), getBannerAnnouncement(), getLessons(), getLessonProgress(),
  ]);
  if (!state) redirect('/login');

  const ms = await getMentorship().catch(() => null);

  const billDb = await createClient();
  const { data: billProf } = await billDb.from('profiles').select('subscription_plan, subscription_status, subscription_end').eq('id', me.userId).maybeSingle();
  const bill = deriveBilling(billProf, me.tz);
  let reportShared = false;
  if (circle?.pledged && circle.week) {
    const db = await createClient();
    const { count } = await db.from('circle_reports').select('id', { count: 'exact', head: true }).eq('circle_id', circle.circle.id).eq('user_id', me.userId).eq('week_no', circle.week);
    reportShared = (count ?? 0) > 0;
  }
  const lesson = pickWeekLesson(lessons, state.week, progress);
  const lessonDone = !!(lesson && progress.get(lesson.id)?.practice_id);
  const plan = state.practice;

  const sageLine = state.missed ? 'Welcome back. Today is open.' : plan ? 'Your plan is set. One step is enough.' : 'Let’s set this week’s plan together.';

  // Circle row: waiting for 6 members, or the next meeting.
  const ready = !!circle && circle.memberCount >= CIRCLE_MIN_TO_START && !!circle.circle.cycle_start;
  let circleRow: MoreRow;
  if (!circle) circleRow = { title: 'Your Circle', meta: 'Being set up', href: '/circle' };
  else if (!ready) circleRow = { title: 'Your Circle', meta: `${circle.memberCount} of ${CIRCLE_MIN_TO_START} joined · chat is open`, href: '/circle' };
  else {
    const next = nextWeekdayAt(circle.circle.meeting_dow, circle.circle.meeting_time.slice(0, 5), circle.circle.timezone);
    circleRow = { title: 'Next Circle meeting', meta: whenLabel(next, me.tz), href: '/circle' };
  }
  const lessonRow: MoreRow | null = lesson ? { title: lesson.title, meta: `This week’s lesson · ${lessonDone ? 'practice set' : `${lesson.minutes} min`}`, href: `/learn/lesson/${lesson.slug}` } : null;
  const mst = ms?.state;
  const mentorRow: MoreRow = mst && (mst.kind === 'active' || mst.kind === 'paused')
    ? { title: 'Mentor session', meta: mst.next ? whenLabel(mst.next.startsAt, me.tz) : `${mst.agreement.tasks.filter((t) => t.ownerConfirmed && t.mentorConfirmed).length} of ${mst.agreement.tasks.length} agreement tasks done`, href: '/sessions' }
    : mst && (mst.kind === 'voting' || mst.kind === 'tie') ? { title: 'Choose your Circle’s mentor', meta: 'Voting is open', href: '/sessions' }
    : mst && (mst.kind === 'requested' || mst.kind === 'scheduling') ? { title: 'Your Circle’s mentor', meta: mst.kind === 'scheduling' ? 'Pick a time' : 'Waiting for their answer', href: '/sessions' }
    : { title: 'Mentor sessions', meta: 'Your Circle chooses a mentor together', href: '/sessions' };

  const mobileRows = [circleRow, ...(lessonRow ? [lessonRow] : []), mentorRow];
  const kept = state.keptThisWeek;
  const hasReportStep = !!circle?.pledged && !!circle.week;
  const allDone = state.todayStatus === 'kept' && (!hasReportStep || reportShared) && (!lesson || lessonDone);
  const dayOne = !plan && !state.todayStatus && state.week <= 1 && !!me.profile?.onboarded_at;

  return (
    <Page>
      <div className="rx-two">
        <div className="rx-stack-lg">
          {me.profile?.onboarded_at && !me.profile?.chat_consent_at && <ConsentCard />}
          {!me.profile?.onboarded_at && (
            <div className="rx-soft rx-stack-sm rx-rise">
              <p className="rx-p rx-strong">Finish setting up</p>
              <p className="rx-sm">Two minutes: your interests, goals, time zone and language. It places you in a Circle and personalises Sage.</p>
              <div><Link href="/onboarding?redo=1" className="rx-btn primary">Continue setup</Link></div>
            </div>
          )}
          {bill.state === 'trialEnding' && (bill.daysLeft ?? 99) <= 3 && (
            <Banner><b>Your first period ends in {bill.daysLeft} {bill.daysLeft === 1 ? 'day' : 'days'}.</b> Renew before then to keep full access.<div><Link href="/settings?tab=plan" className="rx-link" style={{ color: 'inherit', minHeight: 36, fontSize: 14 }}>Manage plan<ArrowRight aria-hidden /></Link></div></Banner>
          )}
          {bill.state === 'failed' && (
            <Banner error><b>We couldn’t take your payment.</b> Update your card within 7 days to keep full access.<div><Link href="/settings?tab=plan" className="rx-link" style={{ color: 'inherit', minHeight: 36, fontSize: 14 }}>Update card<ArrowRight aria-hidden /></Link></div></Banner>
          )}
          {bill.state === 'lapsed' && (
            <div className="rx-card rx-stack-sm rx-rise">
              <div className="rx-row rx-nw" style={{ gap: 10 }}><Lock aria-hidden style={{ width: 20, height: 20, color: 'var(--rx-gold)' }} /><p className="rx-h3">You’re on light access</p></div>
              <p className="rx-p">Today, your Circle chat and Sage still work. Learn pathways, mentor sessions and joining new groups are paused.</p>
              <div className="rx-row"><Link href="/settings?tab=plan" className="rx-btn primary">Reactivate {bill.planName}</Link><Link href="/settings?tab=plan" className="rx-link">See plans<ArrowRight aria-hidden /></Link></div>
            </div>
          )}
          {banner && <AnnouncementBanner id={banner.id} title={banner.title} line={banner.line} btn={banner.btn_label || 'Open'} />}

          <div>
            <p className="rx-sm">{longDate(me.today)}</p>
            <div className="rx-between" style={{ alignItems: 'flex-end' }}>
              <h1 className="rx-title">Today</h1>
              {state.hasCycle && <Tag>Week {state.week} of 12</Tag>}
            </div>
            <span className="rx-rule" style={{ marginBottom: 14 }} />
            <SageLine>{sageLine}</SageLine>
          </div>

          {state.missed && (
            <div className="rx-soft rx-row rx-nw rx-rise" style={{ gap: 14 }}>
              <div><p className="rx-p rx-strong">A missed day doesn’t reset anything.</p><p className="rx-sm">Today’s practice is still here.</p></div>
            </div>
          )}

          {dayOne && <DayOneCard chatHref={circle?.pledged ? `/circle/chat?c=${circle.circle.id}` : null} lessonHref={lesson ? `/learn/lesson/${lesson.slug}` : null} lessonMeta={lesson ? `${lesson.title} · ${lesson.minutes} min` : ''} />}
          {allDone && (
            <div className="rx-card rx-stack rx-rise">
              <div className="rx-row rx-nw" style={{ gap: 14 }}><span className="rx-okb"><Check aria-hidden /></span><div><p className="rx-h3">That’s today done.</p><p className="rx-sm">Rest well. See you tomorrow.</p></div></div>
              <div className="rx-stack-sm">
                <p className="rx-row rx-nw rx-p" style={{ gap: 10 }}><Check aria-hidden style={{ width: 18, height: 18, color: 'var(--rx-gold)' }} />Practice kept</p>
                {hasReportStep && <p className="rx-row rx-nw rx-p" style={{ gap: 10 }}><Check aria-hidden style={{ width: 18, height: 18, color: 'var(--rx-gold)' }} />Circle report shared</p>}
                {lesson && <p className="rx-row rx-nw rx-p" style={{ gap: 10 }}><Check aria-hidden style={{ width: 18, height: 18, color: 'var(--rx-gold)' }} />This week’s lesson watched</p>}
              </div>
              <div className="rx-row"><Link href="/circle/chat" className="rx-btn secondary">Share a win</Link><Link href="/growth" className="rx-link">See my growth<ArrowRight aria-hidden /></Link></div>
            </div>
          )}
          <PlanCard
            goal={state.goal?.goal_text ?? null}
            plan={plan ? { cue: plan.cue, action: plan.action, trigger: plan.trigger ?? '', fallback: plan.fallback ?? '', obstacle: plan.obstacle ?? '', source: plan.source ?? '' } : null}
          />
          <CheckinCard initial={state.todayStatus} kept={kept} total={state.daysThisWeek} hasPlan={!!plan} />

          <div className="rx-mob"><MoreForToday rows={mobileRows} /></div>
        </div>

        <Aside>
          {lesson && (
            <div className="rx-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="rx-thumb" style={{ borderRadius: 0, aspectRatio: '16/8', alignItems: 'center', justifyContent: 'center' }}><Play aria-hidden style={{ width: 40, height: 40 }} /></div>
              <div className="rx-stack-sm" style={{ padding: '16px 18px 18px' }}>
                <p className="rx-sm">This week’s lesson · {lesson.minutes} min</p>
                <p className="rx-h3">{lesson.title}</p>
                <p className="rx-sm">{lessonDone ? 'Practice set' : 'Practice not set yet'}</p>
                <div><Link href={`/learn/lesson/${lesson.slug}`} className="rx-btn secondary">Open lesson</Link></div>
              </div>
            </div>
          )}
          <div className="rx-stack-sm rx-dsk">
            <p className="rx-label">More for today</p>
            <div>
              {[circleRow, mentorRow].map((r) => (
                <Link key={r.title} href={r.href} className="rx-rowlink">
                  <span className="ri"><CalendarDays aria-hidden /></span>
                  <span className="rt"><span className="t">{r.title}</span><span className="m">{r.meta}</span></span>
                </Link>
              ))}
            </div>
            {circle?.week ? <p className="rx-sm">Circle focus: {CIRCLE_FOCUS[circle.week - 1]}</p> : null}
          </div>
        </Aside>
      </div>
    </Page>
  );
}
