import { notFound, redirect } from 'next/navigation';
import { getMe } from '@/lib/rx/server';
import { getLessonProgress, getLessons, getTodayState } from '@/lib/rx/practice';
import { BackLink, Page } from '@/components/rx/ui';
import LessonView from '@/components/rx/learn/LessonView';

export const dynamic = 'force-dynamic';

export default async function LessonPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ mode?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const me = await getMe();
  if (!me) redirect('/login');
  const lessons = await getLessons();
  const lesson = lessons.find((l) => l.slug === slug);
  if (!lesson) notFound();

  const [progress, state] = await Promise.all([getLessonProgress(), getTodayState()]);
  const pr = progress.get(lesson.id);
  // Start from the practice already set this week, so the lesson edits it instead of starting blank.
  let draft = null;
  if (state?.practice) {
    const p = state.practice;
    draft = { cue: p.cue, action: p.action, trigger: p.trigger ?? '', fallback: p.fallback ?? '', obstacle: p.obstacle ?? '', source: p.source ?? '' };
  }

  return (
    <Page>
      <BackLink href="/learn">Learn</BackLink>
      <div className="rx-row" style={{ gap: 8, marginTop: 8 }}><span className="rx-tag gold">{lesson.dimension}</span><span className="rx-sm">{lesson.minutes} min</span></div>
      <h1 className="rx-title" style={{ marginTop: 10 }}>{lesson.title}</h1>
      <span className="rx-rule" />
      <LessonView
        id={lesson.id}
        title={lesson.title}
        format={lesson.format}
        videoUrl={lesson.video_url}
        body={lesson.body ?? ''}
        minutes={lesson.minutes}
        reflection={pr?.reflection ?? ''}
        watchPercent={pr?.watch_percent ?? 0}
        watchPosition={pr?.last_position_sec ?? 0}
        practiceSet={!!pr?.practice_id}
        startRead={sp.mode === 'read'}
        draft={draft}
        thumbnailUrl={lesson.thumbnail_url ?? lesson.video?.thumbnail_url ?? null}
        hostedVideoUrl={lesson.video?.hls_url ?? null}
      />
    </Page>
  );
}
