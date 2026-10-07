import 'server-only';
// lib/rx/circle.ts
// Reads for the Circle screens: chat messages, weekly reports, the cycle summary and the facilitator view.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { addDays, diffDays, localISODate } from './dates';
import { namesFor, type Db } from './server';
import type { ChatMsg } from './chat-types';

interface MsgRow { id: string; user_id: string | null; body: string; is_win: boolean; pinned: boolean; created_at: string }

export async function circleMessages(db: Db, circleId: string, afterISO?: string | null, limit = 200): Promise<ChatMsg[]> {
  let q = db.from('circle_messages').select('id, user_id, body, is_win, pinned, created_at').eq('circle_id', circleId);
  q = afterISO ? q.gt('created_at', afterISO).order('created_at') : q.order('created_at', { ascending: false }).limit(limit);
  const { data } = await q;
  const rows = ((data ?? []) as MsgRow[]);
  if (!afterISO) rows.reverse();
  const names = await namesFor(db, rows.map((r) => r.user_id));
  return rows.map((r) => ({
    id: r.id, userId: r.user_id,
    name: r.user_id ? (names.get(r.user_id)?.name ?? 'Member') : 'Ascentor',
    avatarUrl: r.user_id ? names.get(r.user_id)?.avatarUrl ?? null : null,
    body: r.body, createdAt: r.created_at, isWin: r.is_win, pinned: r.pinned,
  }));
}

export interface ReportView { userId: string; name: string; avatarUrl: string | null; kept: string; obstacle: string | null; next: string | null; isMe: boolean }

export async function circleReports(db: Db, circleId: string, week: number, meId: string): Promise<ReportView[]> {
  const { data } = await db.from('circle_reports').select('user_id, kept, obstacle, next_step, created_at').eq('circle_id', circleId).eq('week_no', week).order('created_at', { ascending: false });
  const rows = (data ?? []) as { user_id: string; kept: string; obstacle: string | null; next_step: string | null }[];
  const names = await namesFor(db, rows.map((r) => r.user_id));
  return rows.map((r) => ({ userId: r.user_id, name: r.user_id === meId ? 'You' : names.get(r.user_id)?.name ?? 'Member', avatarUrl: names.get(r.user_id)?.avatarUrl ?? null, kept: r.kept, obstacle: r.obstacle, next: r.next_step, isMe: r.user_id === meId }));
}

export interface CycleSummary { setCount: number; keptCount: number; goalsMet: number; goalsTotal: number; reports: number }

export async function cycleSummary(userId: string, circleId: string, cycleStart: string | null): Promise<CycleSummary> {
  const db = await createClient();
  const from = cycleStart ?? '1970-01-01';
  const [{ count: setCount }, { count: keptCount }, { data: goals }, { count: reports }] = await Promise.all([
    db.from('practice_checkins').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('day', from),
    db.from('practice_checkins').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'kept').gte('day', from),
    db.from('user_goals').select('progress, milestone_1_completed, milestone_2_completed, milestone_3_completed').eq('user_id', userId),
    db.from('circle_reports').select('id', { count: 'exact', head: true }).eq('circle_id', circleId).eq('user_id', userId),
  ]);
  const gs = (goals ?? []) as { progress: number | null; milestone_1_completed: boolean; milestone_2_completed: boolean; milestone_3_completed: boolean }[];
  const met = gs.filter((g) => (g.progress ?? 0) >= 100 || (g.milestone_1_completed && g.milestone_2_completed && g.milestone_3_completed)).length;
  return { setCount: setCount ?? 0, keptCount: keptCount ?? 0, goalsMet: met, goalsTotal: Math.min(3, gs.length), reports: reports ?? 0 };
}

export interface FacilMember { userId: string; name: string; avatarUrl: string | null; status: string; quietDays: number | null; isYou: boolean }

/**
 * What a facilitator sees about each member: only whether and when they last checked in, and whether this week's
 * report is shared. Never what anyone wrote to Sage or in a check-in. Caller must already have verified the
 * facilitator role for this circle.
 */
export async function facilitatorView(circleId: string, week: number | null, tz: string, meId: string): Promise<FacilMember[]> {
  const { data: seats } = await supabaseAdmin.from('circle_seats').select('user_id').eq('circle_id', circleId).eq('role', 'member');
  const ids = ((seats ?? []) as { user_id: string }[]).map((s) => s.user_id);
  if (!ids.length) return [];
  const today = localISODate(tz);
  const since = addDays(today, -60);
  const [{ data: dir }, { data: checks }, { data: reports }] = await Promise.all([
    supabaseAdmin.from('member_directory').select('id, full_name, avatar_url').in('id', ids),
    supabaseAdmin.from('practice_checkins').select('user_id, day').in('user_id', ids).gte('day', since),
    week ? supabaseAdmin.from('circle_reports').select('user_id').eq('circle_id', circleId).eq('week_no', week) : Promise.resolve({ data: [] }),
  ]);
  const last = new Map<string, string>();
  for (const c of (checks ?? []) as { user_id: string; day: string }[]) if (!last.has(c.user_id) || c.day > (last.get(c.user_id) as string)) last.set(c.user_id, c.day);
  const reported = new Set(((reports ?? []) as { user_id: string }[]).map((r) => r.user_id));
  const byId = new Map(((dir ?? []) as { id: string; full_name: string | null; avatar_url: string | null }[]).map((d) => [d.id, d]));

  return ids.map((id) => {
    const l = last.get(id);
    const gap = l ? diffDays(today, l) : null;
    let status: string;
    if (reported.has(id)) status = 'Report shared';
    else if (gap === 0) status = 'Today';
    else if (gap === 1) status = 'Yesterday';
    else if (gap !== null && gap < 5) status = `${gap} days ago`;
    else status = gap === null ? 'No check-ins yet' : `Quiet ${gap} days`;
    return { userId: id, name: byId.get(id)?.full_name?.trim() || 'Member', avatarUrl: byId.get(id)?.avatar_url ?? null, status, quietDays: gap, isYou: id === meId };
  }).sort((a, b) => (b.quietDays ?? 99) - (a.quietDays ?? 99));
}
