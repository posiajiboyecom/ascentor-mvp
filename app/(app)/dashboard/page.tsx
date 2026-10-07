// app/(app)/dashboard/page.tsx
// Today: this week's plan, today's check-in, and the few things that matter next (lesson, Circle, mentor).
// Server component: everything arrives in one parallel pass; the interactive cards are small client islands.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, Play } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getMe, getMyCircle } from '@/lib/rx/server';
import { getLessonProgress, getLessons, getTodayState, pickWeekLesson } from '@/lib/rx/practice';
import { getBannerAnnouncement } from '@/lib/rx/announcements';
import { CIRCLE_FOCUS, CIRCLE_MIN_TO_START } from '@/lib/rx/constants';
import { longDate, nextWeekdayAt, whenLabel } from '@/lib/rx/dates';
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

  const db = await createClient();
  const { data: match } = await db.from('mentor_matches').select('id').eq('member_id', me.userId).in('status', ['active', 'accepted']).limit(1).maybeSingle();
  let tasks: { done: boolean }[] = [];
  if (match) {
    const { data } = await db.from('mentor_tasks').select('done').eq('match_id', match.id);
    tasks = (data ?? []) as { done: boolean }[];
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
  const mentorRow: MoreRow = match
    ? { title: 'Mentor agreement', meta: `${tasks.filter((t) => t.done).length} of ${tasks.length} tasks done`, href: '/sessions' }
    : { title: 'Find a mentor', meta: 'One-to-one sessions', href: '/sessions' };

  const mobileRows = [circleRow, ...(lessonRow ? [lessonRow] : []), mentorRow];
  const kept = state.keptThisWeek;

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
