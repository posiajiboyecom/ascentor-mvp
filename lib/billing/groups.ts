// lib/billing/groups.ts
// ─────────────────────────────────────────────────────────────────────────────
// Billing v2 GROUPS (tables billing_groups, billing_group_members). Server-only.
// Rules come from the handoff and live as pure functions in group-rules.ts (join checks, switching, flags, status) and
// rules.ts (a complete group = at least 3 ACTIVE members: trial, paying or in grace; free Leaders excluded).
// What a member can ever learn about a group: its code, link and the ACTIVE COUNT. Never who failed to pay, never anyone's
// payment details, never other members' identities.
//
// Exports
//   groupLink(token)                         -> absolute https link a friend opens
//   createGroup(userId, ctx?)                -> { ok, group, existing } | { ok:false, error }   (idempotent: returns your group if you have one)
//   joinByCode(userId, code, ctx?)           -> JoinResult
//   joinByToken(userId, token, ctx?)         -> JoinResult
//   leaveGroup(userId)                       -> { ok } | { ok:false, error }
//   getGroupStatus(userId)                   -> GroupStatusView   (refreshes billing_groups.status; runs the abuse check)
//   previewGroup({ code } | { token })       -> { found, joinable, message? }   (no member data; for /join/<token> and checkout)
//   refreshGroup(groupId)                    -> { activeCount, status, flagged }   (recomputes status, runs the abuse check)
//   groupCircleHint(userId)                  -> Circle id of the group's earliest-placed active member, or null
//                                               (the access-rules agent wires this into Circle placement)
//   deviceHintFrom(headers)                  -> one-way hash of network + browser (never an IP address), for abuse checks
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';
import { createHash, randomBytes, randomInt } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logBillingEvent } from './events';
import { countActiveMembers, GROUP_MIN, GROUP_MAX, isActiveState, type SubState } from './rules';
import {
  checkJoin, detectGroupFlags, describeStatus, makeGroupCode, nextGroupStatus, normaliseGroupCode, switchLockedUntil,
  type GroupStatus, type MembershipHistoryRow,
} from './group-rules';

const siteUrl = () => process.env.NEXT_PUBLIC_URL || 'https://joinascentor.com';
export const groupLink = (token: string) => `${siteUrl()}/join/${token}`;

interface GroupRow { id: string; code: string; link_token: string; created_by: string | null; status: GroupStatus; flagged: boolean; flag_reason: string | null; created_at: string }
const GROUP_COLS = 'id, code, link_token, created_by, status, flagged, flag_reason, created_at';

export interface JoinContext { device?: string | null }

export interface GroupSummary { id: string; code: string; link: string; token: string }

export type JoinResult =
  | { ok: true; group: GroupSummary; already: boolean }
  | { ok: false; reason: string; error: string; canSwitchAt?: string };

export interface GroupStatusView {
  inGroup: boolean;
  group: GroupSummary | null;
  /** Active members (trial, paying or in grace). The only member data a member ever sees. */
  activeCount: number;
  needed: number;
  status: GroupStatus | null;
  /** True while an admin is reviewing the group; the group price does not apply until it is cleared. */
  underReview: boolean;
  statusText: string;
  /** When this member may switch to another group, or null. */
  canSwitchAt: string | null;
}

/** One-way hash of network + browser, kept only to spot several "friends" on one device. Never stores an IP. */
export function deviceHintFrom(h: { get(name: string): string | null }): string | null {
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || '';
  const ua = h.get('user-agent') ?? '';
  if (!ip && !ua) return null;
  const salt = process.env.APP_SECRET_KEY ? process.env.APP_SECRET_KEY.slice(0, 16) : 'asc';
  return createHash('sha256').update(`${salt}|${ip}|${ua}`).digest('hex').slice(0, 20);
}

const summary = (g: GroupRow): GroupSummary => ({ id: g.id, code: g.code, token: g.link_token, link: groupLink(g.link_token) });

// ── Reads ────────────────────────────────────────────────────────────────────

async function currentMembership(userId: string): Promise<{ groupId: string; joinedAt: Date } | null> {
  const { data } = await supabaseAdmin.from('billing_group_members').select('group_id, joined_at').eq('user_id', userId).is('left_at', null).maybeSingle();
  const r = data as { group_id: string; joined_at: string } | null;
  return r ? { groupId: r.group_id, joinedAt: new Date(r.joined_at) } : null;
}

