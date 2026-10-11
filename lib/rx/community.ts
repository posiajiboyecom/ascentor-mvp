import 'server-only';
// lib/rx/community.ts
// Reads for Groups: the directory and group rooms. (The Community feed lives in feed.ts.)

import { createClient } from '@/lib/supabase/server';
import { getMe, namesFor, type Db } from './server';
import type { ChatMsg } from './chat-types';

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
