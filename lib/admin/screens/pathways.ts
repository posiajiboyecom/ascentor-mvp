// lib/admin/screens/pathways.ts
// Learn · Pathways and lessons. Lists the pathway lessons (rx_lessons), the only lessons members see on Learn.
// Creating and editing a lesson opens the lesson editor (/admin/lessons?action=create | ?edit=<id>); the drawer here
// also uploads the lesson's video and thumbnail directly. The old course catalogue (`courses`) has been retired.
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ScreenModule, ScreenSpec, RowData } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "pathways",
  group: "Learn",
  title: "Pathways and lessons",
  sub: "12-week pathways. Each lesson ends in a practice members set on Today.",
  cols: [
    "Lesson",
    "Dimension",
    "Week",
    "Started",
    "Completion",
    "Status"
  ],
  statusCol: 5,
  actions: [
    { id: "publish", label: "Publish", col: 5, to: "Published", admin: true },
    { id: "unpublish", label: "Unpublish", col: 5, to: "Draft", admin: true }
  ],
  buttons: [
    { id: "new-lesson", label: "New lesson", href: "/admin/lessons?action=create" }
  ]
};

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '-');
const num = (n: number) => n.toLocaleString('en-GB');

async function load() {
  const db = supabaseAdmin;
  const [lessons, rxProg] = await Promise.all([
    db.from('rx_lessons').select('id, title, dimension, week_no, published, sort, thumbnail_url, video_url, video_id').order('sort').limit(200),
    db.from('rx_lesson_progress').select('user_id, lesson_id, completed_at').limit(20000),
  ]);
  const rxEnr = new Map<string, number>();
  const rxDone = new Map<string, number>();
  for (const p of rxProg.data ?? []) {
    rxEnr.set(p.lesson_id, (rxEnr.get(p.lesson_id) ?? 0) + 1);
    if (p.completed_at) rxDone.set(p.lesson_id, (rxDone.get(p.lesson_id) ?? 0) + 1);
  }
  const rows: RowData[] = [];
  for (const l of lessons.data ?? []) {
    const enr = rxEnr.get(l.id) ?? 0;
    rows.push({
      id: `l:${l.id}`,
      cells: [l.title ?? '-', l.dimension ?? '-', l.week_no ? `Week ${l.week_no}` : '-', num(enr), enr > 0 ? pct(rxDone.get(l.id) ?? 0, enr) : '-', l.published ? 'Published' : 'Draft'],
      details: [
        { heading: 'Lesson', items: [['Title', l.title ?? '-'], ['Dimension', l.dimension ?? '-'], ['Video', l.video_id ? 'Uploaded to Ascentor (plays in our own player)' : (l.video_url ? `Link: ${l.video_url}` : 'None')]] as [string, string][] },
      ],
      editHref: `/admin/lessons?edit=${l.id}`,
      video: { kind: 'rx_lesson', targetId: l.id, current: l.video_id ?? null },
      upload: {
        label: 'Thumbnail',
        endpoint: '/api/admin/lesson-thumbnail',
        accept: 'image/png,image/jpeg,image/webp',
        hint: '1280 × 720 px (16:9) · PNG preferred · max 2 MB. Shows on the lesson card and before the video plays.',
        current: l.thumbnail_url ?? null,
      },
    });
  }
  return { rows, note: 'Open a lesson to upload its video and thumbnail, or edit its text.' };
}

const screen: ScreenModule = {
  spec,
  load,
  async act(_ctx, actionId, rowId) {
    if (actionId !== 'publish' && actionId !== 'unpublish') return { ok: false, error: 'That action is not available here.' };
    const publish = actionId === 'publish';
    const id = rowId.startsWith('l:') ? rowId.slice(2) : '';
    if (!id) return { ok: false, error: 'We could not find that row.' };
    const db = supabaseAdmin;
    const { data: cur } = await db.from('rx_lessons').select('published').eq('id', id).maybeSingle();
    if (!cur) return { ok: false, error: 'That item no longer exists.' };
    if (Boolean(cur.published) === publish) return { ok: false, error: publish ? 'Already published.' : 'Already a draft.' };
    const { error } = await db.from('rx_lessons').update({ published: publish }).eq('id', id);
    if (error) return { ok: false, error: 'Could not save that change. Try again.' };
    return { ok: true, message: publish ? 'Published. Members can see it now.' : 'Unpublished. Members no longer see it.' };
  },
};

export default screen;
