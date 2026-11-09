'use server';
// Admin → Circles. Everything about a Circle: its settings, members, facilitator, lifecycle, chat, mentor sessions and
// messages from the team, plus members waiting for a Circle and the 48-hour formation run.
// Levels on the 'circles' area:  view = read · edit = change settings, members, chat, sessions, send notices
//                                full = merge or delete a Circle
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { auditAdmin } from '@/lib/admin/audit';
import { clean, fail, findPeople, needId, people, staffAt, type Person, type R } from '@/lib/admin/community-admin';
import { CIRCLE_MAX, LANGUAGES } from '@/lib/rx/constants';
import { circleTitle } from '@/lib/rx/circles';
import { cycleWeek, localISODate, DEFAULT_TZ } from '@/lib/rx/dates';
import { assignCircle } from '@/lib/rx/server';
import { circleAudience, rxNotify } from '@/lib/rx/notifications';
import { formCircles } from '@/lib/rx/formation';

const AREA = 'circles';
const WHAT = 'Circles';
const at = (need: 'view' | 'edit' | 'full') => staffAt(AREA, need, WHAT);
const STAGES = ['Seeking', 'Building', 'Leading'];
const STATUSES = ['forming', 'active', 'completed'] as const;
type Status = (typeof STATUSES)[number];
const today = () => localISODate(DEFAULT_TZ);
const done = () => { revalidatePath('/admin/c/circles'); revalidatePath('/circle'); };

interface CircleDb {
  id: string; name: string; number: number; status: Status; interest: string | null; is_demo: boolean; facilitator_id: string | null;
  timezone: string | null; language: string | null; stage: string | null; slot: string | null; cycle_start: string | null;
  meeting_dow: number; meeting_time: string; meeting_url: string | null; focus: string | null; health_override: string | null;
  merged_into: string | null; created_at: string;
}
const COLS = 'id, name, number, status, interest, is_demo, facilitator_id, timezone, language, stage, slot, cycle_start, meeting_dow, meeting_time, meeting_url, focus, health_override, merged_into, created_at';
const COLS_NO_MERGE = COLS.replace(', merged_into', '');

/** Select from circles with COLS. If the database hasn't had the 20261110_circle_formation migration yet (no merged_into
 *  column, Postgres error 42703), retry without it so the admin screens still open; merged_into then reads as null. */
async function selectCircles<T>(build: (cols: string) => PromiseLike<{ data: T | null; error: { code?: string } | null }>): Promise<{ data: T | null; error: unknown }> {
  const first = await build(COLS);
  if (first.error?.code !== '42703') return first;
  return build(COLS_NO_MERGE);
}

// ── list ────────────────────────────────────────────────────────────────────
export interface CircleRow {
  id: string; title: string; name: string; number: number; status: Status; kind: 'home' | 'interest' | 'demo'; interest: string | null;
  language: string | null; stage: string | null; timezone: string | null; meeting_dow: number; meeting_time: string;
  members: number; facilitator: string | null; week: number | null; cycle_start: string | null; created_at: string; merged_into: string | null;
  ageHours: number;
}
export interface CirclesOverview { circles: CircleRow[]; waiting: number; seated: number }

async function waitingIds(): Promise<{ user_id: string; onboarded_at: string }[]> {
  const [{ data: seats }, { data: mps, error }] = await Promise.all([
    supabaseAdmin.from('circle_seats').select('user_id').eq('role', 'member').limit(100000),
    supabaseAdmin.from('member_profile').select('user_id, onboarded_at').not('onboarded_at', 'is', null).eq('is_demo', false).order('onboarded_at').limit(100000),
  ]);
  if (error) throw error;
  const seated = new Set(((seats ?? []) as { user_id: string }[]).map((s) => s.user_id));
  return ((mps ?? []) as { user_id: string; onboarded_at: string }[]).filter((m) => !seated.has(m.user_id));
}

