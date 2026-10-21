import 'server-only';
// Conversations (admin console): lists per tab, transcripts and export builders, all from the real tables.
// Admins may read members' conversations (members agree at signup). Callers MUST have checked the level and MUST write the audit entry.

import zlib from 'zlib';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { parseBody } from '@/lib/rx/media';
import { toPdf } from '@/lib/rx/chat-export';
import type { Transcript } from '@/lib/rx/chats';
import { EXPORT_ROW_CAP, TABS, type ExportRequest, type TabKey } from '@/lib/admin/conversations-meta';

const db = supabaseAdmin;
const TZ = 'Africa/Lagos';
const LIST_CAP = 200;
const VIEW_CAP = 2000;
const FETCH_CAP = 20000;
const AGENDA_MIN_QUESTIONS = 3;

export interface Line { at: string; id: string; whoId: string | null; who: string; text: string; flagged?: boolean }
export interface Convo { tab: TabKey; id: string; title: string; kind: string; lines: Line[]; people: Record<string, string>; truncated: boolean }
export interface ListRow { id: string; cells: string[] }
export interface TabList { rows: ListRow[]; note?: string }

const PLAN_LABEL: Record<string, string> = { explorer: 'Seeker', builder: 'Builder', leader: 'Leader', climber: 'Climber' };

// ── small helpers ───────────────────────────────────────────────────────────

const isUuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s);
const num = (n: number) => n.toLocaleString('en-GB');

function snip(t: string, n = 60): string {
  const s = t.replace(/\s+/g, ' ').trim();
  return !s ? '-' : s.length > n ? `${s.slice(0, n - 3)}...` : s;
}

function dateLabel(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }) : '-';
}

const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

async function names(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter((x): x is string => !!x))];
  const out = new Map<string, string>();
  for (let i = 0; i < uniq.length; i += 200) {
    const { data } = await db.from('member_directory').select('id, full_name').in('id', uniq.slice(i, i + 200));
    for (const p of (data ?? []) as { id: string; full_name: string | null }[]) out.set(p.id, p.full_name?.trim() || 'Member');
  }
  return out;
}

function bodyText(body: string): { text: string; media?: 'Photo' | 'Voice note'; url?: string } {
  const p = parseBody(body ?? '');
  if (p.kind === 'text') return { text: p.text };
  return { text: '', media: p.kind === 'img' ? 'Photo' : 'Voice note', url: p.url };
}

/** The line text. Photos and voice notes are links only, and only when asked for. */
function lineFrom(body: string, attach: boolean): string {
  const b = bodyText(body);
  if (!b.media) return b.text;
  return attach ? `[${b.media}] ${b.url}` : `[${b.media}]`;
}

// Raw bodies are kept (media tokens included) until the export decides about attachments.
function mk(id: string, at: string, whoId: string | null, who: string, body: string, flagged?: boolean): Line {
  return { id, at, whoId, who, text: body ?? '', flagged };
}

// ── lists ───────────────────────────────────────────────────────────────────

interface Msg { key: string; user: string | null; body: string; at: string }

/** Counts and latest message per key from one capped query, newest first. */
function tally(rows: Msg[]) {
  const count = new Map<string, number>();
  const last = new Map<string, Msg>();
  for (const r of rows) {
    count.set(r.key, (count.get(r.key) ?? 0) + 1);
    if (!last.has(r.key)) last.set(r.key, r);
  }
  return { count, last };
}