async function loadGroup(by: { id?: string; code?: string; token?: string }): Promise<GroupRow | null> {
  let q = supabaseAdmin.from('billing_groups').select(GROUP_COLS);
  if (by.id) q = q.eq('id', by.id);
  else if (by.code) q = q.eq('code', by.code);
  else if (by.token) q = q.eq('link_token', by.token);
  else return null;
  const { data } = await q.maybeSingle();
  return (data as GroupRow | null) ?? null;
}

async function memberIds(groupId: string): Promise<string[]> {
  const { data } = await supabaseAdmin.from('billing_group_members').select('user_id').eq('group_id', groupId).is('left_at', null);
  return ((data ?? []) as { user_id: string }[]).map((m) => m.user_id);
}

async function totalRows(groupId: string): Promise<number> {
  const { count } = await supabaseAdmin.from('billing_group_members').select('user_id', { count: 'exact', head: true }).eq('group_id', groupId);
  return count ?? 0;
}

/** The member's past memberships, each with whether anyone else was ever in that group (a group you were alone in is not a switch). */
async function membershipHistory(userId: string): Promise<MembershipHistoryRow[]> {
  const { data } = await supabaseAdmin.from('billing_group_members').select('group_id, joined_at').eq('user_id', userId);
  const mine = (data ?? []) as { group_id: string; joined_at: string }[];
  const out: MembershipHistoryRow[] = [];
  for (const m of mine) {
    const { count } = await supabaseAdmin.from('billing_group_members').select('user_id', { count: 'exact', head: true }).eq('group_id', m.group_id).neq('user_id', userId);
    out.push({ joinedAt: new Date(m.joined_at), hadOthers: (count ?? 0) > 0 });
  }
  return out;
}

/** Active members of a group per rules.ts: trial, paying or in grace; free Leaders excluded; every tier and cycle counts. */
async function activeCountOf(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const [{ data: subs }, { data: profs }] = await Promise.all([
    supabaseAdmin.from('member_subscriptions').select('user_id, state').in('user_id', ids),
    supabaseAdmin.from('profiles').select('id, leader_free').in('id', ids),
  ]);
  const free = new Set(((profs ?? []) as { id: string; leader_free: boolean }[]).filter((p) => p.leader_free).map((p) => p.id));
  return countActiveMembers(((subs ?? []) as { user_id: string; state: SubState }[]).map((s) => ({ state: s.state, leaderFree: free.has(s.user_id) })));
}

// ── Refresh: status + abuse check ────────────────────────────────────────────

export async function refreshGroup(groupId: string): Promise<{ activeCount: number; status: GroupStatus; flagged: boolean } | null> {
  const g = await loadGroup({ id: groupId });
  if (!g) return null;
  const ids = await memberIds(groupId);
  const activeCount = await activeCountOf(ids);
  const status = nextGroupStatus(activeCount, g.status);
  if (status !== g.status) await supabaseAdmin.from('billing_groups').update({ status }).eq('id', groupId);
  const flagged = await runAbuseCheck(g, ids);
  return { activeCount, status, flagged };
}

/**
 * Looks for accounts created within minutes of each other, a card saved by two members, or one device. A NEW finding flags the
 * group (flagged = true, flag_reason set). Findings are remembered by a stable key in billing_events, so when an admin clears a
 * flag the same finding is not raised again; only something new can flag the group again.
 */
async function runAbuseCheck(g: GroupRow, ids: string[]): Promise<boolean> {
  if (ids.length < 2) return g.flagged;
  const [{ data: profs }, { data: cards }, { data: joins }, { data: seen }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, created_at').in('id', ids),
    supabaseAdmin.from('payment_methods').select('user_id, signature').in('user_id', ids).is('removed_at', null),
    supabaseAdmin.from('billing_events').select('user_id, data, created_at').eq('type', 'group_joined').in('user_id', ids).contains('data', { group_id: g.id }).order('created_at', { ascending: true }),
    supabaseAdmin.from('billing_events').select('data').eq('type', 'group_flagged').contains('data', { group_id: g.id }),
  ]);
  const created = new Map(((profs ?? []) as { id: string; created_at: string }[]).map((p) => [p.id, new Date(p.created_at)]));
  const sigs = new Map<string, string[]>();
  for (const c of (cards ?? []) as { user_id: string; signature: string | null }[]) {
    if (c.signature) sigs.set(c.user_id, [...(sigs.get(c.user_id) ?? []), c.signature]);
  }
  const device = new Map<string, string>();
  for (const j of (joins ?? []) as { user_id: string; data: { device?: string | null } }[]) if (j.data?.device) device.set(j.user_id, j.data.device);
  const known = new Set<string>();
  for (const e of (seen ?? []) as { data: { keys?: string[] } }[]) for (const k of e.data?.keys ?? []) known.add(k);

  const findings = detectGroupFlags(ids.filter((id) => created.has(id)).map((id) => ({
    userId: id, createdAt: created.get(id)!, cardSignatures: sigs.get(id) ?? [], device: device.get(id) ?? null,
  }))).filter((f) => !known.has(f.key));
  if (!findings.length) return g.flagged;

  const reason = [...new Set(findings.map((f) => f.reason))].join(' ');
  await supabaseAdmin.from('billing_groups').update({ flagged: true, flag_reason: reason }).eq('id', g.id);
  await logBillingEvent(null, 'group_flagged', { group_id: g.id, keys: findings.map((f) => f.key), reason });
  return true;
}

