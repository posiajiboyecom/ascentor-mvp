// app/(app)/learn/page.tsx
// Learn: this week's lesson, the 12-week pathway, and lessons to explore by dimension.
// The earlier course catalogue still lives at /learn/courses.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Check, Play } from 'lucide-react';
import { getMe, getMyCircle } from '@/lib/rx/server';
import { getLessonProgress, getLessons, getTodayState, pickWeekLesson } from '@/lib/rx/practice';
import { CIRCLE_FOCUS, dimensionOf } from '@/lib/rx/constants';
import { Aside, Page, Title } from '@/components/rx/ui';
import LessonBrowser, { type LessonCard } from '@/components/rx/learn/LessonBrowser';

export const dynamic = 'force-dynamic';

export default async function LearnPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const [lessons, progress, state, circle] = await Promise.all([getLessons(), getLessonProgress(), getTodayState(), getMyCircle()]);
  const week = state?.week ?? 1;
  const lesson = pickWeekLesson(lessons, week, progress);
  const interests = new Set(me.profile?.interests ?? []);
  const dims = new Set((me.profile?.interests ?? []).map((i) => dimensionOf(i)).filter(Boolean) as string[]);

  const cards: LessonCard[] = lessons.map((l) => ({
    slug: l.slug, title: l.title, dimension: l.dimension, sub: l.sub, minutes: l.minutes, format: l.format,
    done: !!progress.get(l.id)?.practice_id,
    forYou: (!!l.sub && interests.has(l.sub)) || dims.has(l.dimension),
  }));
  const lessonDone = !!(lesson && progress.get(lesson.id)?.practice_id);

  return (
    <Page>
      <Title>Learn</Title>
      <div className="rx-two">
        <div className="rx-stack-lg">
          {state?.missed && (
            <div className="rx-soft rx-rise"><p className="rx-p rx-strong">A few days slipped by, and that’s fine.</p><p className="rx-sm">Pick the lesson that matters most this week.</p></div>
          )}

          {lesson ? (
            <div className="rx-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="rx-thumb" style={{ borderRadius: 0, aspectRatio: '21/8', alignItems: 'center', justifyContent: 'center' }}><Play aria-hidden style={{ width: 44, height: 44 }} /></div>
              <div className="rx-stack-sm" style={{ padding: '18px 20px 20px' }}>
                <div className="rx-row" style={{ gap: 8 }}><span className="rx-tag gold">{lesson.dimension}</span><span className="rx-sm">{lesson.minutes} min</span></div>
                <p className="rx-h2">{lesson.title}</p>
                <p className="rx-sm">This week’s lesson · {lessonDone ? 'Practice set' : 'Practice not set yet'}</p>
                <div className="rx-row" style={{ marginTop: 4 }}>
                  <Link href={`/learn/lesson/${lesson.slug}`} className="rx-btn primary">{lesson.format === 'Video' ? 'Watch' : 'Read'}</Link>
                  {lesson.format === 'Video' && <Link href={`/learn/lesson/${lesson.slug}?mode=read`} className="rx-link">Read instead</Link>}
                </div>
              </div>
            </div>
          ) : (
            <div className="rx-card rx-empty"><p className="rx-p">Lessons are on their way.</p></div>
          )}

          <LessonBrowser lessons={cards} />
          <p className="rx-sm"><Link href="/learn/courses" className="rx-link">Browse the full course catalogue</Link></p>
        </div>

        <Aside>
          <div className="rx-stack-sm">
            <p className="rx-label">My pathway</p>
            <ol className="rx-dots" aria-label={`My pathway, week ${week} of 12`}>
              {(state?.pathway ?? Array.from({ length: 12 }, (_, i) => ({ week: i + 1, state: i === 0 ? 'current' : 'upcoming' as const }))).map((d) => (
                <li key={d.week} className={`rx-pd${d.state === 'done' ? ' done' : d.state === 'current' ? ' cur' : d.state === 'behind' ? ' behind' : ''}`}
                  aria-label={`Week ${d.week}, ${d.state === 'behind' ? 'not practised yet' : d.state}`}>
                  {d.state === 'done' && <Check aria-hidden />}
                </li>
              ))}
            </ol>
            <p className="rx-sm">Week {week} of 12 · next unlocks {state?.nextUnlock ?? ''}</p>
          </div>
          {circle?.week ? (
            <div className="rx-stack-sm"><p className="rx-label">Circle topic</p><p className="rx-p">{CIRCLE_FOCUS[circle.week - 1]}</p><p className="rx-sm">Discussed on Thursday.</p></div>
          ) : null}
        </Aside>
      </div>
    </Page>
  );
}
