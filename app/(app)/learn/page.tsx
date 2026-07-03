// app/(app)/learn/page.tsx
// Resources screen — server component. Fetches all published courses
// and merges the user's progress into each, then hands off to
// LearnClient.
//
// Schema notes — confirmed via information_schema, NOT database.ts's
// stale types:
//   courses: id, title, description, youtube_id, category, difficulty,
//     duration, sort_order, is_published, total_duration_seconds,
//     created_at, plan_tier. NO emoji column, NO confirmed
//     is_free_preview column — don't reference either.
//   user_progress: id, user_id, course_id, lesson_id (FK→lessons.id),
//     progress_percent, last_position, completed, updated_at.
//
// Route is /learn (rail labels it "Resources").

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { effectivePlan } from '@/lib/planTier';
import { LearnClient } from './LearnClient';

export const dynamic = 'force-dynamic';

export default async function LearnPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [coursesRes, progressRes, profileRes, lessonsCountRes] = await Promise.all([
    supabase
      .from('courses')
      .select('*')
      .eq('is_published', true)
      .order('sort_order', { ascending: true }),

    supabase
      .from('user_progress')
      .select('course_id, progress_percent, completed, updated_at')
      .eq('user_id', user.id),

    supabase
      .from('profiles')
      .select('subscription_plan, subscription_status, subscription_end')
      .eq('id', user.id)
      .single(),

    // lessons has no aggregate count on `courses` itself — pull
    // course_id for every lesson and tally client-side below.
    supabase.from('lessons').select('course_id'),
  ]);

  if (coursesRes.error) {
    console.error('[learn/page] courses query failed:', coursesRes.error.message);
  }

  // user_progress is per-LESSON, not per-course — a course can have
  // several rows (one per lesson watched). Aggregate to one summary per
  // course: highest progress_percent seen, and "completed" only if every
  // progress row for that course is marked completed. This is a
  // reasonable course-level rollup, not a verified stored procedure —
  // flag if your real progress logic differs.
  const progressByCourse = new Map<
    string,
    { progress: number; completed: boolean; updatedAt: string }
  >();

  for (const row of progressRes.data ?? []) {
    const existing = progressByCourse.get(row.course_id);
    const pct = row.progress_percent ?? 0;
    if (!existing) {
      progressByCourse.set(row.course_id, {
        progress: pct,
        completed: row.completed,
        updatedAt: row.updated_at,
      });
    } else {
      progressByCourse.set(row.course_id, {
        progress: Math.max(existing.progress, pct),
        completed: existing.completed && row.completed,
        updatedAt:
          new Date(row.updated_at) > new Date(existing.updatedAt)
            ? row.updated_at
            : existing.updatedAt,
      });
    }
  }

  const lessonCounts = new Map<string, number>();
  for (const row of lessonsCountRes.data ?? []) {
    lessonCounts.set(row.course_id, (lessonCounts.get(row.course_id) ?? 0) + 1);
  }

  const courses = (coursesRes.data ?? []).map((course) => {
    const progress = progressByCourse.get(course.id);
    return {
      ...course,
      progress: progress?.progress ?? 0,
      completed: progress?.completed ?? false,
      updatedAt: progress?.updatedAt ?? null,
      lessonCount: lessonCounts.get(course.id) ?? 0,
    };
  });

  return <LearnClient courses={courses} userPlan={effectivePlan(profileRes.data)} />;
}
