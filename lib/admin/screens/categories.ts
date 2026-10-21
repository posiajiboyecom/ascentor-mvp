// lib/admin/screens/categories.ts
// Spec copied from the admin prototype (Community · Post categories). Reads feed_categories, as app/admin/categories does.
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "categories",
  group: "Community",
  title: "Post categories",
  sub: "Categories members tag posts with. Matches app/admin/categories.",
  cols: ["Category", "Dimension", "Posts", "Status"],
  statusCol: 3,
  actions: [
    { id: "hide", label: "Hide", col: 3, to: "Hidden" },
    { id: "show", label: "Show", col: 3, to: "Active" }
  ],
  buttons: [{ id: "add-category", label: "Add category", href: "/admin/categories" }]
};

const screen: ScreenModule = {
  spec,
  async load() {
    const [{ data: cats }, { data: posts }] = await Promise.all([
      supabaseAdmin.from('feed_categories').select('slug, name, active, position').order('position'),
      supabaseAdmin.from('feed_posts').select('category').eq('deleted', false).limit(50000),
    ]);
    const count = new Map<string, number>();
    for (const p of (posts ?? []) as { category: string | null }[]) if (p.category) count.set(p.category, (count.get(p.category) ?? 0) + 1);
    const rows = ((cats ?? []) as { slug: string; name: string; active: boolean }[]).map((c) => ({
      id: c.slug,
      cells: [c.name, 'All', (count.get(c.name) ?? 0).toLocaleString('en-GB'), c.active ? 'Active' : 'Hidden'],
    }));
    return { rows, note: 'Categories apply to every dimension. Use Add category to create or rename one.' };
  },
  async act(_ctx, actionId, rowId) {
    if (actionId !== 'hide' && actionId !== 'show') return { ok: false, error: 'Unknown action.' };
    const { data: c } = await supabaseAdmin.from('feed_categories').select('slug, name, active').eq('slug', rowId).maybeSingle();
    if (!c) return { ok: false, error: 'That category no longer exists.' };
    const active = actionId === 'show';
    if (c.active === active) return { ok: false, error: active ? 'It is already shown.' : 'It is already hidden.' };
    const { error } = await supabaseAdmin.from('feed_categories').update({ active }).eq('slug', rowId);
    if (error) return { ok: false, error: 'We could not update that category.' };
    return { ok: true, message: active ? `${c.name} is shown again.` : `${c.name} is hidden from the post form.` };
  },
};

export default screen;
