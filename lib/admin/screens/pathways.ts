// lib/admin/screens/pathways.ts
// Spec copied from the admin prototype (Learn · Pathways and lessons). Pathways are rows of `courses`; standalone lessons are `rx_lessons`.
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ScreenModule, ScreenSpec, RowData } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "pathways",
  group: "Learn",
  title: "Pathways and lessons",
  sub: "12-week pathways. Each lesson ends in a practice members set on Today.",
  cols: [
    "Pathway or lesson",
    "Dimension",
    "Lessons",
    "Enrolled",
    "Completion",
    "Status"
  ],
  statusCol: 5,
  actions: [
    { id: "publish", label: "Publish", col: 5, to: "Published", admin: true },
    { id: "unpublish", label: "Unpublish", col: 5, to: "Draft", admin: true }
  ],
  buttons: [
    { id: "new-lesson", label: "New lesson", href: "/admin/courses" },
    { id: "new-pathway", label: "New pathway", href: "/admin/courses" }
  ]
};

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '-');
const num = (n: number) => n.toLocaleString('en-GB');

async function load() {
  const db = supabaseAdmin;
  const [courses, lessons, courseLessons, prog, rxProg] = await Promise.all([
    db.from('courses').select('id, title, lessons_count, is_published, sort_order').order('sort_order').limit(200),
    db.from('rx_lessons').select('id, title, dimension, published, sort, thumbnail_url, video_url').order('sort').limit(200),
    db.from('lessons').select('id, course_id').limit(5000),
    db.from('user_progress').select('user_id, course_id, completed').limit(20000),
    db.from('rx_lesson_progress').select('user_id, lesson_id, completed_at').limit(20000),
  ]);
  const perCourse = new Map<string, number>();
  for (const l of courseLessons.data ?? []) perCourse.set(l.course_id, (perCourse.get(l.course_id) ?? 0) + 1);
  const enrolled = new Map<string, Set<string>>();
  const done = new Map<string, Map<string, number>>();
  for (const p of prog.data ?? []) {
    if (!p.course_id) continue;
    if (!enrolled.has(p.course_id)) enrolled.set(p.course_id, new Set());
    enrolled.get(p.course_id)!.add(p.user_id);
    if (p.completed) {
      const m = done.get(p.course_id) ?? new Map<string, number>();
      m.set(p.user_id, (m.get(p.user_id) ?? 0) + 1);
      done.set(p.course_id, m);
    }
  }
  const rows: RowData[] = [];
  for (const c of courses.data ?? []) {
    const n = Math.max(perCourse.get(c.id) ?? 0, c.lessons_count ?? 0);
    const enr = enrolled.get(c.id)?.size ?? 0;
    let finished = 0;
    if (n > 0) for (const v of done.get(c.id)?.values() ?? []) if (v >= n) finished++;
    rows.push({ id: `c:${c.id}`, cells: [c.title ?? '-', '-', num(n), num(enr), n > 0 && enr > 0 ? pct(finished, enr) : '-', c.is_published ? 'Published' : 'Draft'] });
  }
  const rxEnr = new Map<string, number>();
  const rxDone = new Map<string, number>();
  for (const p of rxProg.data ?? []) {
    rxEnr.set(p.lesson_id, (rxEnr.get(p.lesson_id) ?? 0) + 1);
    if (p.completed_at) rxDone.set(p.lesson_id, (rxDone.get(p.lesson_id) ?? 0) + 1);
  }
  for (const l of lessons.data ?? []) {
    const enr = rxEnr.get(l.id) ?? 0;
    rows.push({
      id: `l:${l.id}`,
      cells: [l.title ?? '-', l.dimension ?? '-', '1', num(enr), enr > 0 ? pct(rxDone.get(l.id) ?? 0, enr) : '-', l.published ? 'Published' : 'Draft'],
      details: [
        { heading: 'Lesson', items: [['Title', l.title ?? '-'], ['Dimension', l.dimension ?? '-'], ['Video URL', l.video_url ?? 'None']] as [string, string][] },
      ],
      upload: {
        label: 'Thumbnail',
        endpoint: '/api/admin/lesson-thumbnail',
        accept: 'image/png,image/jpeg,image/webp',
        hint: '1280 × 720 px (16:9) · PNG preferred · max 2 MB. Shows on the lesson card and before the video plays.',
        current: l.thumbnail_url ?? null,
      },
    });
  }
  return { rows, note: 'Pathways first, then standalone lessons. Open a lesson to upload its thumbnail.' };
}

const screen: ScreenModule = {
  spec,
  load,
  async act(_ctx, actionId, rowId) {
    if (actionId !== 'publish' && actionId !== 'unpublish') return { ok: false, error: 'That action is not available here.' };
    const publish = actionId === 'publish';
    const kind = rowId.slice(0, 1);
    const id = rowId.slice(2);
    if (!id || (kind !== 'c' && kind !== 'l')) return { ok: false, error: 'We could not find that row.' };
    const table = kind === 'c' ? 'courses' : 'rx_lessons';
    const col = kind === 'c' ? 'is_published' : 'published';
    const db = supabaseAdmin;
    const { data: cur } = await db.from(table).select(col).eq('id', id).maybeSingle();
    if (!cur) return { ok: false, error: 'That item no longer exists.' };
    if (Boolean((cur as unknown as Record<string, unknown>)[col]) === publish) return { ok: false, error: publish ? 'Already published.' : 'Already a draft.' };
    const { error } = await db.from(table).update({ [col]: publish }).eq('id', id);
    if (error) return { ok: false, error: 'Could not save that change. Try again.' };
    return { ok: true, message: publish ? 'Published. Members can see it now.' : 'Unpublished. Members no longer see it.' };
  },
};

export default screen;