async function listSage(limit: number): Promise<TabList> {
  const [convs, legacy] = await Promise.all([
    db.from('sage_conversations').select('id, user_id, topic, updated_at').order('updated_at', { ascending: false }).limit(limit),
    db.from('coaching_sessions').select('id, user_id, user_input, ai_response, created_at').order('created_at', { ascending: false }).limit(limit),
  ]);
  const cs = (convs.data ?? []) as { id: string; user_id: string; topic: string; updated_at: string }[];
  const ls = (legacy.data ?? []) as { id: string; user_id: string; user_input: string | null; ai_response: string | null; created_at: string }[];
  const ids = cs.map((c) => c.id);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data } = await db.from('sage_messages').select('conversation_id').in('conversation_id', ids).limit(FETCH_CAP);
    for (const m of (data ?? []) as { conversation_id: string }[]) counts.set(m.conversation_id, (counts.get(m.conversation_id) ?? 0) + 1);
  }
  const users = [...cs.map((c) => c.user_id), ...ls.map((c) => c.user_id)];
  const [nm, prof, mp] = await Promise.all([
    names(users),
    users.length ? db.from('profiles').select('id, subscription_plan').in('id', [...new Set(users)]) : Promise.resolve({ data: [] }),
    users.length ? db.from('member_profile').select('user_id, city').in('user_id', [...new Set(users)]) : Promise.resolve({ data: [] }),
  ]);
  const plan = new Map(((prof.data ?? []) as { id: string; subscription_plan: string | null }[]).map((p) => [p.id, p.subscription_plan]));
  const city = new Map(((mp.data ?? []) as { user_id: string; city: string | null }[]).map((p) => [p.user_id, p.city]));
  const who = (u: string) => [PLAN_LABEL[plan.get(u) ?? ''] ?? null, city.get(u) ?? null].filter(Boolean).join(' · ') || '-';
  const rows: (ListRow & { at: string })[] = [
    ...cs.map((c) => ({ id: c.id, at: c.updated_at, cells: [`${nm.get(c.user_id) ?? 'Member'} · Sage`, who(c.user_id), num(counts.get(c.id) ?? 0), snip(c.topic || '')] })),
    ...ls.map((c) => ({ id: `cs:${c.id}`, at: c.created_at, cells: [`${nm.get(c.user_id) ?? 'Member'} · Sage`, who(c.user_id), num((c.user_input ? 1 : 0) + (c.ai_response ? 1 : 0)), snip(c.user_input ?? '')] })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  return { rows: rows.map(({ id, cells }) => ({ id, cells })) };
}

async function listDm(limit: number): Promise<TabList> {
  const { data } = await db.from('dm_threads').select('id, user_a, user_b, last_message_at').order('last_message_at', { ascending: false }).limit(limit);
  const th = (data ?? []) as { id: string; user_a: string; user_b: string; last_message_at: string }[];
  if (!th.length) return { rows: [] };
  const { data: msgs } = await db.from('dm_messages').select('thread_id, sender_id, body, created_at').in('thread_id', th.map((t) => t.id)).order('created_at', { ascending: false }).limit(FETCH_CAP);
  const t = tally(((msgs ?? []) as { thread_id: string; sender_id: string; body: string; created_at: string }[]).map((m) => ({ key: m.thread_id, user: m.sender_id, body: m.body, at: m.created_at })));
  const nm = await names(th.flatMap((x) => [x.user_a, x.user_b]));
  return {
    rows: th.map((x) => {
      const l = t.last.get(x.id);
      return { id: x.id, cells: [`${nm.get(x.user_a) ?? 'Member'} ↔ ${nm.get(x.user_b) ?? 'Member'}`, '2', num(t.count.get(x.id) ?? 0), l ? snip(lineFrom(l.body, false)) : '-'] };
    }),
  };
}

async function listCircle(limit: number): Promise<TabList> {
  const [{ data: circles }, { data: seats }, { data: msgs }] = await Promise.all([
    db.from('circles').select('id, name, number').order('number').limit(limit),
    db.from('circle_seats').select('circle_id').eq('role', 'member').limit(FETCH_CAP),
    db.from('circle_messages').select('circle_id, user_id, body, created_at').order('created_at', { ascending: false }).limit(FETCH_CAP),
  ]);
  const members = new Map<string, number>();
  for (const s of (seats ?? []) as { circle_id: string }[]) members.set(s.circle_id, (members.get(s.circle_id) ?? 0) + 1);
  const ms = (msgs ?? []) as { circle_id: string; user_id: string | null; body: string; created_at: string }[];
  const t = tally(ms.map((m) => ({ key: m.circle_id, user: m.user_id, body: m.body, at: m.created_at })));
  const nm = await names([...t.last.values()].map((l) => l.user));
  return {
    rows: ((circles ?? []) as { id: string; name: string; number: number }[]).map((c) => {
      const l = t.last.get(c.id);
      const first = l?.user ? (nm.get(l.user) ?? 'Member').split(' ')[0] : 'Ascentor';
      return { id: c.id, cells: [`${c.name} · Circle ${c.number}`, num(members.get(c.id) ?? 0), num(t.count.get(c.id) ?? 0), l ? `${first}: ${snip(lineFrom(l.body, false), 50)}` : '-'] };
    }),
  };
}

async function listGroup(limit: number): Promise<TabList> {
  const [{ data: groups }, { data: mem }, { data: msgs }] = await Promise.all([
    db.from('rx_groups').select('id, name').order('name').limit(limit),
    db.from('rx_group_members').select('group_id').limit(FETCH_CAP),
    db.from('rx_group_messages').select('group_id, user_id, body, created_at').order('created_at', { ascending: false }).limit(FETCH_CAP),
  ]);
  const members = new Map<string, number>();
  for (const s of (mem ?? []) as { group_id: string }[]) members.set(s.group_id, (members.get(s.group_id) ?? 0) + 1);
  const t = tally(((msgs ?? []) as { group_id: string; user_id: string | null; body: string; created_at: string }[]).map((m) => ({ key: m.group_id, user: m.user_id, body: m.body, at: m.created_at })));
  const nm = await names([...t.last.values()].map((l) => l.user));
  return {
    rows: ((groups ?? []) as { id: string; name: string }[]).map((g) => {
      const l = t.last.get(g.id);
      const first = l?.user ? (nm.get(l.user) ?? 'Member').split(' ')[0] : 'Ascentor';
      return { id: g.id, cells: [g.name, num(members.get(g.id) ?? 0), num(t.count.get(g.id) ?? 0), l ? `${first}: ${snip(lineFrom(l.body, false), 50)}` : '-'] };
    }),
  };
}

async function listAgenda(limit: number): Promise<TabList> {
  const { data } = await db.from('circle_mentor_sessions').select('id, circle_id, mentor_id, starts_at, status').order('starts_at', { ascending: false }).limit(limit);
  const ss = (data ?? []) as { id: string; circle_id: string; mentor_id: string | null; starts_at: string; status: string }[];
  if (!ss.length) return { rows: [] };
  const [{ data: qs }, { data: cs }, { data: ms }] = await Promise.all([
    db.from('mentor_questions').select('session_id').in('session_id', ss.map((s) => s.id)).limit(FETCH_CAP),
    db.from('circles').select('id, name, number').in('id', [...new Set(ss.map((s) => s.circle_id))]),
    db.from('human_mentors').select('id, name').in('id', [...new Set(ss.map((s) => s.mentor_id).filter(Boolean) as string[])]),
  ]);
  const qn = new Map<string, number>();
  for (const q of (qs ?? []) as { session_id: string }[]) qn.set(q.session_id, (qn.get(q.session_id) ?? 0) + 1);
  const circ = new Map(((cs ?? []) as { id: string; name: string; number: number }[]).map((c) => [c.id, `Circle ${c.number}`]));
  const mentor = new Map(((ms ?? []) as { id: string; name: string | null }[]).map((m) => [m.id, m.name ?? 'mentor']));
  return {
    rows: ss.map((s) => {
      const n = qn.get(s.id) ?? 0;
      const st = n === 0 ? 'Not started' : n >= AGENDA_MIN_QUESTIONS ? 'Ready' : 'Draft';
      return { id: s.id, cells: [`Session with ${mentor.get(s.mentor_id ?? '') ?? 'mentor'}`, circ.get(s.circle_id) ?? '-', st === 'Draft' ? `${n} of ${AGENDA_MIN_QUESTIONS}` : String(n), `${st} · ${dateLabel(s.starts_at)}`] };
    }),
  };
}

async function listPosts(limit: number): Promise<TabList> {
  const { data } = await db.from('feed_posts').select('id, user_id, type, sub, body, created_at').eq('deleted', false).order('created_at', { ascending: false }).limit(limit);
  const ps = (data ?? []) as { id: string; user_id: string | null; type: string | null; sub: string | null; body: string | null }[];
  if (!ps.length) return { rows: [] };
  const [{ data: rs }, nm] = await Promise.all([
    db.from('feed_replies').select('post_id').in('post_id', ps.map((p) => p.id)).limit(FETCH_CAP),
    names(ps.map((p) => p.user_id)),
  ]);
  const rn = new Map<string, number>();
  for (const r of (rs ?? []) as { post_id: string }[]) rn.set(r.post_id, (rn.get(r.post_id) ?? 0) + 1);
  return {
    rows: ps.map((p) => ({ id: p.id, cells: [snip(p.body ?? ''), p.user_id ? nm.get(p.user_id) ?? 'Member' : 'Ascentor', num(rn.get(p.id) ?? 0), [p.type, p.sub].filter(Boolean).join(' · ') || '-'] })),
  };
}

interface Activity { sage: number; chats: number; posts: number }

async function memberActivity(): Promise<Map<string, Activity>> {
  const out = new Map<string, Activity>();
  const add = (id: string | null, k: keyof Activity) => { if (!id) return; const a = out.get(id) ?? { sage: 0, chats: 0, posts: 0 }; a[k]++; out.set(id, a); };
  const [s, d, c, g, p] = await Promise.all([
    db.from('sage_messages').select('user_id').eq('role', 'user').limit(FETCH_CAP),
    db.from('dm_messages').select('sender_id').limit(FETCH_CAP),
    db.from('circle_messages').select('user_id').limit(FETCH_CAP),
    db.from('rx_group_messages').select('user_id').limit(FETCH_CAP),
    db.from('feed_posts').select('user_id').eq('deleted', false).limit(FETCH_CAP),
  ]);
  for (const r of (s.data ?? []) as { user_id: string | null }[]) add(r.user_id, 'sage');
  for (const r of (d.data ?? []) as { sender_id: string }[]) add(r.sender_id, 'chats');
  for (const r of (c.data ?? []) as { user_id: string | null }[]) add(r.user_id, 'chats');
  for (const r of (g.data ?? []) as { user_id: string | null }[]) add(r.user_id, 'chats');
  for (const r of (p.data ?? []) as { user_id: string | null }[]) add(r.user_id, 'posts');
  return out;
}

async function listMembers(limit: number): Promise<TabList> {
  const act = await memberActivity();
  const top = [...act.entries()].sort((a, b) => (b[1].sage + b[1].chats + b[1].posts) - (a[1].sage + a[1].chats + a[1].posts)).slice(0, limit);
  const nm = await names(top.map(([id]) => id));
  return { rows: top.map(([id, a]) => ({ id, cells: [nm.get(id) ?? 'Member', `${num(a.sage)} messages`, `${num(a.chats)} messages`, `${num(a.posts)} posts`] })) };
}

export async function listTab(tab: TabKey, limit = LIST_CAP): Promise<TabList> {
  const l = tab === 'sage' ? await listSage(limit) : tab === 'dm' ? await listDm(limit) : tab === 'circle' ? await listCircle(limit) : tab === 'group' ? await listGroup(limit)
    : tab === 'agenda' ? await listAgenda(limit) : tab === 'posts' ? await listPosts(limit) : await listMembers(limit);
  return { ...l, note: l.rows.length >= limit ? `Showing the ${limit} newest.` : undefined };
}

// ── conversations (transcripts) ─────────────────────────────────────────────

interface Budget { left: number; truncated: boolean }
const viewBudget = (): Budget => ({ left: VIEW_CAP, truncated: false });

function finish(tab: TabKey, id: string, title: string, lines: Line[], people: Map<string, string>, b: Budget, over: boolean): Convo {
  const kind = TABS.find((t) => t.key === tab)!.kind;
  const take = lines.slice(Math.max(0, lines.length - Math.max(b.left, 0)));
  if (over || take.length < lines.length) b.truncated = true;
  b.left -= take.length;
  const ppl: Record<string, string> = {};
  for (const [k, v] of people) ppl[k] = v;
  return { tab, id, title, kind, lines: take, people: ppl, truncated: over || take.length < lines.length };
}

/** Newest-first fetch with a limit, returned oldest-first. `over` tells if more existed. */
async function fetchMsgs<T extends { created_at: string }>(build: (limit: number) => PromiseLike<{ data: unknown }>, b: Budget): Promise<{ rows: T[]; over: boolean }> {
  const limit = Math.max(b.left, 0) + 1;
  const { data } = await build(limit);
  const rows = ((data ?? []) as T[]).slice();
  const over = rows.length > limit - 1;
  return { rows: rows.slice(0, limit - 1).reverse(), over };
}

async function sageConvo(id: string, since: string | null, b: Budget): Promise<Convo | null> {
  if (id.startsWith('cs:')) {
    const cid = id.slice(3);
    if (!isUuid(cid)) return null;
    const { data: c } = await db.from('coaching_sessions').select('user_id, user_input, ai_response, created_at').eq('id', cid).maybeSingle();
    if (!c) return null;
    const nm = await names([c.user_id as string]);
    const who = nm.get(c.user_id as string) ?? 'Member';
    const at = c.created_at as string;
    const lines: Line[] = [];
    if (c.user_input) lines.push(mk(`${cid}-a`, at, c.user_id as string, who, c.user_input as string));
    if (c.ai_response) lines.push(mk(`${cid}-b`, at, null, 'Sage', c.ai_response as string));
    return finish('sage', id, `${who} · Sage`, since ? lines.filter((l) => l.at >= since) : lines, new Map([[c.user_id as string, who]]), b, false);
  }
  if (!isUuid(id)) return null;
  const { data: c } = await db.from('sage_conversations').select('user_id, topic').eq('id', id).maybeSingle();
  if (!c) return null;
  const { rows, over } = await fetchMsgs<{ id: string; role: string; body: string; created_at: string }>((limit) => {
    let q = db.from('sage_messages').select('id, role, body, created_at').eq('conversation_id', id).order('created_at', { ascending: false }).limit(limit);
    if (since) q = q.gte('created_at', since);
    return q;
  }, b);
  const nm = await names([c.user_id as string]);
  const who = nm.get(c.user_id as string) ?? 'Member';
  return finish('sage', id, `${who} · Sage`, rows.map((r) => (r.role === 'sage' ? mk(r.id, r.created_at, null, 'Sage', r.body) : mk(r.id, r.created_at, c.user_id as string, who, r.body))), new Map([[c.user_id as string, who]]), b, over);
}

async function dmConvo(id: string, since: string | null, b: Budget): Promise<Convo | null> {
  if (!isUuid(id)) return null;
  const { data: t } = await db.from('dm_threads').select('user_a, user_b').eq('id', id).maybeSingle();
  if (!t) return null;
  const { rows, over } = await fetchMsgs<{ id: string; sender_id: string; body: string; flagged: boolean | null; created_at: string }>((limit) => {
    let q = db.from('dm_messages').select('id, sender_id, body, flagged, created_at').eq('thread_id', id).order('created_at', { ascending: false }).limit(limit);
    if (since) q = q.gte('created_at', since);
    return q;
  }, b);
  const nm = await names([t.user_a as string, t.user_b as string]);
  const a = nm.get(t.user_a as string) ?? 'Member';
  const c = nm.get(t.user_b as string) ?? 'Member';
  return finish('dm', id, `${a} ↔ ${c}`, rows.map((r) => mk(r.id, r.created_at, r.sender_id, nm.get(r.sender_id) ?? 'Member', r.body, !!r.flagged)), nm, b, over);
}

async function roomConvo(tab: 'circle' | 'group', id: string, since: string | null, b: Budget, onlyUser?: string): Promise<Convo | null> {
  if (!isUuid(id)) return null;
  let title = '';
  if (tab === 'circle') {
    const { data: c } = await db.from('circles').select('name, number').eq('id', id).maybeSingle();
    if (!c) return null;
    title = `${c.name} · Circle ${c.number}`;
  } else {
    const { data: g } = await db.from('rx_groups').select('name').eq('id', id).maybeSingle();
    if (!g) return null;
    title = g.name as string;
  }
  const { rows, over } = await fetchMsgs<{ id: string; user_id: string | null; body: string; created_at: string }>((limit) => {
    let q = db.from(tab === 'circle' ? 'circle_messages' : 'rx_group_messages').select('id, user_id, body, created_at').eq(tab === 'circle' ? 'circle_id' : 'group_id', id).order('created_at', { ascending: false }).limit(limit);
    if (since) q = q.gte('created_at', since);
    if (onlyUser) q = q.eq('user_id', onlyUser);
    return q;
  }, b);
  const nm = await names(rows.map((r) => r.user_id));
  const people = new Map([...nm.entries()]);
  return finish(tab, id, title, rows.map((r) => mk(r.id, r.created_at, r.user_id, r.user_id ? nm.get(r.user_id) ?? 'Member' : 'Ascentor', r.body)), people, b, over);
}

async function agendaConvo(id: string, since: string | null, b: Budget): Promise<Convo | null> {
  if (!isUuid(id)) return null;
  const { data: s } = await db.from('circle_mentor_sessions').select('circle_id, mentor_id, starts_at').eq('id', id).maybeSingle();
  if (!s) return null;
  const [{ data: m }, { data: c }, { data: qs }] = await Promise.all([
    s.mentor_id ? db.from('human_mentors').select('name').eq('id', s.mentor_id as string).maybeSingle() : Promise.resolve({ data: null }),
    db.from('circles').select('number').eq('id', s.circle_id as string).maybeSingle(),
    db.from('mentor_questions').select('id, user_id, text, created_at').eq('session_id', id).order('created_at').limit(500),
  ]);
  const rows = ((qs ?? []) as { id: string; user_id: string; text: string; created_at: string }[]).filter((q) => !since || q.created_at >= since);
  const nm = await names(rows.map((r) => r.user_id));
  const title = `Session with ${(m?.name as string | undefined) ?? 'mentor'}${c ? ` · Circle ${c.number}` : ''} · ${dateLabel(s.starts_at as string)}`;
  return finish('agenda', id, title, rows.map((r) => mk(r.id, r.created_at, r.user_id, nm.get(r.user_id) ?? 'Member', r.text)), nm, b, false);
}

async function postConvo(id: string, since: string | null, b: Budget): Promise<Convo | null> {
  if (!isUuid(id)) return null;
  const { data: p } = await db.from('feed_posts').select('id, user_id, body, created_at, media').eq('id', id).eq('deleted', false).maybeSingle();
  if (!p) return null;
  const { data: rs } = await db.from('feed_replies').select('id, user_id, body, created_at').eq('post_id', id).order('created_at').limit(1000);
  const replies = (rs ?? []) as { id: string; user_id: string | null; body: string; created_at: string }[];
  const nm = await names([p.user_id as string | null, ...replies.map((r) => r.user_id)]);
  const lines = [mk(p.id as string, p.created_at as string, p.user_id as string | null, p.user_id ? nm.get(p.user_id as string) ?? 'Member' : 'Ascentor', ((p.body as string | null) ?? '') + mediaLinks(p.media)), ...replies.map((r) => mk(r.id, r.created_at, r.user_id, r.user_id ? nm.get(r.user_id) ?? 'Member' : 'Ascentor', r.body))]
    .filter((l) => !since || l.at >= since);
  return finish('posts', id, snip((p.body as string | null) ?? '', 80), lines, nm, b, false);
}

/** Post photos and videos as "\n[Media] url" so the attachments toggle can drop or keep them. */
function mediaLinks(media: unknown): string {
  const urls: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string' && /^https:\/\//.test(v)) urls.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') { const o = v as Record<string, unknown>; if (typeof o.url === 'string') walk(o.url); }
  };
  walk(media);
  return urls.map((u) => `\n[[media]] ${u}`).join('');
}

