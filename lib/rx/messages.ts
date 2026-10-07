import 'server-only';
// lib/rx/messages.ts
// Reads for the inbox: conversations (Circle chat, direct messages, joined groups) and message requests.

import { createClient } from '@/lib/supabase/server';
import { getMe, getMyCircle, namesFor, type Db } from './server';
import { previewOf } from './media';
import { relTime } from './dates';
import { looksLikeScam } from './safety';
import type { ChatMsg } from './chat-types';

export interface ThreadItem {
  key: string;            // 'circle' | 'g:<slug>' | <dm thread id>
  kind: 'circle' | 'group' | 'dm';
  name: string;
  avatarUrl: string | null;
  seed: string;
  last: string;
  time: string;
  at: string;
  otherId?: string;
}

export interface RequestItem {
  threadId: string;
  fromId: string;
  name: string;
  avatarUrl: string | null;
  text: string;
  flagged: boolean;
  stage: string | null;
  city: string | null;
}

export async function dmMessages(db: Db, threadId: string, afterISO?: string | null, limit = 200): Promise<ChatMsg[]> {
  let q = db.from('dm_messages').select('id, sender_id, body, created_at').eq('thread_id', threadId);
  q = afterISO ? q.gt('created_at', afterISO).order('created_at') : q.order('created_at', { ascending: false }).limit(limit);
  const { data } = await q;
  const rows = (data ?? []) as { id: string; sender_id: string; body: string; created_at: string }[];
  if (!afterISO) rows.reverse();
  const names = await namesFor(db, rows.map((r) => r.sender_id));
  return rows.map((r) => ({ id: r.id, userId: r.sender_id, name: names.get(r.sender_id)?.name ?? 'Member', avatarUrl: names.get(r.sender_id)?.avatarUrl ?? null, body: r.body, createdAt: r.created_at }));
}