export async function loadCircles(): Promise<R<{ overview: CirclesOverview }>> {
  try {
    await at('view');
    const [{ data: cs, error }, { data: seats }, waiting] = await Promise.all([
      selectCircles((cols) => supabaseAdmin.from('circles').select(cols).order('number', { ascending: false }).limit(2000)),
      supabaseAdmin.from('circle_seats').select('circle_id, user_id, role').limit(100000),
      waitingIds(),
    ]);
    if (error) throw error;
    const circles = (cs ?? []) as unknown as CircleDb[];
    const count = new Map<string, number>();
    const seatedUsers = new Set<string>();
    for (const s of (seats ?? []) as { circle_id: string; user_id: string; role: string }[]) {
      if (s.role !== 'member') continue;
      count.set(s.circle_id, (count.get(s.circle_id) ?? 0) + 1);
      seatedUsers.add(s.user_id);
    }
    const names = await people(circles.map((c) => c.facilitator_id));
    const t = today();
    return {
      ok: true,
      overview: {
        waiting: waiting.length,
        seated: seatedUsers.size,
        circles: circles.map((c) => ({
          id: c.id, title: circleTitle(c), name: c.name, number: c.number, status: c.status,
          kind: c.is_demo ? 'demo' : c.interest ? 'interest' : 'home', interest: c.interest,
          language: c.language, stage: c.stage, timezone: c.timezone, meeting_dow: c.meeting_dow, meeting_time: c.meeting_time,
          members: count.get(c.id) ?? 0, facilitator: c.facilitator_id ? names.get(c.facilitator_id)?.name ?? 'Member' : null,
          week: c.status === 'active' ? cycleWeek(c.cycle_start, t) : null, cycle_start: c.cycle_start, created_at: c.created_at,
          merged_into: c.merged_into ?? null, ageHours: Math.floor((Date.now() - new Date(c.created_at).getTime()) / 3600000),
        })),
      },
    };
  } catch (e) { return fail(e, 'We couldn’t load Circles.'); }
}

// ── one Circle ──────────────────────────────────────────────────────────────
export interface SeatRow extends Person { role: 'member' | 'facilitator'; joined_at: string; otherCircles: number }
export interface MessageRow { id: string; author: string; user_id: string | null; kind: string; body: string; pinned: boolean; is_win: boolean; created_at: string }
export interface SessionRow { id: string; starts_at: string; status: string; cancel_reason: string | null; mentor: string; agenda_sent_at: string | null; questions: number }
export interface CircleDetail {
  circle: CircleDb & { title: string };
  seats: SeatRow[];
  messages: MessageRow[];
  sessions: SessionRow[];
  mentor: { name: string; status: string } | null;
  mergedFrom: { id: string; title: string }[];
}

