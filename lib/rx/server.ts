import 'server-only';
// lib/rx/server.ts
// Request-scoped data access for the reimagined member app. Every read and write here runs as the signed-in member
// (row level security applies). The service-role client is used only where a policy deliberately gives members no
// write access (placing a member in a Circle, staff changes), and only after the caller has been authorised.

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cycleWeek, DEFAULT_TZ, localISODate, mondayOfISO } from './dates';

export type Db = Awaited<ReturnType<typeof createClient>>;

export interface MemberProfileRow {
  user_id: string;
  interests: string[];
  purpose_score: number | null;
  effort_score: number | null;
  lead_exp: string | null;
  project_exp: string | null;
  slots: string[];
  timezone: string | null;
  timezone_label: string | null;
  language: string;
  stage: string | null;
  city: string | null;
  country: string | null;
  baseline: Record<string, unknown>;
  survey_remind_at: string | null;
  onboarding_step: string | null;
  onboarded_at: string | null;
  notif: Record<string, boolean>;
  max_per_day: number;
  quiet_hours: boolean;
  reminders_paused_until: string | null;
  research_opt_in: boolean;
  ann_muted: boolean;
  dm_policy: string;
  is_facilitator: boolean;
  beyond_self_project: string | null;
  beyond_self_since: string | null;
}

export interface CircleRow {
  id: string;
  name: string;
  number: number;
  status: 'forming' | 'active' | 'completed';
  facilitator_id: string | null;
  timezone: string | null;
  language: string | null;
  cycle_start: string | null;
  meeting_dow: number;
  meeting_time: string;
  meeting_url: string | null;
  focus: string | null;
}

export interface Me {
  userId: string;
  email: string | null;
  fullName: string;
  firstName: string;
  avatarUrl: string | null;
  role: string | null;
  isStaff: boolean;
  profile: MemberProfileRow | null;
  tz: string;
  today: string;
  weekStart: string;
}

/** Returns the signed-in user and a user-scoped client, or throws. */
export async function requireMember(): Promise<{ db: Db; userId: string }> {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error('Please sign in again.');
  return { db, userId: user.id };
}

export const getMe = cache(async (): Promise<Me | null> => {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;

  const [{ data: prof }, { data: mp }] = await Promise.all([
    db.from('profiles').select('full_name, role, avatar_url').eq('id', user.id).maybeSingle(),
    db.from('member_profile').select('*').eq('user_id', user.id).maybeSingle(),
  ]);

  const fullName = (prof?.full_name as string | undefined)?.trim() || (user.email?.split('@')[0] ?? 'there');
  const role = (prof?.role as string | undefined) ?? null;
  const profile = (mp as MemberProfileRow | null) ?? null;
  const tz = profile?.timezone || DEFAULT_TZ;
  const today = localISODate(tz);
  return {
    userId: user.id,
    email: user.email ?? null,
    fullName,
    firstName: fullName.split(/\s+/)[0],
    avatarUrl: (prof?.avatar_url as string | undefined) ?? null,
    role,
    isStaff: role === 'admin' || role === 'moderator',
    profile,
    tz,
    today,
    weekStart: mondayOfISO(today),
  };
});

export async function requireStaff(): Promise<Me> {
  const me = await getMe();
  if (!me || !me.isStaff) throw new Error('Staff only.');
  return me;
}

export interface MyCircle {
  circle: CircleRow;
  memberCount: number;
  week: number | null;
  pledged: boolean;
  isFacilitator: boolean;
  facilitatorName: string | null;
  seats: { userId: string; name: string; avatarUrl: string | null; role: string; isMe: boolean }[];
}

/** The member's Circle (member seat), with seats and the cycle week, or null when none has been assigned. */
export const getMyCircle = cache(async (): Promise<MyCircle | null> => {
  const me = await getMe();
  if (!me) return null;
  const db = await createClient();
  const { data: mySeat } = await db.from('circle_seats').select('circle_id, role, pledged_at').eq('user_id', me.userId).order('role').limit(1).maybeSingle();
  if (!mySeat) return null;
  const [{ data: circle }, { data: seatRows }] = await Promise.all([
    db.from('circles').select('*').eq('id', mySeat.circle_id).maybeSingle(),
    db.from('circle_seats').select('user_id, role').eq('circle_id', mySeat.circle_id),
  ]);
  if (!circle) return null;
  const ids = (seatRows ?? []).map((s: { user_id: string }) => s.user_id);
  const { data: people } = ids.length ? await db.from('member_directory').select('id, full_name, avatar_url').in('id', ids) : { data: [] };
  const byId = new Map((people ?? []).map((p: { id: string; full_name: string | null; avatar_url: string | null }) => [p.id, p]));
  const seats = (seatRows ?? []).map((s: { user_id: string; role: string }) => {
    const p = byId.get(s.user_id);
    return { userId: s.user_id, name: p?.full_name?.trim() || 'Member', avatarUrl: p?.avatar_url ?? null, role: s.role, isMe: s.user_id === me.userId };
  });
  const fac = seats.find((s) => s.userId === (circle as CircleRow).facilitator_id) ?? seats.find((s) => s.role === 'facilitator');
  const memberCount = seats.filter((s) => s.role === 'member').length;
  return {
    circle: circle as CircleRow,
    memberCount,
    week: cycleWeek((circle as CircleRow).cycle_start, me.today),
    pledged: !!mySeat.pledged_at,
    isFacilitator: mySeat.role === 'facilitator',
    facilitatorName: fac?.name ?? null,
    seats,
  };
});

/** Places the member in a Circle (service role: members cannot write circles directly). */
export async function assignCircle(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc('rx_assign_circle', { p_user: userId });
  if (error) { console.error('rx_assign_circle failed', error.message); return null; }
  return (data as string | null) ?? null;
}

/** Display names for a set of user ids, via the directory view. */
export async function namesFor(db: Db, ids: (string | null)[]): Promise<Map<string, { name: string; avatarUrl: string | null }>> {
  const uniq = [...new Set(ids.filter((x): x is string => !!x))];
  const out = new Map<string, { name: string; avatarUrl: string | null }>();
  if (!uniq.length) return out;
  const { data } = await db.from('member_directory').select('id, full_name, avatar_url').in('id', uniq);
  for (const p of data ?? []) out.set(p.id as string, { name: ((p.full_name as string | null) ?? '').trim() || 'Member', avatarUrl: (p.avatar_url as string | null) ?? null });
  return out;
}

export type ActionResult<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

export function fail(e: unknown, fallback = 'Something went wrong. Please try again.'): { ok: false; error: string } {
  const msg = e instanceof Error ? e.message : '';
  // Only surface our own short, human messages; never raw database errors.
  const safe = msg && msg.length < 140 && !/relation|column|violates|policy|syntax|permission|jwt|duplicate key/i.test(msg);
  return { ok: false, error: safe ? msg : fallback };
}
