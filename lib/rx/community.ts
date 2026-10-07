import 'server-only';
// lib/rx/community.ts
// Reads for Community: the feed and Wins board, the weekly prompt, the Groups directory and group rooms.

import { createClient } from '@/lib/supabase/server';
import { getMe, namesFor, type Db } from './server';
import { relTime } from './dates';
import type { ChatMsg } from './chat-types';

export interface ReplyView { id: string; userId: string | null; name: string; body: string; at: string }
export interface PostView {
  id: string; userId: string | null; name: string; avatarUrl: string | null; type: string; dimension: string | null; sub: string | null;
  body: string; time: string; replies: ReplyView[]; mine: boolean;
}

async function withReplies(db: Db, rows: { id: string; user_id: string | null; type: string; dimension: string | null; sub: string | null; body: string; created_at: string }[], meId: string): Promise<PostView[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const { data: reps } = await db.from('feed_replies').select('id, post_id, user_id, body, created_at').in('post_id', ids).order('created_at');
  const replies = (reps ?? []) as { id: string; post_id: string; user_id: string | null; body: string; created_at: string }[];
  const names = await namesFor(db, [...rows.map((r) => r.user_id), ...replies.map((r) => r.user_id)]);
  const nm = (id: string | null) => (id ? names.get(id)?.name ?? 'Member' : 'Ascentor team');
  return rows.map((r) => ({
    id: r.id, userId: r.user_id, name: nm(r.user_id), avatarUrl: r.user_id ? names.get(r.user_id)?.avatarUrl ?? null : null,
    type: r.type, dimension: r.dimension, sub: r.sub, body: r.body, time: relTime(r.created_at), mine: r.user_id === meId,
    replies: replies.filter((x) => x.post_id === r.id).map((x) => ({ id: x.id, userId: x.user_id, name: x.user_id === meId ? 'You' : nm(x.user_id), body: x.body, at: x.created_at })),
  }));
}

export async function getFeed(opts: { dimension?: string; winsOnly?: boolean }): Promise<PostView[]> {
  const me = await getMe();
  if (!me) return [];
  const db = await createClient();
  let q = db.from('feed_posts').select('id, user_id, type, dimension, sub, body, created_at').eq('deleted', false).neq('type', 'Prompt').order('created_at', { ascending: false }).limit(60);
  if (opts.winsOnly) q = q.eq('type', 'Win');
  if (opts.dimension && opts.dimension !== 'All') q = q.eq('dimension', opts.dimension);
  const { data } = await q;
  return withReplies(db, (data ?? []) as never, me.userId);
}

export async function getPrompt(): Promise<{ id: string; body: string; replies: ReplyView[]; count: number } | null> {
  const me = await getMe();
  if (!me) return null;
  const db = await createClient();
  const { data } = await db.from('feed_posts').select('id, user_id, type, dimension, sub, body, created_at').eq('type', 'Prompt').eq('pinned', true).eq('deleted', false).order('created_at', { ascending: false }).limit(1);
  const row = (data ?? [])[0];
  if (!row) return null;
  const [post] = await withReplies(db, [row as never], me.userId);
  return { id: post.id, body: post.body, replies: post.replies, count: post.replies.length };
}

// ── groups ──────────────────────────────────────────────────────────────────

export interface GroupView {
  id: string; slug: string; name: string; description: string; dimension: string | null; count: number; isNew: boolean;
  joined: boolean; reason: string; score: number; isGeneral: boolean; isCity: boolean; isFacilitators: boolean; prompt: string | null;
}

const lowerFirst = (x: string) => (x === 'AI engineering' ? x : x.charAt(0).toLowerCase() + x.slice(1));

export async function getGroups(): Promise<GroupView[]> {
  const me = await getMe();
  if (!me) return [];
  const db = await createClient();
  const [{ data: groups }, { data: stats }, { data: mine }] = await Promise.all([
    db.from('rx_groups').select('id, slug, name, description, dimension, fit, is_new, is_general, is_city, is_facilitators, prompt').eq('status', 'active').order('created_at'),
    db.from('rx_group_stats').select('group_id, member_count'),
    db.from('rx_group_members').select('group_id').eq('user_id', me.userId),
  ]);
  const count = new Map(((stats ?? []) as { group_id: string; member_count: number }[]).map((s) => [s.group_id, s.member_count]));
  const joined = new Set(((mine ?? []) as { group_id: string }[]).map((m) => m.group_id));
  const interests = new Set(me.profile?.interests ?? []);

  return ((groups ?? []) as { id: string; slug: string; name: string; description: string | null; dimension: string | null; fit: string[]; is_new: boolean; is_general: boolean; is_city: boolean; is_facilitators: boolean; prompt: string | null }[]).map((g) => {
    const matched = (g.fit ?? []).filter((x) => interests.has(x));
    return {
      id: g.id, slug: g.slug, name: g.name, description: g.description ?? '', dimension: g.dimension, count: count.get(g.id) ?? 0, isNew: g.is_new,
      joined: joined.has(g.id), score: matched.length + (g.is_new && matched.length ? 0.5 : 0),
      reason: matched.length ? `Because you chose ${matched.slice(0, 2).map(lowerFirst).join(' and ')}.` : '',
      isGeneral: g.is_general, isCity: g.is_city, isFacilitators: g.is_facilitators, prompt: g.prompt,
    };
  });
}

export async function groupMessages(db: Db, groupId: string, afterISO?: string | null, limit = 200): Promise<ChatMsg[]> {
  let q = db.from('rx_group_messages').select('id, user_id, body, created_at').eq('group_id', groupId);
  q = afterISO ? q.gt('created_at', afterISO).order('created_at') : q.order('created_at', { ascending: false }).limit(limit);
  const { data } = await q;
  const rows = (data ?? []) as { id: string; user_id: string | null; body: string; created_at: string }[];
  if (!afterISO) rows.reverse();
  const names = await namesFor(db, rows.map((r) => r.user_id));
  return rows.map((r) => ({ id: r.id, userId: r.user_id, name: r.user_id ? names.get(r.user_id)?.name ?? 'Member' : 'Ascentor', avatarUrl: r.user_id ? names.get(r.user_id)?.avatarUrl ?? null : null, body: r.body, createdAt: r.created_at }));
}

export async function groupMembers(db: Db, groupId: string, limit = 6): Promise<{ id: string; name: string; avatarUrl: string | null }[]> {
  const { data } = await db.from('rx_group_members').select('user_id').eq('group_id', groupId).order('joined_at').limit(limit);
  const ids = ((data ?? []) as { user_id: string }[]).map((m) => m.user_id);
  const names = await namesFor(db, ids);
  return ids.map((id) => ({ id, name: names.get(id)?.name ?? 'Member', avatarUrl: names.get(id)?.avatarUrl ?? null }));
}