export async function loadCircle(id: string): Promise<R<{ detail: CircleDetail }>> {
  try {
    await at('view');
    needId(id, 'Circle');
    const { data: c, error } = await selectCircles((cols) => supabaseAdmin.from('circles').select(cols).eq('id', id).maybeSingle());
    if (error) throw error;
    if (!c) throw new Error('That Circle wasn’t found. It may have been deleted.');
    const circle = { merged_into: null, ...(c as object) } as CircleDb;
    const [{ data: seats }, { data: msgs }, { data: sess }, { data: cm }, { data: from }] = await Promise.all([
      supabaseAdmin.from('circle_seats').select('user_id, role, joined_at').eq('circle_id', id).order('joined_at'),
      supabaseAdmin.from('circle_messages').select('id, user_id, kind, body, pinned, is_win, created_at').eq('circle_id', id).order('created_at', { ascending: false }).limit(80),
      supabaseAdmin.from('circle_mentor_sessions').select('id, mentor_id, starts_at, status, cancel_reason, agenda_sent_at').eq('circle_id', id).order('starts_at', { ascending: false }).limit(40),
      supabaseAdmin.from('circle_mentors').select('mentor_id, status').eq('circle_id', id).in('status', ['requested', 'scheduling', 'active', 'paused']).maybeSingle(),
      supabaseAdmin.from('circles').select('id, name, number, interest').eq('merged_into', id),
    ]);
    const seatRows = (seats ?? []) as { user_id: string; role: 'member' | 'facilitator'; joined_at: string }[];
    const msgRows = (msgs ?? []) as { id: string; user_id: string | null; kind: string; body: string; pinned: boolean; is_win: boolean; created_at: string }[];
    const sessRows = (sess ?? []) as { id: string; mentor_id: string; starts_at: string; status: string; cancel_reason: string | null; agenda_sent_at: string | null }[];
    const ppl = await people([...seatRows.map((s) => s.user_id), ...msgRows.map((m) => m.user_id)]);

    const mentorIds = [...new Set([...sessRows.map((s) => s.mentor_id), ...(cm?.mentor_id ? [cm.mentor_id as string] : [])])];
    const sessIds = sessRows.map((s) => s.id);
    const [{ data: mentors }, { data: qs }, { data: others }] = await Promise.all([
      mentorIds.length ? supabaseAdmin.from('human_mentors').select('id, name').in('id', mentorIds) : Promise.resolve({ data: [] }),
      sessIds.length ? supabaseAdmin.from('mentor_questions').select('session_id').in('session_id', sessIds) : Promise.resolve({ data: [] }),
      seatRows.length ? supabaseAdmin.from('circle_seats').select('user_id, circle_id').in('user_id', seatRows.map((s) => s.user_id)).neq('circle_id', id) : Promise.resolve({ data: [] }),
    ]);
    const mentorName = new Map(((mentors ?? []) as { id: string; name: string }[]).map((m) => [m.id, m.name]));
    const qCount = new Map<string, number>();
    for (const q of (qs ?? []) as { session_id: string }[]) qCount.set(q.session_id, (qCount.get(q.session_id) ?? 0) + 1);
    const otherCount = new Map<string, number>();
    for (const o of (others ?? []) as { user_id: string }[]) otherCount.set(o.user_id, (otherCount.get(o.user_id) ?? 0) + 1);

    return {
      ok: true,
      detail: {
        circle: { ...circle, title: circleTitle(circle) },
        seats: seatRows.map((s) => ({ ...(ppl.get(s.user_id) ?? { id: s.user_id, name: 'Member', email: null, avatar: null }), role: s.role, joined_at: s.joined_at, otherCircles: otherCount.get(s.user_id) ?? 0 })),
        messages: msgRows.map((m) => ({ ...m, author: m.user_id ? ppl.get(m.user_id)?.name ?? 'Member' : 'Ascentor team' })),
        sessions: sessRows.map((s) => ({ id: s.id, starts_at: s.starts_at, status: s.status, cancel_reason: s.cancel_reason, agenda_sent_at: s.agenda_sent_at, mentor: mentorName.get(s.mentor_id) ?? 'Mentor', questions: qCount.get(s.id) ?? 0 })),
        mentor: cm ? { name: mentorName.get(cm.mentor_id as string) ?? 'Mentor', status: cm.status as string } : null,
        mergedFrom: ((from ?? []) as { id: string; name: string; number: number; interest: string | null }[]).map((f) => ({ id: f.id, title: circleTitle(f) })),
      },
    };
  } catch (e) { return fail(e, 'We couldn’t load that Circle.'); }
}

export async function searchMembers(q: string): Promise<R<{ people: Person[] }>> {
  try { await at('edit'); return { ok: true, people: await findPeople(q) }; } catch (e) { return fail(e, 'Search failed.'); }
}

// ── create and edit ─────────────────────────────────────────────────────────
export interface CircleInput {
  name?: string; interest?: string | null; language?: string | null; timezone?: string | null; stage?: string | null; slot?: string | null;
  meeting_dow?: number; meeting_time?: string; meeting_url?: string | null; focus?: string | null; cycle_start?: string | null;
  is_demo?: boolean; health_override?: string | null;
}