/** Everything one member has said, by source. Their own lines in rooms, whole direct and Sage conversations. */
export async function memberConvos(userId: string, since: string | null, b: Budget = viewBudget()): Promise<Convo[]> {
  if (!isUuid(userId)) return [];
  const out: Convo[] = [];
  const push = (c: Convo | null, prefix?: string) => { if (c && c.lines.length) out.push(prefix ? { ...c, title: `${prefix} · ${c.title}`, tab: 'member', kind: TABS.find((t) => t.key === 'member')!.kind } : c); };

  const { data: convs } = await db.from('sage_conversations').select('id').eq('user_id', userId).limit(200);
  for (const c of (convs ?? []) as { id: string }[]) { if (b.left <= 0) break; push(await sageConvo(c.id, since, b), 'Sage'); }
  const { data: legacy } = await db.from('coaching_sessions').select('id').eq('user_id', userId).limit(200);
  for (const c of (legacy ?? []) as { id: string }[]) { if (b.left <= 0) break; push(await sageConvo(`cs:${c.id}`, since, b), 'Sage'); }
  const { data: threads } = await db.from('dm_threads').select('id').or(`user_a.eq.${userId},user_b.eq.${userId}`).limit(200);
  for (const t of (threads ?? []) as { id: string }[]) { if (b.left <= 0) break; push(await dmConvo(t.id, since, b), 'Direct message'); }
  const { data: seats } = await db.from('circle_seats').select('circle_id').eq('user_id', userId).limit(50);
  for (const s of (seats ?? []) as { circle_id: string }[]) { if (b.left <= 0) break; push(await roomConvo('circle', s.circle_id, since, b, userId), 'Circle'); }
  const { data: gm } = await db.from('rx_group_members').select('group_id').eq('user_id', userId).limit(100);
  for (const g of (gm ?? []) as { group_id: string }[]) { if (b.left <= 0) break; push(await roomConvo('group', g.group_id, since, b, userId), 'Group'); }
  const { data: posts } = await db.from('feed_posts').select('id').eq('user_id', userId).eq('deleted', false).order('created_at', { ascending: false }).limit(100);
  for (const p of (posts ?? []) as { id: string }[]) { if (b.left <= 0) break; push(await postConvo(p.id, since, b), 'Post'); }
  return out;
}