export async function listThreads(): Promise<ThreadItem[]> {
  const me = await getMe();
  if (!me) return [];
  const db = await createClient();
  const out: ThreadItem[] = [];

  const circle = await getMyCircle();
  if (circle && circle.pledged) {
    const { data } = await db.from('circle_messages').select('body, created_at, user_id').eq('circle_id', circle.circle.id).order('created_at', { ascending: false }).limit(1);
    const m = (data ?? [])[0] as { body: string; created_at: string; user_id: string | null } | undefined;
    const who = m?.user_id ? (await namesFor(db, [m.user_id])).get(m.user_id)?.name.split(' ')[0] : 'Ascentor';
    out.push({ key: 'circle', kind: 'circle', name: `${circle.circle.name} · Circle`, avatarUrl: null, seed: circle.circle.id, last: m ? `${who}: ${previewOf(m.body)}` : 'Say hello to your Circle', time: m ? relTime(m.created_at) : '', at: m?.created_at ?? circle.circle.id });
  }

  const [{ data: threads }, { data: memberships }] = await Promise.all([
    db.from('dm_threads').select('id, user_a, user_b, requested_by, status, last_message_at').eq('status', 'accepted').order('last_message_at', { ascending: false }),
    db.from('rx_group_members').select('group_id').eq('user_id', me.userId),
  ]);

  const rows = (threads ?? []) as { id: string; user_a: string; user_b: string; last_message_at: string }[];
  const others = rows.map((t) => (t.user_a === me.userId ? t.user_b : t.user_a));
  const names = await namesFor(db, others);
  const { data: blocks } = await db.from('dm_blocks').select('blocked_id').eq('blocker_id', me.userId);
  const blocked = new Set(((blocks ?? []) as { blocked_id: string }[]).map((b) => b.blocked_id));
  for (const [i, t] of rows.entries()) {
    const other = others[i];
    if (blocked.has(other)) continue;
    const { data: last } = await db.from('dm_messages').select('body, sender_id, created_at').eq('thread_id', t.id).order('created_at', { ascending: false }).limit(1);
    const m = (last ?? [])[0] as { body: string; sender_id: string; created_at: string } | undefined;
    out.push({ key: t.id, kind: 'dm', name: names.get(other)?.name ?? 'Member', avatarUrl: names.get(other)?.avatarUrl ?? null, seed: other, otherId: other, last: m ? `${m.sender_id === me.userId ? 'You: ' : ''}${previewOf(m.body)}` : 'No messages yet', time: m ? relTime(m.created_at) : '', at: m?.created_at ?? t.last_message_at });
  }

  const gids = ((memberships ?? []) as { group_id: string }[]).map((g) => g.group_id);
  if (gids.length) {
    const { data: groups } = await db.from('rx_groups').select('id, slug, name').in('id', gids).eq('status', 'active');
    for (const g of (groups ?? []) as { id: string; slug: string; name: string }[]) {
      const { data: last } = await db.from('rx_group_messages').select('body, user_id, created_at').eq('group_id', g.id).order('created_at', { ascending: false }).limit(1);
      const m = (last ?? [])[0] as { body: string; user_id: string | null; created_at: string } | undefined;
      if (!m) continue; // only rooms with activity appear in the inbox
      const who = m.user_id ? (await namesFor(db, [m.user_id])).get(m.user_id)?.name.split(' ')[0] : 'Ascentor';
      out.push({ key: `g:${g.slug}`, kind: 'group', name: g.name, avatarUrl: null, seed: g.id, last: `${who}: ${previewOf(m.body)}`, time: relTime(m.created_at), at: m.created_at });
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export async function listRequests(): Promise<RequestItem[]> {
  const me = await getMe();
  if (!me) return [];
  const db = await createClient();
  const { data } = await db.from('dm_threads').select('id, requested_by').eq('status', 'request').neq('requested_by', me.userId).order('last_message_at', { ascending: false });
  const rows = (data ?? []) as { id: string; requested_by: string }[];
  if (!rows.length) return [];
  const [names, cards, firsts] = await Promise.all([
    namesFor(db, rows.map((r) => r.requested_by)),
    db.from('rx_member_cards').select('user_id, stage, city').in('user_id', rows.map((r) => r.requested_by)),
    db.from('dm_messages').select('thread_id, body, created_at').in('thread_id', rows.map((r) => r.id)).order('created_at'),
  ]);
  const card = new Map(((cards.data ?? []) as { user_id: string; stage: string | null; city: string | null }[]).map((c) => [c.user_id, c]));
  const first = new Map<string, string>();
  for (const m of (firsts.data ?? []) as { thread_id: string; body: string }[]) if (!first.has(m.thread_id)) first.set(m.thread_id, m.body);
  return rows.map((r) => {
    const body = first.get(r.id) ?? '';
    return { threadId: r.id, fromId: r.requested_by, name: names.get(r.requested_by)?.name ?? 'Member', avatarUrl: names.get(r.requested_by)?.avatarUrl ?? null, text: previewOf(body), flagged: looksLikeScam(body), stage: card.get(r.requested_by)?.stage ?? null, city: card.get(r.requested_by)?.city ?? null };
  });
}

export interface MemberCard { userId: string; name: string; avatarUrl: string | null; stage: string | null; city: string | null; interests: string[] }

export async function memberCard(userId: string): Promise<MemberCard | null> {
  const db = await createClient();
  const { data } = await db.from('rx_member_cards').select('user_id, full_name, avatar_url, stage, city, interests').eq('user_id', userId).maybeSingle();
  if (!data) return null;
  const d = data as { user_id: string; full_name: string | null; avatar_url: string | null; stage: string | null; city: string | null; interests: string[] | null };
  return { userId: d.user_id, name: d.full_name?.trim() || 'Member', avatarUrl: d.avatar_url, stage: d.stage, city: d.city, interests: d.interests ?? [] };
}
