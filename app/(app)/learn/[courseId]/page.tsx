// app/(app)/learn/[courseId]/page.tsx
// Server Component — fetches one course, its lessons, and the user's
// per-lesson progress, then passes everything to CourseDetailClient.
//
// Schema notes — confirmed via information_schema:
//   lessons: id, course_id, title, description, video_url,
//     duration_seconds, order_index, key_takeaways (text[]),
//     quiz (jsonb), created_at. No is_published column on lessons —
//     gating happens only at the course level via courses.plan_tier.
//   user_progress: id, user_id, course_id, lesson_id (FK→lessons.id),
//     progress_percent, last_position, completed, updated_at.
//
// Deliberately does NOT reference courses.is_free_preview — that
// column was never confirmed to exist in the real schema. Referencing
// it wouldn't throw (JS reads undefined silently), but would make
// free-preview courses incorrectly stay locked — a real, documented
// bug from an earlier pass. Tier gating here uses only plan_tier.

import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { effectivePlan, canAccess, type PlanTier } from '@/lib/planTier';
import { CourseDetailClient } from './CourseDetailClient';

export const dynamic = 'force-dynamic';

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [courseRes, lessonsRes, profileRes] = await Promise.all([
    supabase.from('courses').select('*').eq('id', courseId).single(),

    supabase
      .from('lessons')
      .select('*')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true }),

    supabase
      .from('profiles')
      .select('subscription_plan, subscription_status, subscription_end')
      .eq('id', user.id)
      .single(),
  ]);

  if (courseRes.error) {
    console.error('[learn/[courseId]/page] courses query failed:', courseRes.error.message);
  }
  if (!courseRes.data) notFound();

  const userPlan: PlanTier = effectivePlan(profileRes.data);
  const requiredTier = (courseRes.data.plan_tier || 'free') as PlanTier;

  // Gate at the route level — locked courses redirect back to the grid,
  // where the existing tier-upgrade modal flow handles the upsell.
  if (!canAccess(userPlan, requiredTier)) redirect('/learn');

  const lessonRows = lessonsRes.data ?? [];
  const lessonIds = lessonRows.map((l) => l.id);

  const { data: progressRows } =
    lessonIds.length > 0
      ? await supabase
          .from('user_progress')
          .select('lesson_id, progress_percent, last_position, completed')
          .eq('user_id', user.id)
          .in('lesson_id', lessonIds)
      : { data: [] };

  const progressByLesson = new Map(
    (progressRows ?? []).map((p) => [p.lesson_id, p])
  );

  const lessons = lessonRows.map((lesson) => {
    const progress = progressByLesson.get(lesson.id);
    return {
      ...lesson,
      progress_percent: progress?.progress_percent ?? 0,
      last_position: progress?.last_position ?? 0,
      completed: progress?.completed ?? false,
    };
  });

  // Pick a sensible course-level "next category" lesson for the "Up next"
  // banner: the next published course in the same category, by sort_order.
  const { data: nextCourseRows } = await supabase
    .from('courses')
    .select('id, title, category, sort_order')
    .eq('is_published', true)
    .eq('category', courseRes.data.category)
    .gt('sort_order', courseRes.data.sort_order)
    .order('sort_order', { ascending: true })
    .limit(1);

  return (
    <CourseDetailClient
      course={courseRes.data}
      lessons={lessons}
      userId={user.id}
      nextCourse={nextCourseRows?.[0] ?? null}
    />
  );
}