async function singleConvo(tab: TabKey, id: string, since: string | null, b: Budget): Promise<Convo[]> {
  if (tab === 'member') return memberConvos(id, since, b);
  const c = tab === 'sage' ? await sageConvo(id, since, b) : tab === 'dm' ? await dmConvo(id, since, b) : tab === 'circle' ? await roomConvo('circle', id, since, b)
    : tab === 'group' ? await roomConvo('group', id, since, b) : tab === 'agenda' ? await agendaConvo(id, since, b) : await postConvo(id, since, b);
  return c ? [c] : [];
}

export interface OpenedConvo { name: string; kind: string; msgs: { who: string; text: string; at: string }[]; truncated: boolean }

/** For the transcript panel. Names are real; media shows as a short label. */
export async function openConversation(tab: TabKey, id: string, listName: string): Promise<OpenedConvo | null> {
  const cs = await singleConvo(tab, id, null, viewBudget());
  if (!cs.length) return null;
  const kind = TABS.find((t) => t.key === tab)!.kind;
  if (tab === 'member') {
    const lines = cs.flatMap((c) => c.lines.map((l) => ({ who: `${c.title.split(' · ')[0]} · ${l.who}`, text: lineFrom(stripMedia(l.text), false), at: l.at }))).sort((a, b) => a.at.localeCompare(b.at));
    return { name: listName, kind, msgs: lines.slice(-VIEW_CAP), truncated: cs.some((c) => c.truncated) };
  }
  const c = cs[0];
  return { name: listName || c.title, kind, msgs: c.lines.map((l) => ({ who: l.who, text: lineFrom(stripMedia(l.text), false), at: l.at })), truncated: c.truncated };
}

