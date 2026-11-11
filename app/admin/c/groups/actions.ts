'use server';
// Admin → Groups. Every group (interest, city, Open house, facilitators): create, edit, who can join and how many,
// members, chat, notices, archive, merge and delete, plus members' group requests.
// Levels on the 'groups' area:  view = read · edit = create, edit, members, chat, notices, archive, requests
//                               full = merge or delete a group
import { nudgeChat } from '@/lib/rx/live';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { auditAdmin } from '@/lib/admin/audit';
import { clean, fail, findPeople, needId, people, staffAt, type Person, type R } from '@/lib/admin/community-admin';
import { DIMENSIONS } from '@/lib/rx/constants';
import { rxNotify } from '@/lib/rx/notifications';

const AREA = 'groups';
const at = (need: 'view' | 'edit' | 'full') => staffAt(AREA, need, 'Groups');
const done = () => { revalidatePath('/admin/c/groups'); revalidatePath('/community/groups'); revalidatePath('/community'); };
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60);

interface GroupDb {
  id: string; slug: string; name: string; description: string | null; dimension: string | null; fit: string[]; prompt: string | null;
  is_general: boolean; is_city: boolean; is_facilitators: boolean; is_new: boolean; status: 'active' | 'archived'; created_by: string | null; created_at: string;
  join_mode?: 'open' | 'closed'; max_members?: number | null;
}
const BASE = 'id, slug, name, description, dimension, fit, prompt, is_general, is_city, is_facilitators, is_new, status, created_by, created_at';

/** Reads groups with the access columns when the 20261111 migration is in, without them before. */
async function readGroups(opts: { id?: string; limit?: number } = {}): Promise<{ rows: GroupDb[]; access: boolean }> {
  const query = (cols: string) => {
    let q = supabaseAdmin.from('rx_groups').select(cols).order('created_at');
    if (opts.id) q = q.eq('id', opts.id);
    if (opts.limit) q = q.limit(opts.limit);
    return q;
  };
  const a = await query(`${BASE}, join_mode, max_members`);
  if (!a.error) return { rows: (a.data ?? []) as unknown as GroupDb[], access: true };
  if (!/join_mode|max_members|column/i.test(a.error.message)) throw new Error(a.error.message);
  const b2 = await query(BASE);
  if (b2.error) throw new Error(b2.error.message);
  return { rows: (b2.data ?? []) as unknown as GroupDb[], access: false };
}

async function getGroup(id: string): Promise<GroupDb & { access: boolean }> {
  needId(id, 'group');
  const { rows, access } = await readGroups({ id });
  if (!rows[0]) throw new Error('That group wasn’t found.');
  return { ...rows[0], access };
}

const kindOf = (g: GroupDb) => (g.is_general ? 'general' : g.is_city ? 'city' : g.is_facilitators ? 'facilitators' : 'interest') as GroupKind;
export type GroupKind = 'interest' | 'city' | 'general' | 'facilitators';

// ── list ────────────────────────────────────────────────────────────────────
export interface GroupRow {
  id: string; slug: string; name: string; description: string | null; dimension: string | null; kind: GroupKind; status: 'active' | 'archived';
  is_new: boolean; join_mode: 'open' | 'closed'; max_members: number | null; members: number; messages30: number; lastMessage: string | null; created_at: string;
}
export interface RequestRow { id: string; text: string; created_at: string; who: Person | null }
export interface GroupsOverview { groups: GroupRow[]; requests: RequestRow[]; accessReady: boolean }

