import 'server-only';
// lib/rx/chats.ts
// Admin-only access to chats: Circle chats, group rooms, direct messages and Sage conversations. Every view and every
// export is written to chat_access_log. Members agree to this at signup (chat_consent_at). Reads use the service role,
// so callers must have passed requireAdmin() first.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { previewOf, parseBody } from './media';

export type ChatScope = 'circle' | 'group' | 'dm' | 'sage' | 'member';

export interface TranscriptLine { at: string; who: string; text: string }
export interface Transcript { title: string; subtitle: string; scope: ChatScope; id: string; lines: TranscriptLine[]; truncated: boolean }

const MAX_LINES = 5000;

async function names(ids: (string | null)[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter((x): x is string => !!x))];
  const out = new Map<string, string>();
  if (!uniq.length) return out;
  const { data } = await supabaseAdmin.from('member_directory').select('id, full_name').in('id', uniq);
  for (const p of (data ?? []) as { id: string; full_name: string | null }[]) out.set(p.id, p.full_name?.trim() || 'Member');
  return out;
}

function lineText(body: string): string {
  const p = parseBody(body);
  if (p.kind === 'text') return p.text;
  return `[${previewOf(body)}] ${p.url}`;
}

function range<T extends { gte: (c: string, v: string) => T; lte: (c: string, v: string) => T }>(q: T, from?: string, to?: string): T {
  let r = q;
  if (from) r = r.gte('created_at', `${from}T00:00:00Z`);
  if (to) r = r.lte('created_at', `${to}T23:59:59Z`);
  return r;
}

export async function logAccess(adminId: string, action: 'view' | 'export', scope: ChatScope, refId: string | null, format?: string, detail: Record<string, unknown> = {}) {
  try { await supabaseAdmin.from('chat_access_log').insert({ admin_id: adminId, action, scope, ref_id: refId, format: format ?? null, detail }); }
  catch (e) { console.error('[chats] access log failed', e instanceof Error ? e.message : e); }
}

// ── listings ────────────────────────────────────────────────────────────────

export interface ChatListItem { id: string; title: string; subtitle: string; at: string | null }

export async function listCircleChats(): Promise<ChatListItem[]> {
  const [{ data: circles }, { data: seats }] = await Promise.all([
    supabaseAdmin.from('circles').select('id, name, number, status').order('number'),
    supabaseAdmin.from('circle_seats').select('circle_id').eq('role', 'member'),
  ]);
  const count = new Map<string, number>();
  for (const s of (seats ?? []) as { circle_id: string }[]) count.set(s.circle_id, (count.get(s.circle_id) ?? 0) + 1);
  const out: ChatListItem[] = [];
  for (const c of (circles ?? []) as { id: string; name: string; number: number; status: string }[]) {
    const { data: last } = await supabaseAdmin.from('circle_messages').select('created_at').eq('circle_id', c.id).order('created_at', { ascending: false }).limit(1);
    out.push({ id: c.id, title: `${c.name} · Circle ${c.number}`, subtitle: `${c.status} · ${count.get(c.id) ?? 0} members`, at: (last?.[0]?.created_at as string | undefined) ?? null });
  }
  return out;
}

export async function listGroupChats(): Promise<ChatListItem[]> {
  const { data: groups } = await supabaseAdmin.from('rx_groups').select('id, name, status').order('name');
  const out: ChatListItem[] = [];
  for (const g of (groups ?? []) as { id: string; name: string; status: string }[]) {
    const { data: last } = await supabaseAdmin.from('rx_group_messages').select('created_at').eq('group_id', g.id).order('created_at', { ascending: false }).limit(1);
    out.push({ id: g.id, title: g.name, subtitle: g.status, at: (last?.[0]?.created_at as string | undefined) ?? null });
  }
  return out;
}

async function memberIdsMatching(search: string): Promise<string[]> {
  const q = search.trim();
  if (!q) return [];
  const [byName, byEmail] = await Promise.all([
    supabaseAdmin.from('member_directory').select('id').ilike('full_name', `%${q}%`).limit(50),
    supabaseAdmin.from('profiles').select('id').ilike('email', `%${q}%`).limit(50),
  ]);
  return [...new Set([...((byName.data ?? []) as { id: string }[]).map((r) => r.id), ...((byEmail.data ?? []) as { id: string }[]).map((r) => r.id)])];
}