const stripMedia = (t: string) => t.replace(/\n\[\[media\]\] \S+/g, '\n[Media]');

// ── exports ─────────────────────────────────────────────────────────────────

const RANGE_DAYS: Record<string, number | null> = { 'Last 7 days': 7, 'Last 30 days': 30, 'Last 90 days': 90, 'All time': null };
const EVERYTHING: TabKey[] = ['sage', 'dm', 'circle', 'group', 'agenda', 'posts'];

async function collect(req: ExportRequest, since: string | null, b: Budget): Promise<Convo[]> {
  const all = async (tab: TabKey): Promise<Convo[]> => {
    const out: Convo[] = [];
    const { rows } = await listTab(tab, 2000);
    for (const r of rows) {
      if (b.left <= 0) { b.truncated = true; break; }
      for (const c of await singleConvo(tab, r.id, since, b)) if (c.lines.length) out.push(c);
    }
    return out;
  };
  switch (req.scope) {
    case 'one': return req.tab && req.id ? singleConvo(req.tab, req.id, since, b) : [];
    case 'members': {
      if (!req.tab || !req.id) return [];
      const base = await singleConvo(req.tab, req.id, since, viewBudget());
      const ids = [...new Set(base.flatMap((c) => Object.keys(c.people)))].slice(0, 25);
      if (req.tab === 'member' && isUuid(req.id)) ids.unshift(req.id);
      const out: Convo[] = [];
      for (const uid of [...new Set(ids)]) { if (b.left <= 0) { b.truncated = true; break; } out.push(...(await memberConvos(uid, since, b))); }
      return out;
    }
    case 'tab': return req.tab ? (req.tab === 'member' ? membersAll(since, b) : all(req.tab)) : [];
    case 'everything': { const out: Convo[] = []; for (const t of EVERYTHING) out.push(...(await all(t))); return out; }
    case 'sage': return all('sage');
    case 'dm': return all('dm');
    case 'circlegroup': return [...(await all('circle')), ...(await all('group'))];
    case 'posts': return all('posts');
    case 'agenda': return all('agenda');
  }
}