export async function loadGroups(): Promise<R<{ overview: GroupsOverview }>> {
  try {
    await at('view');
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [{ rows, access }, { data: mem }, { data: msgs }, { data: reqs }] = await Promise.all([
      readGroups(),
      supabaseAdmin.from('rx_group_members').select('group_id').limit(200000),
      supabaseAdmin.from('rx_group_messages').select('group_id, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(50000),
      supabaseAdmin.from('rx_group_requests').select('id, user_id, text, created_at').order('created_at', { ascending: false }).limit(300),
    ]);
    const members = new Map<string, number>();
    for (const m of (mem ?? []) as { group_id: string }[]) members.set(m.group_id, (members.get(m.group_id) ?? 0) + 1);
    const recent = new Map<string, number>(); const last = new Map<string, string>();
    for (const m of (msgs ?? []) as { group_id: string; created_at: string }[]) {
      recent.set(m.group_id, (recent.get(m.group_id) ?? 0) + 1);
      if (!last.has(m.group_id)) last.set(m.group_id, m.created_at);
    }
    const reqRows = (reqs ?? []) as { id: string; user_id: string; text: string; created_at: string }[];
    const ppl = await people(reqRows.map((r) => r.user_id));
    return {
      ok: true,
      overview: {
        accessReady: access,
        groups: rows.map((g) => ({
          id: g.id, slug: g.slug, name: g.name, description: g.description, dimension: g.dimension, kind: kindOf(g), status: g.status, is_new: g.is_new,
          join_mode: g.join_mode ?? 'open', max_members: g.max_members ?? null, members: members.get(g.id) ?? 0,
          messages30: recent.get(g.id) ?? 0, lastMessage: last.get(g.id) ?? null, created_at: g.created_at,
        })),
        requests: reqRows.map((r) => ({ id: r.id, text: r.text, created_at: r.created_at, who: ppl.get(r.user_id) ?? null })),
      },
    };
  } catch (e) { return fail(e, 'We couldn’t load groups.'); }
}

// ── one group ───────────────────────────────────────────────────────────────
export interface GroupMember extends Person { joined_at: string }
export interface GroupMessage { id: string; author: string; user_id: string | null; body: string; created_at: string }
export interface GroupDetail { group: GroupDb & { kind: GroupKind; join_mode: 'open' | 'closed'; max_members: number | null }; accessReady: boolean; members: GroupMember[]; messages: GroupMessage[] }

export async function loadGroup(id: string): Promise<R<{ detail: GroupDetail }>> {
  try {
    await at('view');
    const g = await getGroup(id);
    const [{ data: mem }, { data: msgs }] = await Promise.all([
      supabaseAdmin.from('rx_group_members').select('user_id, joined_at').eq('group_id', id).order('joined_at', { ascending: false }).limit(2000),
      supabaseAdmin.from('rx_group_messages').select('id, user_id, body, created_at').eq('group_id', id).order('created_at', { ascending: false }).limit(100),
    ]);
    const memRows = (mem ?? []) as { user_id: string; joined_at: string }[];
    const msgRows = (msgs ?? []) as { id: string; user_id: string | null; body: string; created_at: string }[];
    const ppl = await people([...memRows.map((m) => m.user_id), ...msgRows.map((m) => m.user_id)]);
    const { access, ...row } = g;
    return {
      ok: true,
      detail: {
        group: { ...row, kind: kindOf(g), join_mode: g.join_mode ?? 'open', max_members: g.max_members ?? null },
        accessReady: access,
        members: memRows.map((m) => ({ ...(ppl.get(m.user_id) ?? { id: m.user_id, name: 'Member', email: null, avatar: null }), joined_at: m.joined_at })),
        messages: msgRows.map((m) => ({ ...m, author: m.user_id ? ppl.get(m.user_id)?.name ?? 'Member' : 'Ascentor team' })),
      },
    };
  } catch (e) { return fail(e, 'We couldn’t load that group.'); }
}

export async function searchMembers(q: string): Promise<R<{ people: Person[] }>> {
  try { await at('edit'); return { ok: true, people: await findPeople(q) }; } catch (e) { return fail(e, 'Search failed.'); }
}

// ── create and edit ─────────────────────────────────────────────────────────
export interface GroupInput {
  name?: string; slug?: string; description?: string | null; dimension?: string | null; fit?: string[]; prompt?: string | null;
  is_new?: boolean; join_mode?: 'open' | 'closed'; max_members?: number | null;
}

async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const root = slugify(base) || 'group';
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    let q = supabaseAdmin.from('rx_groups').select('id').eq('slug', slug);
    if (exceptId) q = q.neq('id', exceptId);
    const { data } = await q.maybeSingle();
    if (!data) return slug;
  }
  return `${root}-${Math.random().toString(36).slice(2, 6)}`;
}

