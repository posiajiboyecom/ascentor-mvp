// lib/admin/screens/pages.ts
// Spec copied from the admin prototype (Marketing · Landing pages). The loader below is a placeholder until it reads real data.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { shortDate, count } from '@/lib/admin/revenue-util';
import type { ScreenModule, ScreenSpec, ActionResult } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "pages",
  group: "Marketing",
  title: "Landing pages",
  sub: "Pages on the public website.",
  cols: [
    "Page",
    "Path",
    "Owner",
    "Status",
    "Updated"
  ],
  statusCol: 3,
  actions: [
    {
      id: "publish",
      label: "Publish",
      col: 3,
      to: "Published"
    },
    {
      id: "unpublish",
      label: "Unpublish",
      col: 3,
      to: "Draft"
    }
  ],
  buttons: [
    {
      id: "new-page",
      label: "New page"
    }
  ]
};

// marketing_pages.status is never maintained by the editor; what goes live is each section's own status. A page reads Published
// when it has sections and all of them are published. Publish and Unpublish do to every section what the page editor does to one.
const screen: ScreenModule = {
  spec,
  async load() {
    const { data, error } = await supabaseAdmin.from('marketing_pages')
      .select('id, title, route, updated_at').order('title');
    if (error) throw new Error(error.message);
    const { data: secs } = await supabaseAdmin.from('marketing_sections').select('page_id, status, updated_at');
    const by: Record<string, { total: number; pub: number; last: string | null }> = {};
    (secs ?? []).forEach((s: any) => {
      const b = (by[s.page_id] ||= { total: 0, pub: 0, last: null });
      b.total++;
      if (s.status === 'published') b.pub++;
      if (s.updated_at && (!b.last || s.updated_at > b.last)) b.last = s.updated_at;
    });
    return {
      rows: (data ?? []).map((r: any) => {
        const b = by[r.id];
        const last = [r.updated_at, b?.last].filter(Boolean).sort().pop() as string | undefined;
        return { id: String(r.id), cells: [r.title || '-', r.route || '-', '-', b && b.total > 0 && b.pub === b.total ? 'Published' : 'Draft', shortDate(last)] };
      }),
      note: 'Pages are edited section by section in the page editor. Publish and Unpublish here apply to every section of the page.',
    };
  },
  async act(_ctx, actionId, rowId): Promise<ActionResult> {
    if (actionId !== 'publish' && actionId !== 'unpublish') return { ok: false, error: 'Unknown action.' };
    const { data: page } = await supabaseAdmin.from('marketing_pages').select('id, title').eq('id', rowId).maybeSingle();
    if (!page) return { ok: false, error: 'That page no longer exists.' };
    const { data: sections } = await supabaseAdmin.from('marketing_sections').select('id, status, draft_data').eq('page_id', rowId);
    if (!sections?.length) return { ok: false, error: 'This page has no sections yet.' };
    const now = new Date().toISOString();

    if (actionId === 'unpublish') {
      if (sections.every((s: any) => s.status !== 'published')) return { ok: false, error: 'This page is already a draft.' };
      // published_data is kept, as in the editor.
      const { error } = await supabaseAdmin.from('marketing_sections').update({ status: 'draft' }).eq('page_id', rowId);
      if (error) return { ok: false, error: 'We could not update this page.' };
      return { ok: true, message: `${page.title} is back to draft.` };
    }

    if (sections.every((s: any) => s.status === 'published')) return { ok: false, error: 'This page is already published.' };
    for (const s of sections as any[]) {
      const { error } = await supabaseAdmin.from('marketing_sections')
        .update({ published_data: s.draft_data, status: 'published', published_at: now }).eq('id', s.id);
      if (error) return { ok: false, error: 'We could not publish every section. Please check the page editor.' };
      const { data: items } = await supabaseAdmin.from('marketing_repeating_items').select('id, draft_data').eq('section_id', s.id);
      for (const it of (items ?? []) as any[]) {
        await supabaseAdmin.from('marketing_repeating_items').update({ published_data: it.draft_data, status: 'published', published_at: now }).eq('id', it.id);
      }
    }
    return { ok: true, message: `${page.title} is published.` };
  },
};

export default screen;