async function membersAll(since: string | null, b: Budget): Promise<Convo[]> {
  const { rows } = await listTab('member', 500);
  const out: Convo[] = [];
  for (const r of rows) { if (b.left <= 0) { b.truncated = true; break; } out.push(...(await memberConvos(r.id, since, b))); }
  return out;
}

/** Names become short ids everywhere they appear: titles, speakers and inside message text. */
function anonymise(convos: Convo[]): Convo[] {
  const all = new Map<string, string>();
  for (const c of convos) for (const [id, n] of Object.entries(c.people)) all.set(id, n);
  const pairs = [...all.entries()].filter(([, n]) => n.trim().length >= 2 && n !== 'Member').sort((a, b) => b[1].length - a[1].length)
    .map(([id, n]) => ({ re: new RegExp(n.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), tag: `M-${id.slice(0, 8)}` }));
  const tagOf = (id: string | null) => (id ? `M-${id.slice(0, 8)}` : null);
  const scrub = (s: string) => pairs.reduce((acc, p) => acc.replace(p.re, p.tag), s);
  return convos.map((c) => ({
    ...c,
    title: scrub(c.title),
    people: Object.fromEntries(Object.keys(c.people).map((id) => [id, tagOf(id)!])),
    lines: c.lines.map((l) => ({ ...l, who: l.whoId ? tagOf(l.whoId)! : l.who === 'Member' ? 'Member' : l.who, text: scrub(l.text) })),
  }));
}