function patchFrom(input: GroupInput, accessReady: boolean): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (input.name !== undefined) { const n = clean(input.name, 60); if (!n) throw new Error('Give the group a name.'); p.name = n; }
  if (input.description !== undefined) p.description = clean(input.description, 240) || null;
  if (input.dimension !== undefined) { const d = clean(input.dimension, 30) || null; if (d && !(DIMENSIONS as string[]).includes(d)) throw new Error('Choose one of the six dimensions.'); p.dimension = d; }
  if (input.fit !== undefined) p.fit = [...new Set((input.fit ?? []).map((f) => clean(f, 60)).filter(Boolean))].slice(0, 20);
  if (input.prompt !== undefined) p.prompt = clean(input.prompt, 300) || null;
  if (input.is_new !== undefined) p.is_new = !!input.is_new;
  if (input.join_mode !== undefined || input.max_members !== undefined) {
    if (!accessReady) throw new Error('Run the 20261111_group_access.sql migration in Supabase to set who can join and a size limit.');
    if (input.join_mode !== undefined) p.join_mode = input.join_mode === 'closed' ? 'closed' : 'open';
    if (input.max_members !== undefined) {
      const m = input.max_members == null || (input.max_members as unknown) === '' ? null : Number(input.max_members);
      if (m != null && !(Number.isInteger(m) && m > 0 && m <= 100000)) throw new Error('The size limit must be a whole number above 0, or empty for no limit.');
      p.max_members = m;
    }
  }
  return p;
}

export async function createGroup(input: GroupInput): Promise<R<{ id: string }>> {
  try {
    const staff = await at('edit');
    const { access } = await readGroups({ limit: 1 });
    const wantsAccess = (input.join_mode && input.join_mode !== 'open') || input.max_members != null;
    const p = patchFrom(wantsAccess ? input : { ...input, join_mode: undefined, max_members: undefined }, access);
    if (!p.name) throw new Error('Give the group a name.');
    const slug = await uniqueSlug(clean(input.slug, 60) || (p.name as string));
    const { data, error } = await supabaseAdmin.from('rx_groups').insert({
      ...p, slug, is_new: input.is_new ?? true, dimension: p.dimension ?? 'Community', created_by: staff.userId,
      prompt: p.prompt ?? 'Introduce yourself and what you hope to get from this group.',
    }).select('id').single();
    if (error) throw error;
    await auditAdmin(staff, 'Created a group', p.name as string, AREA);
    done();
    return { ok: true, id: data.id as string };
  } catch (e) { return fail(e, 'We couldn’t create that group.'); }
}