export async function listDmChats(search: string): Promise<ChatListItem[]> {
  let q = supabaseAdmin.from('dm_threads').select('id, user_a, user_b, status, last_message_at').order('last_message_at', { ascending: false }).limit(100);
  if (search.trim()) {
    const ids = await memberIdsMatching(search);
    if (!ids.length) return [];
    q = q.or(`user_a.in.(${ids.join(',')}),user_b.in.(${ids.join(',')})`);
  }
  const { data } = await q;
  const rows = (data ?? []) as { id: string; user_a: string; user_b: string; status: string; last_message_at: string }[];
  const nm = await names(rows.flatMap((r) => [r.user_a, r.user_b]));
  return rows.map((r) => ({ id: r.id, title: `${nm.get(r.user_a)} and ${nm.get(r.user_b)}`, subtitle: r.status, at: r.last_message_at }));
}

export async function listSageChats(search: string): Promise<ChatListItem[]> {
  let q = supabaseAdmin.from('sage_conversations').select('id, user_id, topic, updated_at').order('updated_at', { ascending: false }).limit(100);
  if (search.trim()) {
    const ids = await memberIdsMatching(search);
    if (!ids.length) return [];
    q = q.in('user_id', ids);
  }
  const { data } = await q;
  const rows = (data ?? []) as { id: string; user_id: string; topic: string; updated_at: string }[];
  const nm = await names(rows.map((r) => r.user_id));
  return rows.map((r) => ({ id: r.id, title: nm.get(r.user_id) ?? 'Member', subtitle: `Sage · ${r.topic}`, at: r.updated_at }));
}