interface Flat { conversation: string; type: string; at: string; from: string; text: string; id: string; flagged: boolean }

function flatten(convos: Convo[], attach: boolean): Flat[] {
  const out: Flat[] = [];
  for (const c of convos) {
    for (const l of c.lines) {
      const raw = l.text.replace(/\n\[\[media\]\] (\S+)/g, attach ? '\n[Media] $1' : '\n[Media]');
      out.push({ conversation: c.title, type: c.kind, at: l.at, from: l.who, text: clean(lineFrom(raw, attach)), id: l.id, flagged: !!l.flagged });
    }
  }
  return out;
}

const stamp = (iso: string) => new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const guard = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
const csvCell = (v: string) => `"${guard(String(v ?? '')).replace(/"/g, '""')}"`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface Opt { meta: boolean }
function headers(o: Opt) { return ['Conversation', 'Type', ...(o.meta ? ['Time (UTC)'] : []), 'From', 'Message', ...(o.meta ? ['Message ID', 'Flagged by filter'] : [])]; }
function rowOf(f: Flat, o: Opt): string[] { return [f.conversation, f.type, ...(o.meta ? [stamp(f.at)] : []), f.from, f.text, ...(o.meta ? [f.id, f.flagged ? 'Yes' : 'No'] : [])]; }

function toCsv(flat: Flat[], o: Opt): Buffer {
  return Buffer.from('﻿' + [headers(o).map(csvCell).join(','), ...flat.map((f) => rowOf(f, o).map(csvCell).join(','))].join('\r\n'), 'utf8');
}

async function toXlsx(flat: Flat[], convos: Convo[], o: Opt): Promise<Buffer> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const cell = (v: string) => guard(v).slice(0, 32000);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers(o), ...flat.map((f) => rowOf(f, o).map(cell))]), 'Messages');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Conversation', 'Type', 'Messages'], ...convos.map((c) => [cell(c.title), c.kind, c.lines.length])]), 'Conversations');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer);
}

function toJson(convos: Convo[], head: Head, attach: boolean, o: Opt): Buffer {
  const body = convos.map((c) => ({
    conversation: c.title, type: c.kind, ...(o.meta ? { id: c.id } : {}), truncated: c.truncated,
    messages: flatten([c], attach).map((f) => ({ ...(o.meta ? { id: f.id, time: new Date(f.at).toISOString(), flagged: f.flagged } : {}), from: f.from, message: f.text })),
  }));
  return Buffer.from(JSON.stringify({ export: head, conversations: body }, null, 2), 'utf8');
}

interface Head { exportedBy: string; exportedAt: string; scope: string; range: string; namesHidden: boolean; rows: number; capped: boolean }

const headLines = (h: Head) => [`Exported by ${h.exportedBy} on ${stamp(h.exportedAt)}`, `${h.scope} · ${h.range}${h.namesHidden ? ' · member names replaced with IDs' : ''}`, `${h.rows.toLocaleString('en-GB')} messages${h.capped ? `. Capped at ${EXPORT_ROW_CAP.toLocaleString('en-GB')} messages: narrow the range or scope for the rest.` : ''}`, 'Confidential. Contains members’ private messages. Handle under the privacy policy.'];

function toText(convos: Convo[], h: Head, attach: boolean, o: Opt): Buffer {
  const out = ['ASCENTOR: CONVERSATION EXPORT', ...headLines(h)];
  for (const c of convos) {
    out.push('', '='.repeat(72), c.title, c.kind, `${c.lines.length} messages`, '='.repeat(72), '');
    for (const f of flatten([c], attach)) out.push(`${o.meta ? `[${stamp(f.at)}] ` : ''}${f.from}: ${f.text}${o.meta ? ` (id ${f.id})` : ''}`);
  }
  return Buffer.from(out.join('\n') + '\n', 'utf8');
}

function toMarkdown(convos: Convo[], h: Head, attach: boolean, o: Opt): Buffer {
  const out = ['# Ascentor conversation export', '', ...headLines(h).map((l) => `${l}  `)];
  for (const c of convos) {
    out.push('', `## ${c.title.replace(/\n/g, ' ')}`, `*${c.kind} · ${c.lines.length} messages*`, '');
    for (const f of flatten([c], attach)) out.push(`- **${f.from}**${o.meta ? ` (${stamp(f.at)}, id ${f.id})` : ''}: ${f.text.replace(/\n/g, '  \n  ')}`);
  }
  return Buffer.from(out.join('\n') + '\n', 'utf8');
}