export async function updateGroup(id: string, input: GroupInput): Promise<R> {
  try {
    const staff = await at('edit');
    const g = await getGroup(id);
    const p = patchFrom(input, g.access);
    if (input.slug !== undefined) {
      const s = slugify(clean(input.slug, 60));
      if (!s) throw new Error('The web address can use letters, numbers and dashes.');
      if (s !== g.slug) {
        if (g.is_general) throw new Error('Open house’s web address is fixed.');
        if (g.is_city) throw new Error('City groups’ web addresses are fixed (they follow the city name).');
        const { data: clash } = await supabaseAdmin.from('rx_groups').select('id').eq('slug', s).neq('id', id).maybeSingle();
        if (clash) throw new Error('Another group already uses that web address.');
        p.slug = s;
      }
    }
    if (!Object.keys(p).length) return { ok: true };
    const { error } = await supabaseAdmin.from('rx_groups').update(p).eq('id', id);
    if (error) throw error;
    await auditAdmin(staff, 'Edited a group', `${g.name}: ${Object.keys(p).join(', ')}`, AREA);
    done();
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t save those changes.'); }
}

async function tell(groupId: string, title: string, body: string, url: string, except: string[] = []) {
  const { data } = await supabaseAdmin.from('rx_group_members').select('user_id').eq('group_id', groupId).limit(100000);
  const ids = ((data ?? []) as { user_id: string }[]).map((m) => m.user_id).filter((u) => !except.includes(u));
  if (ids.length) await rxNotify(ids, { kind: 'group_notice', entityId: groupId, url, title, body });
  return ids.length;
}

export async function setGroupArchived(id: string, archived: boolean, opts: { notify?: boolean } = {}): Promise<R> {
  try {
    const staff = await at('edit');
    const g = await getGroup(id);
    if (archived && (g.is_general || g.is_facilitators)) throw new Error(`${g.name} is built in and can’t be archived.`);
    const { error } = await supabaseAdmin.from('rx_groups').update({ status: archived ? 'archived' : 'active' }).eq('id', id);
    if (error) throw error;
    if (archived && opts.notify !== false) await tell(id, `${g.name} has been archived`, 'The group is closed. Your messages are kept. Browse Groups to find an active one.', '/community/groups');
    await auditAdmin(staff, archived ? 'Archived a group' : 'Restored a group', g.name, AREA);
    done();
    return { ok: true };
  } catch (e) { return fail(e); }
}

/** Adds every member of one group to another, then archives the first. Members are told. */
export async function mergeGroup(fromId: string, intoId: string): Promise<R<{ moved: number }>> {
  try {
    const staff = await at('full');
    if (fromId === intoId) throw new Error('Choose a different group to merge into.');
    const [from, into] = await Promise.all([getGroup(fromId), getGroup(intoId)]);
    if (from.is_general || from.is_facilitators) throw new Error(`${from.name} is built in and can’t be merged away.`);
    if (into.status !== 'active') throw new Error(`${into.name} is archived. Restore it first.`);
    if (into.is_facilitators) throw new Error('Members can’t be merged into the facilitators group.');
    const [{ data: fm }, { data: im }] = await Promise.all([
      supabaseAdmin.from('rx_group_members').select('user_id').eq('group_id', fromId).limit(100000),
      supabaseAdmin.from('rx_group_members').select('user_id').eq('group_id', intoId).limit(100000),
    ]);
    const have = new Set(((im ?? []) as { user_id: string }[]).map((m) => m.user_id));
    const moving = ((fm ?? []) as { user_id: string }[]).map((m) => m.user_id).filter((u) => !have.has(u));
    for (let i = 0; i < moving.length; i += 500) {
      const { error } = await supabaseAdmin.from('rx_group_members').upsert(moving.slice(i, i + 500).map((u) => ({ group_id: intoId, user_id: u })), { onConflict: 'group_id,user_id', ignoreDuplicates: true });
      if (error) throw error;
    }
    await tell(fromId, `${from.name} is now part of ${into.name}`, `We merged the two groups. You’re now a member of ${into.name}.`, `/community/groups/${into.slug}`);
    const { error } = await supabaseAdmin.from('rx_groups').update({ status: 'archived' }).eq('id', fromId);
    if (error) throw error;
    await auditAdmin(staff, 'Merged groups', `${from.name} → ${into.name} (${moving.length} added)`, AREA);
    done();
    return { ok: true, moved: moving.length };
  } catch (e) { return fail(e, 'We couldn’t merge those groups.'); }
}

export async function deleteGroup(id: string, confirmName: string): Promise<R> {
  try {
    const staff = await at('full');
    const g = await getGroup(id);
    if (g.is_general || g.is_facilitators) throw new Error(`${g.name} is built in and can’t be deleted.`);
    if (clean(confirmName, 80).toLowerCase() !== g.name.toLowerCase()) throw new Error(`Type the group’s name (${g.name}) to confirm.`);
    const { error } = await supabaseAdmin.from('rx_groups').delete().eq('id', id);
    if (error) throw error;
    await auditAdmin(staff, 'Deleted a group', g.name, AREA);
    done();
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t delete that group.'); }
}

// ── members ─────────────────────────────────────────────────────────────────
export async function addGroupMember(groupId: string, userId: string, opts: { force?: boolean; notify?: boolean } = {}): Promise<R> {
  try {
    const staff = await at('edit');
    const g = await getGroup(groupId);
    needId(userId, 'member');
    const { data: there } = await supabaseAdmin.from('rx_group_members').select('user_id').eq('group_id', groupId).eq('user_id', userId).maybeSingle();
    if (there) throw new Error('They’re already in this group.');
    if (!opts.force && g.max_members) {
      const { count } = await supabaseAdmin.from('rx_group_members').select('user_id', { count: 'exact', head: true }).eq('group_id', groupId);
      if ((count ?? 0) >= g.max_members) throw new Error(`FULL:${g.name} is at its limit of ${g.max_members} members.`);
    }
    const { error } = await supabaseAdmin.from('rx_group_members').insert({ group_id: groupId, user_id: userId });
    if (error) throw error;
    if (g.is_facilitators) await supabaseAdmin.from('member_profile').upsert({ user_id: userId, is_facilitator: true, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (opts.notify !== false) await rxNotify(userId, { kind: 'group_notice', entityId: groupId, url: `/community/groups/${g.slug}`, title: `You’ve been added to ${g.name}`, body: g.prompt || 'Say hello in the group chat.' });
    const p = (await people([userId])).get(userId);
    await auditAdmin(staff, 'Added a group member', `${p?.name ?? userId} → ${g.name}`, AREA);
    done();
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t add them.'); }
}

export async function removeGroupMember(groupId: string, userId: string): Promise<R> {
  try {
    const staff = await at('edit');
    const g = await getGroup(groupId);
    needId(userId, 'member');
    const { error } = await supabaseAdmin.from('rx_group_members').delete().eq('group_id', groupId).eq('user_id', userId);
    if (error) throw error;
    const p = (await people([userId])).get(userId);
    await auditAdmin(staff, 'Removed a group member', `${p?.name ?? userId} from ${g.name}`, AREA);
    done();
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t remove them.'); }
}

// ── chat, notices, requests ─────────────────────────────────────────────────
export async function deleteGroupMessage(messageId: string): Promise<R> {
  try {
    const staff = await at('edit');
    needId(messageId, 'message');
    const { data, error } = await supabaseAdmin.from('rx_group_messages').delete().eq('id', messageId).select('body').maybeSingle();
    if (error) throw error;
    await auditAdmin(staff, 'Deleted a group message', clean(data?.body, 80), AREA);
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function postGroupMessage(groupId: string, body: string): Promise<R> {
  try {
    const staff = await at('edit');
    const g = await getGroup(groupId);
    const text = clean(body, 2000);
    if (!text) throw new Error('Write a message first.');
    const { error } = await supabaseAdmin.from('rx_group_messages').insert({ group_id: groupId, user_id: null, body: text });
    if (error) throw error;
    nudgeChat('rx_group_messages', groupId);
    await auditAdmin(staff, 'Posted in a group as the team', g.name, AREA);
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t post that.'); }
}

export async function notifyGroup(groupId: string, title: string, body: string): Promise<R<{ sent: number }>> {
  try {
    const staff = await at('edit');
    const g = await getGroup(groupId);
    const t = clean(title, 120); const b = clean(body, 1000);
    if (!t || !b) throw new Error('Add a title and a message.');
    const sent = await tell(groupId, t, b, `/community/groups/${g.slug}`);
    await auditAdmin(staff, 'Sent a notice to a group', `${g.name}: ${t}`, AREA);
    return { ok: true, sent };
  } catch (e) { return fail(e, 'We couldn’t send that notice.'); }
}

export async function dismissRequest(requestId: string): Promise<R> {
  try {
    const staff = await at('edit');
    needId(requestId, 'request');
    const { data, error } = await supabaseAdmin.from('rx_group_requests').delete().eq('id', requestId).select('text').maybeSingle();
    if (error) throw error;
    await auditAdmin(staff, 'Dismissed a group request', clean(data?.text, 80), AREA);
    return { ok: true };
  } catch (e) { return fail(e); }
}