// ── Create / join / leave ────────────────────────────────────────────────────

async function newGroupRow(userId: string): Promise<GroupRow | null> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeGroupCode((n) => randomInt(n));
    const token = randomBytes(18).toString('base64url');
    const { data, error } = await supabaseAdmin.from('billing_groups').insert({ code, link_token: token, created_by: userId, status: 'forming' }).select(GROUP_COLS).single();
    if (!error && data) return data as GroupRow;
    if (error?.code !== '23505') { console.error('[billing/groups] create failed:', error?.message); return null; }
  }
  return null;
}

async function addMember(group: GroupRow, userId: string, method: 'create' | 'code' | 'link', ctx: JoinContext): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: sub } = await supabaseAdmin.from('member_subscriptions').select('plan_code').eq('user_id', userId).maybeSingle();
  const { error } = await supabaseAdmin.from('billing_group_members').insert({ group_id: group.id, user_id: userId, plan_code: (sub as { plan_code?: string } | null)?.plan_code ?? null });
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'You are already in a group.' };
    console.error('[billing/groups] join failed:', error.message);
    return { ok: false, error: 'We could not add you to the group. Please try again.' };
  }
  await logBillingEvent(userId, 'group_joined', { group_id: group.id, code: group.code, method, device: ctx.device ?? null });
  await refreshGroup(group.id);
  return { ok: true };
}

export async function createGroup(userId: string, ctx: JoinContext = {}): Promise<{ ok: true; group: GroupSummary; existing: boolean } | { ok: false; error: string; canSwitchAt?: string }> {
  const mine = await currentMembership(userId);
  if (mine) {
    const g = await loadGroup({ id: mine.groupId });
    if (g) return { ok: true, group: summary(g), existing: true };
  }
  const lock = switchLockedUntil(await membershipHistory(userId), new Date());
  if (lock) {
    return { ok: false, canSwitchAt: lock.toISOString(), error: `You joined a group recently. You can switch groups once every 90 days, so you can start a new one from ${lock.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}.` };
  }
  const g = await newGroupRow(userId);
  if (!g) return { ok: false, error: 'We could not start your group. Please try again.' };
  const added = await addMember(g, userId, 'create', ctx);
  if (!added.ok) return added;
  return { ok: true, group: summary(g), existing: false };
}

async function joinGroup(userId: string, group: GroupRow | null, method: 'code' | 'link', ctx: JoinContext): Promise<JoinResult> {
  if (!group) return { ok: false, reason: 'not_found', error: 'We could not find a group with that code or link. Check it and try again.' };
  const mine = await currentMembership(userId);
  const [active, total, history] = await Promise.all([
    memberIds(group.id).then((x) => x.length), totalRows(group.id), membershipHistory(userId),
  ]);
  const check = checkJoin({
    now: new Date(), currentGroupId: mine?.groupId ?? null, targetGroupId: group.id, targetCreatedAt: new Date(group.created_at),
    targetActiveRows: active, targetTotalRows: total, history,
  });
  if (!check.ok) return { ok: false, reason: check.reason, error: check.message, canSwitchAt: check.canSwitchAt?.toISOString() };
  if (check.already) return { ok: true, group: summary(group), already: true };

  const added = await addMember(group, userId, method, ctx);
  if (!added.ok) return { ok: false, reason: 'error', error: added.error };
  // Two people joining at the same moment could pass the size check together: if the group went over the cap, step back out.
  const after = (await memberIds(group.id)).length;
  if (after > GROUP_MAX) {
    await supabaseAdmin.from('billing_group_members').delete().eq('group_id', group.id).eq('user_id', userId).is('left_at', null);
    return { ok: false, reason: 'full', error: `This group is full. A group can have up to ${GROUP_MAX} members.` };
  }
  return { ok: true, group: summary(group), already: false };
}

export async function joinByCode(userId: string, rawCode: string, ctx: JoinContext = {}): Promise<JoinResult> {
  const code = normaliseGroupCode(rawCode);
  if (!code) return { ok: false, reason: 'not_found', error: 'That code does not look right. Group codes look like ASC-7K2Q.' };
  return joinGroup(userId, await loadGroup({ code }), 'code', ctx);
}