function patchFrom(input: CircleInput): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (input.name !== undefined) { const n = clean(input.name, 60); if (!n) throw new Error('Give the Circle a name.'); p.name = n; }
  if (input.interest !== undefined) p.interest = clean(input.interest, 60) || null;
  if (input.language !== undefined) { const l = clean(input.language, 40) || null; if (l && !LANGUAGES.includes(l)) throw new Error('Choose one of the listed languages.'); p.language = l; }
  if (input.timezone !== undefined) {
    const tz = clean(input.timezone, 60) || null;
    if (tz) { try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch { throw new Error('That time zone isn’t recognised. Use a name like Africa/Lagos.'); } }
    p.timezone = tz;
  }
  if (input.stage !== undefined) { const s = clean(input.stage, 20) || null; if (s && !STAGES.includes(s)) throw new Error('Stage must be Seeking, Building or Leading.'); p.stage = s; }
  if (input.slot !== undefined) p.slot = clean(input.slot, 40) || null;
  if (input.meeting_dow !== undefined) { const d = Number(input.meeting_dow); if (!(Number.isInteger(d) && d >= 0 && d <= 6)) throw new Error('Choose a weekday.'); p.meeting_dow = d; }
  if (input.meeting_time !== undefined) { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.meeting_time)) throw new Error('Enter the meeting time as HH:MM.'); p.meeting_time = input.meeting_time; }
  if (input.meeting_url !== undefined) { const u = clean(input.meeting_url, 400) || null; if (u && !/^https:\/\//i.test(u)) throw new Error('The meeting link must start with https://'); p.meeting_url = u; }
  if (input.focus !== undefined) p.focus = clean(input.focus, 300) || null;
  if (input.cycle_start !== undefined) { const d = input.cycle_start || null; if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('Enter the cycle start as a date.'); p.cycle_start = d; }
  if (input.is_demo !== undefined) p.is_demo = !!input.is_demo;
  if (input.health_override !== undefined) p.health_override = input.health_override === 'healthy' ? 'healthy' : null;
  return p;
}

export async function createCircle(input: CircleInput): Promise<R<{ id: string }>> {
  try {
    const staff = await at('edit');
    const p = patchFrom({ ...input, name: input.name?.trim() ? input.name : 'x' });
    if (!input.name?.trim()) {
      const { data: peak } = await supabaseAdmin.rpc('rx_next_circle_name');
      p.name = (typeof peak === 'string' && peak) || 'New Circle';
    }
    const { data: mx } = await supabaseAdmin.from('circles').select('number').order('number', { ascending: false }).limit(1).maybeSingle();
    const number = ((mx?.number as number | undefined) ?? 0) + 1;
    const { data, error } = await supabaseAdmin.from('circles').insert({ ...p, number, status: 'forming', language: p.language ?? 'English', timezone: p.timezone ?? DEFAULT_TZ }).select('id').single();
    if (error) throw error;
    await auditAdmin(staff, 'Created a Circle', `${p.name as string} · Circle ${number}`, AREA);
    done();
    return { ok: true, id: data.id as string };
  } catch (e) { return fail(e, 'We couldn’t create that Circle.'); }
}

export async function updateCircle(id: string, input: CircleInput): Promise<R> {
  try {
    const staff = await at('edit');
    needId(id, 'Circle');
    const p = patchFrom(input);
    if (!Object.keys(p).length) return { ok: true };
    const { data, error } = await supabaseAdmin.from('circles').update(p).eq('id', id).select('name, number, interest').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('That Circle wasn’t found.');
    await auditAdmin(staff, 'Edited a Circle', `${circleTitle(data as { name: string; number: number; interest: string | null })}: ${Object.keys(p).join(', ')}`, AREA);
    done();
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t save those changes.'); }
}

async function getCircle(id: string): Promise<CircleDb> {
  needId(id, 'Circle');
  const { data } = await selectCircles((cols) => supabaseAdmin.from('circles').select(cols).eq('id', id).maybeSingle());
  if (!data) throw new Error('That Circle wasn’t found.');
  return { merged_into: null, ...(data as object) } as CircleDb;
}

// ── lifecycle ───────────────────────────────────────────────────────────────
/** start: forming → active from today · restart: a fresh 90-day cycle from today · complete: close it · reopen: back to forming */
export async function setCircleLifecycle(id: string, action: 'start' | 'restart' | 'complete' | 'reopen', opts: { notify?: boolean } = {}): Promise<R> {
  try {
    const staff = await at('edit');
    const c = await getCircle(id);
    const title = circleTitle(c);
    let patch: Record<string, unknown>;
    if (action === 'start') { if (c.status === 'active') throw new Error('This Circle has already started.'); patch = { status: 'active', cycle_start: today(), merged_into: null }; }
    else if (action === 'restart') patch = { status: 'active', cycle_start: today(), merged_into: null };
    else if (action === 'complete') { if (c.status === 'completed') throw new Error('This Circle is already closed.'); patch = { status: 'completed' }; }
    else if (action === 'reopen') { if (c.status !== 'completed') throw new Error('Only a closed Circle can be reopened.'); patch = { status: 'forming', merged_into: null }; }
    else throw new Error('Unknown action.');
    const { error } = await supabaseAdmin.from('circles').update(patch).eq('id', id);
    if (error) throw error;
    if (opts.notify !== false && (action === 'start' || action === 'restart')) {
      await rxNotify(await circleAudience(id), {
        kind: 'circle_started', entityId: id, url: `/circle?c=${id}`,
        title: action === 'start' ? `${title} has started` : `${title} is starting a new cycle`,
        body: 'Your 90-day cycle begins today. Weekly calls are open, and you can choose a mentor together.',
      });
    }
    await auditAdmin(staff, { start: 'Started a Circle', restart: 'Restarted a Circle’s cycle', complete: 'Closed a Circle', reopen: 'Reopened a Circle' }[action], title, AREA);
    done();
    return { ok: true };
  } catch (e) { return fail(e); }
}

/** Moves every member into another Circle, then closes this one. Facilitators are not moved. */
export async function mergeCircle(fromId: string, intoId: string, opts: { force?: boolean } = {}): Promise<R<{ moved: number }>> {
  try {
    const staff = await at('full');
    if (fromId === intoId) throw new Error('Choose a different Circle to merge into.');
    const [from, into] = await Promise.all([getCircle(fromId), getCircle(intoId)]);
    if (into.status === 'completed') throw new Error(`${circleTitle(into)} is closed. Reopen it first or choose another Circle.`);
    const [{ data: fs }, { data: ts }] = await Promise.all([
      supabaseAdmin.from('circle_seats').select('user_id').eq('circle_id', fromId).eq('role', 'member'),
      supabaseAdmin.from('circle_seats').select('user_id').eq('circle_id', intoId),
    ]);
    const already = new Set(((ts ?? []) as { user_id: string }[]).map((s) => s.user_id));
    const moving = ((fs ?? []) as { user_id: string }[]).map((s) => s.user_id).filter((u) => !already.has(u));
    const { count: intoMembers } = await supabaseAdmin.from('circle_seats').select('user_id', { count: 'exact', head: true }).eq('circle_id', intoId).eq('role', 'member');
    if (!opts.force && (intoMembers ?? 0) + moving.length > CIRCLE_MAX) {
      throw new Error(`FULL:${circleTitle(into)} would have ${(intoMembers ?? 0) + moving.length} members (the usual limit is ${CIRCLE_MAX}).`);
    }
    if (moving.length) {
      const { error } = await supabaseAdmin.from('circle_seats').insert(moving.map((u) => ({ circle_id: intoId, user_id: u, role: 'member' })));
      if (error) throw error;
    }
    await supabaseAdmin.from('circle_seats').delete().eq('circle_id', fromId).eq('role', 'member');
    const { error } = await supabaseAdmin.from('circles').update({ status: 'completed', merged_into: intoId }).eq('id', fromId);
    if (error) throw error;
    if (moving.length) {
      await rxNotify(moving, { kind: 'circle_moved', entityId: intoId, url: `/circle?c=${intoId}`, title: `You’re now in ${circleTitle(into)}`, body: `${circleTitle(from)} has joined ${circleTitle(into)}. Say hello in the chat.` });
      const others = (await circleAudience(intoId)).filter((u) => !moving.includes(u));
      await rxNotify(others, { kind: 'circle_new_member', entityId: intoId, url: `/circle?c=${intoId}`, title: 'New members joined your Circle', body: `${moving.length} new ${moving.length === 1 ? 'member has' : 'members have'} joined. Welcome them in the chat.` });
    }
    await auditAdmin(staff, 'Merged Circles', `${circleTitle(from)} → ${circleTitle(into)} (${moving.length} moved)`, AREA);
    done();
    return { ok: true, moved: moving.length };
  } catch (e) { return fail(e, 'We couldn’t merge those Circles.'); }
}

/** Deletes a Circle with its chat, sessions and history. Type the Circle's name to confirm. */
export async function deleteCircle(id: string, confirmName: string): Promise<R> {
  try {
    const staff = await at('full');
    const c = await getCircle(id);
    if (clean(confirmName, 80).toLowerCase() !== c.name.toLowerCase()) throw new Error(`Type the Circle’s name (${c.name}) to confirm.`);
    const { error } = await supabaseAdmin.from('circles').delete().eq('id', id);
    if (error) throw error;
    await auditAdmin(staff, 'Deleted a Circle', circleTitle(c), AREA);
    done();
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t delete that Circle.'); }
}

// ── members ─────────────────────────────────────────────────────────────────
async function memberCount(circleId: string) {
  const { count } = await supabaseAdmin.from('circle_seats').select('user_id', { count: 'exact', head: true }).eq('circle_id', circleId).eq('role', 'member');
  return count ?? 0;
}

async function setFacilitatorSeat(circleId: string, userId: string) {
  await supabaseAdmin.from('member_profile').upsert({ user_id: userId, is_facilitator: true, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  // One facilitator per Circle: the previous one stays in the Circle as a member (remove them separately if needed).
  const { data: c } = await supabaseAdmin.from('circles').select('facilitator_id').eq('id', circleId).maybeSingle();
  const prev = (c?.facilitator_id as string | null) ?? null;
  if (prev && prev !== userId) await supabaseAdmin.from('circle_seats').update({ role: 'member' }).eq('circle_id', circleId).eq('user_id', prev).eq('role', 'facilitator');
  await supabaseAdmin.from('circle_seats').update({ role: 'member' }).eq('circle_id', circleId).eq('role', 'facilitator').neq('user_id', userId);
  await supabaseAdmin.from('circle_seats').upsert({ circle_id: circleId, user_id: userId, role: 'facilitator' }, { onConflict: 'circle_id,user_id' });
  const { error } = await supabaseAdmin.from('circles').update({ facilitator_id: userId }).eq('id', circleId);
  if (error) throw error;
}

export async function addCircleMember(circleId: string, userId: string, role: 'member' | 'facilitator', opts: { force?: boolean; notify?: boolean } = {}): Promise<R> {
  try {
    const staff = await at('edit');
    const c = await getCircle(circleId);
    needId(userId, 'member');
    const { data: seat } = await supabaseAdmin.from('circle_seats').select('role').eq('circle_id', circleId).eq('user_id', userId).maybeSingle();
    if (seat) throw new Error(`They’re already in this Circle as ${seat.role === 'facilitator' ? 'the facilitator' : 'a member'}.`);
    if (role === 'facilitator') await setFacilitatorSeat(circleId, userId);
    else {
      if (!opts.force && (await memberCount(circleId)) >= CIRCLE_MAX) throw new Error(`FULL:${circleTitle(c)} already has ${CIRCLE_MAX} members.`);
      const { error } = await supabaseAdmin.from('circle_seats').insert({ circle_id: circleId, user_id: userId, role: 'member' });
      if (error) throw error;
    }
    if (opts.notify !== false) {
      await rxNotify(userId, { kind: 'circle_joined', entityId: circleId, url: `/circle?c=${circleId}`, title: `You’ve joined ${circleTitle(c)}`, body: role === 'facilitator' ? 'The Ascentor team has made you this Circle’s facilitator.' : 'The Ascentor team has added you to this Circle. Say hello in the chat.' });
    }
    const p = (await people([userId])).get(userId);
    await auditAdmin(staff, role === 'facilitator' ? 'Set a Circle facilitator' : 'Added a Circle member', `${p?.name ?? userId} → ${circleTitle(c)}`, AREA);
    done();
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t add them.'); }
}

export async function removeCircleMember(circleId: string, userId: string, opts: { notify?: boolean } = {}): Promise<R> {
  try {
    const staff = await at('edit');
    const c = await getCircle(circleId);
    needId(userId, 'member');
    const { error } = await supabaseAdmin.from('circle_seats').delete().eq('circle_id', circleId).eq('user_id', userId);
    if (error) throw error;
    if (c.facilitator_id === userId) await supabaseAdmin.from('circles').update({ facilitator_id: null }).eq('id', circleId);
    if (opts.notify) await rxNotify(userId, { kind: 'circle_moved', entityId: circleId, url: '/circle', title: `You’ve left ${circleTitle(c)}`, body: 'The Ascentor team has taken you out of this Circle. Message us from Help if you think this is a mistake.' });
    const p = (await people([userId])).get(userId);
    await auditAdmin(staff, 'Removed a Circle member', `${p?.name ?? userId} from ${circleTitle(c)}`, AREA);
    done();
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t remove them.'); }
}

export async function moveCircleMember(fromId: string, userId: string, toId: string, opts: { force?: boolean } = {}): Promise<R> {
  try {
    const staff = await at('edit');
    if (fromId === toId) throw new Error('Choose a different Circle.');
    const [from, to] = await Promise.all([getCircle(fromId), getCircle(toId)]);
    needId(userId, 'member');
    if (to.status === 'completed') throw new Error(`${circleTitle(to)} is closed.`);
    const { data: there } = await supabaseAdmin.from('circle_seats').select('role').eq('circle_id', toId).eq('user_id', userId).maybeSingle();
    if (there) throw new Error(`They’re already in ${circleTitle(to)}.`);
    if (!opts.force && (await memberCount(toId)) >= CIRCLE_MAX) throw new Error(`FULL:${circleTitle(to)} already has ${CIRCLE_MAX} members.`);
    const { error } = await supabaseAdmin.from('circle_seats').insert({ circle_id: toId, user_id: userId, role: 'member' });
    if (error) throw error;
    await supabaseAdmin.from('circle_seats').delete().eq('circle_id', fromId).eq('user_id', userId);
    if (from.facilitator_id === userId) await supabaseAdmin.from('circles').update({ facilitator_id: null }).eq('id', fromId);
    await rxNotify(userId, { kind: 'circle_moved', entityId: toId, url: `/circle?c=${toId}`, title: `You’re now in ${circleTitle(to)}`, body: `The Ascentor team moved you from ${circleTitle(from)}. Say hello in the chat.` });
    const others = (await circleAudience(toId)).filter((u) => u !== userId);
    await rxNotify(others, { kind: 'circle_new_member', entityId: toId, url: `/circle?c=${toId}`, title: 'A new member joined your Circle', body: '1 new member has joined. Welcome them in the chat.' });
    const p = (await people([userId])).get(userId);
    await auditAdmin(staff, 'Moved a Circle member', `${p?.name ?? userId}: ${circleTitle(from)} → ${circleTitle(to)}`, AREA);
    done();
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t move them.'); }
}

export async function setCircleRole(circleId: string, userId: string, role: 'member' | 'facilitator'): Promise<R> {
  try {
    const staff = await at('edit');
    const c = await getCircle(circleId);
    needId(userId, 'member');
    if (role === 'facilitator') await setFacilitatorSeat(circleId, userId);
    else {
      const { error } = await supabaseAdmin.from('circle_seats').update({ role: 'member' }).eq('circle_id', circleId).eq('user_id', userId);
      if (error) throw error;
      if (c.facilitator_id === userId) await supabaseAdmin.from('circles').update({ facilitator_id: null }).eq('id', circleId);
    }
    const p = (await people([userId])).get(userId);
    await auditAdmin(staff, role === 'facilitator' ? 'Set a Circle facilitator' : 'Made a facilitator a member', `${p?.name ?? userId} in ${circleTitle(c)}`, AREA);
    done();
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ── chat, sessions, notices ─────────────────────────────────────────────────
export async function deleteCircleMessage(messageId: string): Promise<R> {
  try {
    const staff = await at('edit');
    needId(messageId, 'message');
    const { data, error } = await supabaseAdmin.from('circle_messages').delete().eq('id', messageId).select('body').maybeSingle();
    if (error) throw error;
    await auditAdmin(staff, 'Deleted a Circle message', clean(data?.body, 80), AREA);
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function pinCircleMessage(messageId: string, on: boolean): Promise<R> {
  try {
    await at('edit');
    needId(messageId, 'message');
    const { error } = await supabaseAdmin.from('circle_messages').update({ pinned: !!on }).eq('id', messageId);
    if (error) throw error;
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function postCircleMessage(circleId: string, body: string): Promise<R> {
  try {
    const staff = await at('edit');
    const c = await getCircle(circleId);
    const text = clean(body, 2000);
    if (!text) throw new Error('Write a message first.');
    const { error } = await supabaseAdmin.from('circle_messages').insert({ circle_id: circleId, user_id: null, kind: 'text', body: text });
    if (error) throw error;
    await auditAdmin(staff, 'Posted in a Circle chat as the team', circleTitle(c), AREA);
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t post that.'); }
}

export async function cancelCircleSession(sessionId: string): Promise<R> {
  try {
    const staff = await at('edit');
    needId(sessionId, 'session');
    const { data: s } = await supabaseAdmin.from('circle_mentor_sessions').select('id, circle_id, mentor_id, starts_at, status').eq('id', sessionId).maybeSingle();
    if (!s) throw new Error('That session wasn’t found.');
    if (s.status !== 'scheduled') throw new Error('Only a scheduled session can be cancelled.');
    const { error } = await supabaseAdmin.from('circle_mentor_sessions').update({ status: 'cancelled', cancel_reason: 'Cancelled by admin' }).eq('id', sessionId).eq('status', 'scheduled');
    if (error) throw error;
    const to = await circleAudience(s.circle_id as string);
    const { data: m } = await supabaseAdmin.from('human_mentors').select('user_id').eq('id', s.mentor_id as string).maybeSingle();
    if (m?.user_id) to.push(m.user_id as string);
    const when = new Date(s.starts_at as string).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' });
    await rxNotify(to, { kind: 'session_moved', entityId: sessionId, url: `/sessions?c=${s.circle_id as string}`, title: `The mentor session ${when} is cancelled`, body: 'The Ascentor team cancelled this session. Your other sessions are unchanged.' });
    const c = await getCircle(s.circle_id as string);
    await auditAdmin(staff, 'Cancelled a mentor session', `${circleTitle(c)} · ${when}`, AREA);
    done();
    return { ok: true };
  } catch (e) { return fail(e); }
}

/** In-app notice (and email, for members who allow Circle emails) from the team to everyone in a Circle. */
export async function notifyCircle(circleId: string, title: string, body: string): Promise<R<{ sent: number }>> {
  try {
    const staff = await at('edit');
    const c = await getCircle(circleId);
    const t = clean(title, 120); const b = clean(body, 1000);
    if (!t || !b) throw new Error('Add a title and a message.');
    const to = await circleAudience(circleId);
    await rxNotify(to, { kind: 'circle_notice', entityId: circleId, url: `/circle?c=${circleId}`, title: t, body: b });
    await auditAdmin(staff, 'Sent a notice to a Circle', `${circleTitle(c)}: ${t}`, AREA);
    return { ok: true, sent: to.length };
  } catch (e) { return fail(e, 'We couldn’t send that notice.'); }
}

// ── waiting members and formation ───────────────────────────────────────────
export interface WaitingRow extends Person { stage: string | null; language: string | null; timezone: string | null; slots: string[]; onboarded_at: string }

export async function loadWaiting(): Promise<R<{ rows: WaitingRow[] }>> {
  try {
    await at('view');
    const ws = (await waitingIds()).slice(0, 300);
    if (!ws.length) return { ok: true, rows: [] };
    const ids = ws.map((w) => w.user_id);
    const [{ data: mps }, ppl] = await Promise.all([
      supabaseAdmin.from('member_profile').select('user_id, stage, language, timezone, slots').in('user_id', ids),
      people(ids),
    ]);
    const mp = new Map(((mps ?? []) as { user_id: string; stage: string | null; language: string | null; timezone: string | null; slots: string[] | null }[]).map((m) => [m.user_id, m]));
    return {
      ok: true,
      rows: ws.map((w) => {
        const m = mp.get(w.user_id);
        return { ...(ppl.get(w.user_id) ?? { id: w.user_id, name: 'Member', email: null, avatar: null }), stage: m?.stage ?? null, language: m?.language ?? null, timezone: m?.timezone ?? null, slots: m?.slots ?? [], onboarded_at: w.onboarded_at };
      }),
    };
  } catch (e) { return fail(e, 'We couldn’t load members waiting for a Circle.'); }
}

/** Places a waiting member: into the Circle chosen, or (no Circle given) the best match, exactly as onboarding does. */
export async function placeWaiting(userId: string, circleId: string | null, opts: { force?: boolean } = {}): Promise<R<{ circle: string }>> {
  try {
    const staff = await at('edit');
    needId(userId, 'member');
    let cid = circleId;
    if (cid) {
      const r = await addCircleMember(cid, userId, 'member', { force: opts.force });
      if (!r.ok) return r;
    } else {
      cid = await assignCircle(userId);
      if (!cid) throw new Error('No Circle has a free seat right now, so a new one couldn’t be opened. Try again in a moment.');
    }
    const c = await getCircle(cid);
    if (!circleId) await auditAdmin(staff, 'Placed a waiting member', `${(await people([userId])).get(userId)?.name ?? userId} → ${circleTitle(c)}`, AREA);
    done();
    return { ok: true, circle: circleTitle(c) };
  } catch (e) { return fail(e, 'We couldn’t place them.'); }
}

export async function placeAllWaiting(): Promise<R<{ placed: number; left: number }>> {
  try {
    const staff = await at('edit');
    const ws = (await waitingIds()).slice(0, 100);
    let placed = 0;
    for (const w of ws) if (await assignCircle(w.user_id)) placed++;
    await auditAdmin(staff, 'Placed waiting members', `${placed} placed`, AREA);
    done();
    return { ok: true, placed, left: (await waitingIds()).length };
  } catch (e) { return fail(e, 'We couldn’t place everyone.'); }
}

/** Runs the 48-hour rule now: Circles still forming after 48 hours are merged into a match or started with 3+. */
export async function runFormationNow(): Promise<R<{ merged: number; started: number; waiting: number }>> {
  try {
    const staff = await at('edit');
    const r = await formCircles();
    await auditAdmin(staff, 'Ran Circle formation', `${r.merged} merged, ${r.started} started, ${r.waiting} still waiting`, AREA);
    done();
    return { ok: true, ...r };
  } catch (e) { return fail(e, 'Formation didn’t run. Check that the 20261110 migration has been applied.'); }
}
