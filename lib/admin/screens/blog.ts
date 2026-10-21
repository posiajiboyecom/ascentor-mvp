// lib/admin/screens/blog.ts
// Spec copied from the admin prototype (Marketing · Blog). The loader below is a placeholder until it reads real data.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { shortDate, count } from '@/lib/admin/revenue-util';
import type { ScreenModule, ScreenSpec, ActionResult } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "blog",
  group: "Marketing",
  title: "Blog",
  sub: "Articles on joinascentor.com.",
  cols: [
    "Title",
    "Author",
    "Views",
    "Status",
    "Updated"
  ],
  statusCol: 3,
  actions: [
    {
      id: "publish",
      label: "Publish",
      col: 3,
      to: "Published",
      admin: true
    },
    {
      id: "unpublish",
      label: "Unpublish",
      col: 3,
      to: "Draft",
      admin: true
    }
  ],
  buttons: [
    {
      id: "new-post",
      href: "/admin/blog",
      label: "New post"
    }
  ]
};

const screen: ScreenModule = {
  spec,
  async load() {
    const { data, error } = await supabaseAdmin.from('blog_posts')
      .select('id, title, author_name, views, is_published, updated_at')
      .order('created_at', { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return {
      rows: (data ?? []).map((r: any) => ({
        id: String(r.id),
        cells: [r.title || '-', r.author_name || '-', r.views ? count(Number(r.views)) : '-', r.is_published ? 'Published' : 'Draft', shortDate(r.updated_at)],
      })),
      note: (data?.length ?? 0) >= 200 ? 'Showing the 200 newest posts.' : undefined,
    };
  },
  async act(_ctx, actionId, rowId): Promise<ActionResult> {
    if (actionId !== 'publish' && actionId !== 'unpublish') return { ok: false, error: 'Unknown action.' };
    const { data: row } = await supabaseAdmin.from('blog_posts').select('id, title, is_published').eq('id', rowId).maybeSingle();
    if (!row) return { ok: false, error: 'That post no longer exists.' };
    const publish = actionId === 'publish';
    if (!!row.is_published === publish) return { ok: false, error: publish ? 'This post is already published.' : 'This post is already a draft.' };
    // Same as the Blog editor's toggle: published_at is stamped on publish and cleared on unpublish.
    const { error } = await supabaseAdmin.from('blog_posts')
      .update({ is_published: publish, published_at: publish ? new Date().toISOString() : null }).eq('id', rowId);
    if (error) return { ok: false, error: 'We could not update this post.' };
    return { ok: true, message: publish ? `${row.title} is published.` : `${row.title} is back to draft.` };
  },
};

export default screen;