export async function joinByToken(userId: string, token: string, ctx: JoinContext = {}): Promise<JoinResult> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return { ok: false, reason: 'not_found', error: 'We could not find a group with that link.' };
  return joinGroup(userId, await loadGroup({ token }), 'link', ctx);
}

export async function leaveGroup(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const mine = await currentMembership(userId);
  if (!mine) return { ok: false, error: 'You are not in a group.' };
  const { error } = await supabaseAdmin.from('billing_group_members').update({ left_at: new Date().toISOString() }).eq('group_id', mine.groupId).eq('user_id', userId).is('left_at', null);
  if (error) return { ok: false, error: 'We could not take you out of the group. Please try again.' };
  await logBillingEvent(userId, 'group_left', { group_id: mine.groupId });
  const r = await refreshGroup(mine.groupId);
  // Alert for the admin: a group that is down to exactly its minimum can be topped up before it breaks.
  if (r && r.activeCount === GROUP_MIN) await logBillingEvent(null, 'group_at_minimum', { group_id: mine.groupId, active_count: r.activeCount });
  return { ok: true };
}

// ── Status and preview ───────────────────────────────────────────────────────

export async function getGroupStatus(userId: string): Promise<GroupStatusView> {
  const mine = await currentMembership(userId);
  const history = await membershipHistory(userId);
  const lock = switchLockedUntil(history, new Date());
  const canSwitchAt = lock ? lock.toISOString() : null;
  const none: GroupStatusView = { inGroup: false, group: null, activeCount: 0, needed: GROUP_MIN, status: null, underReview: false, statusText: '', canSwitchAt };
  if (!mine) return none;
  const g = await loadGroup({ id: mine.groupId });
  if (!g) return none;
  const r = await refreshGroup(g.id);
  const activeCount = r?.activeCount ?? 0;
  const status = r?.status ?? g.status;
  const underReview = r?.flagged ?? g.flagged;
  return {
    inGroup: true, group: summary(g), activeCount, needed: Math.max(0, GROUP_MIN - activeCount), status, underReview,
    statusText: describeStatus(status, activeCount, underReview), canSwitchAt,
  };
}

/** What a visitor may know before joining: whether the code works. No member data at all. */
export async function previewGroup(by: { code?: string; token?: string }): Promise<{ found: boolean; joinable: boolean; message: string | null; code: string | null }> {
  let g: GroupRow | null = null;
  if (by.code) { const c = normaliseGroupCode(by.code); g = c ? await loadGroup({ code: c }) : null; }
  else if (by.token && /^[A-Za-z0-9_-]{16,64}$/.test(by.token)) g = await loadGroup({ token: by.token });
  if (!g) return { found: false, joinable: false, message: 'We could not find that group. Check the code or link and try again.', code: null };
  const [active, total] = await Promise.all([memberIds(g.id).then((x) => x.length), totalRows(g.id)]);
  const check = checkJoin({ now: new Date(), currentGroupId: null, targetGroupId: g.id, targetCreatedAt: new Date(g.created_at), targetActiveRows: active, targetTotalRows: total, history: [] });
  if (!check.ok) return { found: true, joinable: false, message: check.message, code: g.code };
  return { found: true, joinable: true, message: null, code: g.code };
}

// ── Circle placement hint ────────────────────────────────────────────────────

/**
 * Friends who join as a group are placed in the same Circle for now (owner decision). Returns the Circle id of the earliest-placed
 * ACTIVE member of this member's group (not counting the member), or null when there is none. Capacity, status and fit are for
 * the Circle placement code to check; this only says where the friends already are.
 */
export async function groupCircleHint(userId: string): Promise<string | null> {
  const mine = await currentMembership(userId);
  if (!mine) return null;
  const others = (await memberIds(mine.groupId)).filter((id) => id !== userId);
  if (!others.length) return null;
  const { data: subs } = await supabaseAdmin.from('member_subscriptions').select('user_id, state').in('user_id', others);
  const active = ((subs ?? []) as { user_id: string; state: SubState }[]).filter((s) => isActiveState(s.state)).map((s) => s.user_id);
  if (!active.length) return null;
  const { data: seats } = await supabaseAdmin
    .from('circle_seats').select('circle_id, joined_at').in('user_id', active).eq('role', 'member').not('joined_at', 'is', null).order('joined_at', { ascending: true }).limit(1);
  return ((seats ?? [])[0] as { circle_id: string } | undefined)?.circle_id ?? null;
}
