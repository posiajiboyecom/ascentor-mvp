import 'server-only';
// lib/rx/feed.ts
// Reads for the Community feed: categories, rich-text posts, media, reactions, threaded comments and shares.

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getMe, namesFor, type Db } from './server';
import { relTime } from './dates';
import type { CategoryView, CommentView, MediaItem, PostView, ReactionKind } from './feed-types';
import { FALLBACK_CATEGORIES, FEED_PAGE, nestComments } from './feed-types';

interface PostRow { id: string; user_id: string | null; type: string; category: string | null; body: string; body_html: string | null; media: unknown; pinned: boolean; created_at: string }
const POST_COLS = 'id, user_id, type, category, body, body_html, media, pinned, created_at';

export async function getCategories(): Promise<CategoryView[]> {
  const db = await createClient();
  const { data, error } = await db.from('feed_categories').select('slug, name').eq('active', true).order('position');
  if (error || !data?.length) return FALLBACK_CATEGORIES;
  return data as CategoryView[];
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

function toMedia(raw: unknown): MediaItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is MediaItem => !!m && typeof m === 'object' && typeof (m as MediaItem).url === 'string' && ((m as MediaItem).kind === 'image' || (m as MediaItem).kind === 'video'))
    .slice(0, 4);
}

async function enrich(db: Db, rows: PostRow[], meId: string): Promise<PostView[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [{ data: reacts }, { data: reps }, { data: shares }] = await Promise.all([
    db.from('feed_reactions').select('post_id, user_id, kind').in('post_id', ids),
    db.from('feed_replies').select('id, post_id, user_id, body, parent_id, created_at').in('post_id', ids).order('created_at').limit(1000),
    supabaseAdmin.from('feed_shares').select('post_id').in('post_id', ids),
  ]);
  const replies = (reps ?? []) as { id: string; post_id: string; user_id: string | null; body: string; parent_id: string | null; created_at: string }[];
  const names = await namesFor(db, [...rows.map((r) => r.user_id), ...replies.map((r) => r.user_id)]);
  const nm = (id: string | null) => (id ? names.get(id)?.name ?? 'Member' : 'Ascentor team');

  return rows.map((r) => {
    const tally: Record<ReactionKind, number> = { like: 0, support: 0, insight: 0 };
    let myKind: ReactionKind | null = null;
    for (const x of ((reacts ?? []) as { post_id: string; user_id: string; kind: ReactionKind }[]).filter((y) => y.post_id === r.id)) {
      if (x.kind in tally) tally[x.kind]++;
      if (x.user_id === meId) myKind = x.kind;
    }
    const flat: CommentView[] = replies.filter((x) => x.post_id === r.id).map((x) => ({
      id: x.id, userId: x.user_id, name: x.user_id === meId ? 'You' : nm(x.user_id), avatarUrl: x.user_id ? names.get(x.user_id)?.avatarUrl ?? null : null,
      body: x.body, time: relTime(x.created_at), mine: x.user_id === meId, parentId: x.parent_id, replies: [],
    }));
    return {
      id: r.id, userId: r.user_id, name: nm(r.user_id), avatarUrl: r.user_id ? names.get(r.user_id)?.avatarUrl ?? null : null, isTeam: !r.user_id,
      category: r.category, html: r.body_html || `<p>${esc(r.body)}</p>`, text: r.body, media: toMedia(r.media), time: relTime(r.created_at), createdAt: r.created_at,
      mine: r.user_id === meId, pinned: r.pinned,
      reactions: { ...tally, mine: myKind }, comments: nestComments(flat), commentCount: flat.length,
      shares: ((shares ?? []) as { post_id: string }[]).filter((s) => s.post_id === r.id).length,
    };
  });
}

/** The feed, newest first. The first page also carries pinned posts. `before` is the createdAt of the last post already shown. */
export async function getFeed(opts: { category?: string | null; before?: string | null }): Promise<{ posts: PostView[]; next: string | null }> {
  const me = await getMe();
  if (!me) return { posts: [], next: null };
  const db = await createClient();
  const cat = opts.category && opts.category !== 'All' ? opts.category : null;

  let q = db.from('feed_posts').select(POST_COLS).eq('deleted', false).eq('pinned', false).neq('type', 'Prompt').order('created_at', { ascending: false }).limit(FEED_PAGE + 1);
  if (cat) q = q.eq('category', cat);
  if (opts.before) q = q.lt('created_at', opts.before);
  const { data } = await q;
  const rows = (data ?? []) as PostRow[];
  const more = rows.length > FEED_PAGE;
  const page = more ? rows.slice(0, FEED_PAGE) : rows;

  let pinned: PostRow[] = [];
  if (!opts.before && !cat) {
    const { data: pins } = await db.from('feed_posts').select(POST_COLS).eq('deleted', false).eq('pinned', true).order('created_at', { ascending: false }).limit(3);
    pinned = (pins ?? []) as PostRow[];
  }
  const posts = await enrich(db, [...pinned, ...page], me.userId);
  return { posts, next: more ? page[page.length - 1].created_at : null };
}

export async function getPost(id: string): Promise<PostView | null> {
  const me = await getMe();
  if (!me || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await createClient();
  const { data } = await db.from('feed_posts').select(POST_COLS).eq('id', id).eq('deleted', false).maybeSingle();
  if (!data) return null;
  return (await enrich(db, [data as PostRow], me.userId))[0] ?? null;
}