export async function findMembers(search: string): Promise<{ id: string; name: string; email: string | null }[]> {
  const ids = await memberIdsMatching(search);
  if (!ids.length) return [];
  const { data } = await supabaseAdmin.from('profiles').select('id, full_name, email').in('id', ids).limit(50);
  return ((data ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => ({ id: p.id, name: p.full_name?.trim() || 'Member', email: p.email }));
}

// ── transcripts ─────────────────────────────────────────────────────────────

export async function circleTranscript(id: string, from?: string, to?: string): Promise<Transcript | null> {
  const { data: c } = await supabaseAdmin.from('circles').select('name, number').eq('id', id).maybeSingle();
  if (!c) return null;
  const { data } = await range(supabaseAdmin.from('circle_messages').select('user_id, body, created_at').eq('circle_id', id).order('created_at').limit(MAX_LINES + 1), from, to);
  const rows = (data ?? []) as { user_id: string | null; body: string; created_at: string }[];
  const nm = await names(rows.map((r) => r.user_id));
  return { title: `${c.name} · Circle ${c.number}`, subtitle: 'Circle chat', scope: 'circle', id, truncated: rows.length > MAX_LINES, lines: rows.slice(0, MAX_LINES).map((r) => ({ at: r.created_at, who: r.user_id ? nm.get(r.user_id) ?? 'Member' : 'Ascentor', text: lineText(r.body) })) };
}

export async function groupTranscript(id: string, from?: string, to?: string): Promise<Transcript | null> {
  const { data: g } = await supabaseAdmin.from('rx_groups').select('name').eq('id', id).maybeSingle();
  if (!g) return null;
  const { data } = await range(supabaseAdmin.from('rx_group_messages').select('user_id, body, created_at').eq('group_id', id).order('created_at').limit(MAX_LINES + 1), from, to);
  const rows = (data ?? []) as { user_id: string | null; body: string; created_at: string }[];
  const nm = await names(rows.map((r) => r.user_id));
  return { title: g.name as string, subtitle: 'Group room', scope: 'group', id, truncated: rows.length > MAX_LINES, lines: rows.slice(0, MAX_LINES).map((r) => ({ at: r.created_at, who: r.user_id ? nm.get(r.user_id) ?? 'Member' : 'Ascentor', text: lineText(r.body) })) };
}

export async function dmTranscript(id: string, from?: string, to?: string): Promise<Transcript | null> {
  const { data: t } = await supabaseAdmin.from('dm_threads').select('user_a, user_b, status').eq('id', id).maybeSingle();
  if (!t) return null;
  const { data } = await range(supabaseAdmin.from('dm_messages').select('sender_id, body, created_at').eq('thread_id', id).order('created_at').limit(MAX_LINES + 1), from, to);
  const rows = (data ?? []) as { sender_id: string; body: string; created_at: string }[];
  const nm = await names([t.user_a as string, t.user_b as string, ...rows.map((r) => r.sender_id)]);
  return { title: `${nm.get(t.user_a as string)} and ${nm.get(t.user_b as string)}`, subtitle: `Direct messages (${t.status})`, scope: 'dm', id, truncated: rows.length > MAX_LINES, lines: rows.slice(0, MAX_LINES).map((r) => ({ at: r.created_at, who: nm.get(r.sender_id) ?? 'Member', text: lineText(r.body) })) };
}

export async function sageTranscript(id: string, from?: string, to?: string): Promise<Transcript | null> {
  const { data: c } = await supabaseAdmin.from('sage_conversations').select('user_id, topic').eq('id', id).maybeSingle();
  if (!c) return null;
  const { data } = await range(supabaseAdmin.from('sage_messages').select('role, body, created_at').eq('conversation_id', id).order('created_at').limit(MAX_LINES + 1), from, to);
  const rows = (data ?? []) as { role: 'user' | 'sage'; body: string; created_at: string }[];
  const nm = await names([c.user_id as string]);
  const who = nm.get(c.user_id as string) ?? 'Member';
  return { title: `${who} with Sage`, subtitle: `Sage conversation · ${c.topic}`, scope: 'sage', id, truncated: rows.length > MAX_LINES, lines: rows.slice(0, MAX_LINES).map((r) => ({ at: r.created_at, who: r.role === 'sage' ? 'Sage' : who, text: r.body })) };
}

/** Everything one member has written or received: Circle, groups, direct messages and Sage. */
export async function memberTranscripts(userId: string, from?: string, to?: string): Promise<Transcript[]> {
  const out: Transcript[] = [];
  const nm = await names([userId]);
  const name = nm.get(userId) ?? 'Member';

  const { data: seats } = await supabaseAdmin.from('circle_seats').select('circle_id').eq('user_id', userId);
  for (const s of (seats ?? []) as { circle_id: string }[]) { const t = await circleTranscript(s.circle_id, from, to); if (t) out.push({ ...t, subtitle: `${t.subtitle} (whole chat)` }); }

  const { data: memberships } = await supabaseAdmin.from('rx_group_members').select('group_id').eq('user_id', userId);
  for (const m of (memberships ?? []) as { group_id: string }[]) { const t = await groupTranscript(m.group_id, from, to); if (t) out.push(t); }

  const { data: threads } = await supabaseAdmin.from('dm_threads').select('id').or(`user_a.eq.${userId},user_b.eq.${userId}`);
  for (const th of (threads ?? []) as { id: string }[]) { const t = await dmTranscript(th.id, from, to); if (t && t.lines.length) out.push(t); }

  const { data: convs } = await supabaseAdmin.from('sage_conversations').select('id').eq('user_id', userId).order('started_at');
  for (const c of (convs ?? []) as { id: string }[]) { const t = await sageTranscript(c.id, from, to); if (t && t.lines.length) out.push(t); }

  if (!out.length) out.push({ title: `${name}`, subtitle: 'No chats found', scope: 'member', id: userId, lines: [], truncated: false });
  return out;
}

export async function getTranscripts(scope: ChatScope, id: string, from?: string, to?: string): Promise<Transcript[]> {
  switch (scope) {
    case 'circle': { const t = await circleTranscript(id, from, to); return t ? [t] : []; }
    case 'group': { const t = await groupTranscript(id, from, to); return t ? [t] : []; }
    case 'dm': { const t = await dmTranscript(id, from, to); return t ? [t] : []; }
    case 'sage': { const t = await sageTranscript(id, from, to); return t ? [t] : []; }
    case 'member': return memberTranscripts(id, from, to);
  }
}