function toHtml(convos: Convo[], h: Head, attach: boolean, o: Opt): Buffer {
  const parts = [`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ascentor conversation export</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;color:#111}h2{margin-top:32px}.m{margin:8px 0;padding:8px 12px;background:#f4f4f2;border-radius:10px}.m b{display:block;font-size:12px;color:#666}</style></head><body><h1>Ascentor conversation export</h1>`, ...headLines(h).map((l) => `<p>${esc(l)}</p>`)];
  for (const c of convos) {
    parts.push(`<h2>${esc(c.title)}</h2><p>${esc(c.kind)} · ${c.lines.length} messages</p>`);
    for (const f of flatten([c], attach)) parts.push(`<div class="m"><b>${esc(f.from)}${o.meta ? ` · ${esc(stamp(f.at))} · id ${esc(f.id)}` : ''}</b>${esc(f.text).replace(/\n/g, '<br>')}</div>`);
  }
  parts.push('</body></html>');
  return Buffer.from(parts.join('\n'), 'utf8');
}

async function toDocx(convos: Convo[], h: Head, attach: boolean, o: Opt): Promise<Buffer> {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import('docx');
  const kids: InstanceType<typeof Paragraph>[] = [new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('Ascentor conversation export')] }), ...headLines(h).map((l) => new Paragraph({ children: [new TextRun({ text: l, size: 20 })] }))];
  for (const c of convos) {
    kids.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(clean(c.title))] }), new Paragraph({ children: [new TextRun({ text: `${c.kind} · ${c.lines.length} messages`, italics: true })] }));
    for (const f of flatten([c], attach)) {
      kids.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: `${f.from}${o.meta ? ` · ${stamp(f.at)} · id ${f.id}` : ''}`, bold: true, size: 18 })] }));
      for (const part of f.text.split('\n')) kids.push(new Paragraph({ children: [new TextRun(part)] }));
    }
  }
  return Buffer.from(await Packer.toBuffer(new Document({ sections: [{ children: kids }] })));
}

async function toPdfFile(convos: Convo[], h: Head, attach: boolean): Promise<Buffer> {
  const ts: Transcript[] = convos.map((c) => ({ title: c.title, subtitle: c.kind, scope: 'member', id: c.id, truncated: c.truncated, lines: flatten([c], attach).map((f) => ({ at: f.at, who: f.from, text: f.text })) }));
  return toPdf(ts, { exportedBy: h.exportedBy, exportedAt: h.exportedAt });
}

// A small ZIP writer (deflate) so no extra package is needed.
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf: Buffer): number { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

function zipFiles(files: { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8');
    const comp = zlib.deflateRawSync(f.data);
    const crc = crc32(f.data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(f.data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(f.data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
    central.push(ch, name);
    offset += lh.length + name.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

export interface BuiltExport { filename: string; mime: string; data: Buffer; messages: number; capped: boolean }

const MIME: Record<string, string> = {
  csv: 'text/csv; charset=utf-8', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', json: 'application/json', pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', md: 'text/markdown; charset=utf-8', txt: 'text/plain; charset=utf-8', html: 'text/html; charset=utf-8', zip: 'application/zip',
};

export async function buildExport(req: ExportRequest, exportedBy: string): Promise<BuiltExport> {
  const days = RANGE_DAYS[req.range];
  const since = days ? new Date(Date.now() - days * 864e5).toISOString() : null;
  const b: Budget = { left: EXPORT_ROW_CAP, truncated: false };
  let convos = (await collect(req, since, b)).filter((c) => c.lines.length || req.scope === 'one');
  if (req.anon) convos = anonymise(convos);
  const o: Opt = { meta: req.meta };
  const flat = flatten(convos, req.attach);
  const head: Head = { exportedBy, exportedAt: new Date().toISOString(), scope: req.scopeLabel, range: req.range, namesHidden: req.anon, rows: flat.length, capped: b.truncated };
  const day = new Date().toISOString().slice(0, 10);
  const base = `ascentor-conversations-${req.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'export'}-${day}`;

  const make = async (ext: string): Promise<Buffer> => {
    switch (ext) {
      case 'csv': return toCsv(flat, o);
      case 'xlsx': return toXlsx(flat, convos, o);
      case 'json': return toJson(convos, head, req.attach, o);
      case 'pdf': return toPdfFile(convos, head, req.attach);
      case 'docx': return toDocx(convos, head, req.attach, o);
      case 'md': return toMarkdown(convos, head, req.attach, o);
      case 'html': return toHtml(convos, head, req.attach, o);
      default: return toText(convos, head, req.attach, o);
    }
  };
  const ext = req.format === 'CSV' ? 'csv' : req.format.startsWith('Excel') ? 'xlsx' : req.format === 'JSON' ? 'json' : req.format === 'PDF' ? 'pdf' : req.format.startsWith('Word') ? 'docx'
    : req.format === 'Markdown' ? 'md' : req.format === 'HTML' ? 'html' : req.format.startsWith('ZIP') ? 'zip' : 'txt';
  if (ext === 'zip') {
    const files: { name: string; data: Buffer }[] = [];
    for (const e of ['csv', 'xlsx', 'json', 'pdf', 'docx', 'md', 'txt', 'html']) files.push({ name: `${base}.${e}`, data: await make(e) });
    return { filename: `${base}.zip`, mime: MIME.zip, data: zipFiles(files), messages: flat.length, capped: b.truncated };
  }
  return { filename: `${base}.${ext}`, mime: MIME[ext], data: await make(ext), messages: flat.length, capped: b.truncated };
}
