// app/(app)/learn/page.tsx
// Learn: this week's lesson, the 12-week pathway, and lessons to explore by dimension.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Check, Lock, Play } from 'lucide-react';
import '@/styles/rx-circle.css';
import { createClient } from '@/lib/supabase/server';
import { deriveBilling } from '@/lib/billing-state';
import { getBillingV2Input } from '@/lib/access';
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
  const db = await createClient();
  const { data: billProf } = await db.from('profiles').select('subscription_plan, subscription_status, subscription_end').eq('id', me.userId).maybeSingle();
  const bill = deriveBilling(billProf, me.tz, new Date(), '', await getBillingV2Input(me.userId));
  const pathDone = !!state && state.pathway.length >= 12 && state.pathway.every((d) => d.state === 'done');
  const behindCount = state?.pathway.filter((d) => d.state === 'behind').length ?? 0;
  const week = state?.week ?? 1;
  const lesson = pickWeekLesson(lessons, week, progress);
  const interests = new Set(me.profile?.interests ?? []);
  const dims = new Set((me.profile?.interests ?? []).map((i) => dimensionOf(i)).filter(Boolean) as string[]);

  const cards: LessonCard[] = lessons.map((l) => ({
    slug: l.slug, title: l.title, dimension: l.dimension, sub: l.sub, minutes: l.minutes, format: l.format,
    done: !!progress.get(l.id)?.practice_id,
    forYou: (!!l.sub && interests.has(l.sub)) || dims.has(l.dimension),
    thumbnailUrl: l.thumbnail_url ?? null,
  }));
  const lessonDone = !!(lesson && progress.get(lesson.id)?.practice_id);

  return (
    <Page>
      <Title>Learn</Title>
      <div className="rx-two">
        <div className="rx-stack-lg">
          {bill.state === 'lapsed' && (
            <div className="rx-card rx-stack-sm rx-rise">
              <div className="rx-row rx-nw" style={{ gap: 10 }}><Lock aria-hidden style={{ width: 20, height: 20, color: 'var(--rx-gold)' }} /><p className="rx-h3">Learn is paused on light access</p></div>
              <p className="rx-p">Your finished lessons, practices and notes are safe. New lessons open again when you reactivate.</p>
              <div><Link href="/settings/billing" className="rx-btn primary">Reactivate {bill.planName}</Link></div>
            </div>
          )}
          {pathDone && (
            <div className="rx-card rx-stack rx-rise">
              <div className="rx-row rx-nw" style={{ gap: 14 }}><span className="rx-okb"><Check aria-hidden /></span><div><p className="rx-label">Pathway complete · 12 of 12 weeks</p><p className="rx-h2">You finished your first pathway.</p></div></div>
              <p className="rx-p">Twelve lessons, each turned into a practice. That’s a habit now, not a phase.</p>
              <div className="rx-row"><Link href="/growth" className="rx-link">See how you’ve grown<ArrowRight aria-hidden /></Link></div>
            </div>
          )}
          {behindCount >= 2 ? (
            <div className="rx-soft rx-rise"><p className="rx-p rx-strong">{behindCount === 2 ? 'Two' : behindCount} lessons behind, and that’s fine.</p><p className="rx-sm">Pick the one that matters most this week.</p></div>
          ) : state?.missed ? (
            <div className="rx-soft rx-rise"><p className="rx-p rx-strong">A few days slipped by, and that’s fine.</p><p className="rx-sm">Pick the lesson that matters most this week.</p></div>
          ) : null}

          {lesson ? (
            <div className="rx-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="rx-thumb" style={{ borderRadius: 0, aspectRatio: '21/8', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                {lesson.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={lesson.thumbnail_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                <Play aria-hidden style={{ width: 44, height: 44, position: 'relative', ...(lesson.thumbnail_url ? { color: '#fff', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,.45))' } : {}) }} />
              </div>
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
