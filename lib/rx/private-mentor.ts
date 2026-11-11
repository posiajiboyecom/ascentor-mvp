import 'server-only';
// lib/rx/private-mentor.ts
// Pinnacle private mentor sessions: loaders for the member page, the mentor view and the call room.
// Rules are in lib/rx/private-mentor-rules.ts; writes are in app/(app)/sessions/private/actions.ts.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { BOOK_AHEAD_HOURS, BOOK_WINDOW_DAYS } from './private-mentor-rules';

export interface PrivateSession {
  id: string;
  memberId: string;
  mentorId: string;
  mentorName: string;
  mentorUserId: string | null;
  memberName: string;
  startsAt: string;
  durationMin: number;
  agenda: string;
  status: 'scheduled' | 'cancelled' | 'completed';
  cancelledBy: string | null;
  cancelReason: string | null;
}

interface Row {
  id: string; member_id: string; mentor_id: string; starts_at: string; duration_min: number; agenda: string;
  status: PrivateSession['status']; cancelled_by: string | null; cancel_reason: string | null;
  human_mentors: { name: string; user_id: string | null } | null;
}

const COLS = 'id, member_id, mentor_id, starts_at, duration_min, agenda, status, cancelled_by, cancel_reason, human_mentors(name, user_id)';

async function withNames(rows: Row[]): Promise<PrivateSession[]> {
  const ids = [...new Set(rows.map((r) => r.member_id))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabaseAdmin.from('profiles').select('id, full_name').in('id', ids);
    for (const p of (data ?? []) as { id: string; full_name: string | null }[]) names.set(p.id, (p.full_name ?? 'Member').split(/\s+/)[0]);
  }
  return rows.map((r) => ({
    id: r.id, memberId: r.member_id, mentorId: r.mentor_id, mentorName: r.human_mentors?.name ?? 'Your mentor', mentorUserId: r.human_mentors?.user_id ?? null,
    memberName: names.get(r.member_id) ?? 'Member', startsAt: r.starts_at, durationMin: r.duration_min, agenda: r.agenda, status: r.status,
    cancelledBy: r.cancelled_by, cancelReason: r.cancel_reason,
  }));
}

/** The member's private sessions, newest first. */
export async function memberPrivateSessions(userId: string, limit = 24): Promise<PrivateSession[]> {
  const { data } = await supabaseAdmin.from('private_mentor_sessions').select(COLS).eq('member_id', userId).order('starts_at', { ascending: false }).limit(limit);
  return withNames((data ?? []) as unknown as Row[]);
}

/** A mentor's upcoming private sessions (not cancelled), soonest first. */
export async function mentorPrivateSessions(mentorId: string): Promise<PrivateSession[]> {
  const since = new Date(Date.now() - 60 * 60000).toISOString();
  const { data } = await supabaseAdmin.from('private_mentor_sessions').select(COLS).eq('mentor_id', mentorId).eq('status', 'scheduled').gt('starts_at', since).order('starts_at');
  return withNames((data ?? []) as unknown as Row[]);
}

export async function getPrivateSession(id: string): Promise<PrivateSession | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabaseAdmin.from('private_mentor_sessions').select(COLS).eq('id', id).maybeSingle();
  if (!data) return null;
  return (await withNames([data as unknown as Row]))[0];
}

export interface BookableMentor {
  id: string; name: string; headline: string | null; bio: string | null; tags: string[]; avatarUrl: string | null;
  slots: { id: string; startsAt: string }[];
}

/** Active mentors with open times inside the booking window. The member's own mentor profile is left out. */
export async function bookableMentors(userId: string, now = new Date()): Promise<BookableMentor[]> {
  const from = new Date(now.getTime() + BOOK_AHEAD_HOURS * 3_600_000).toISOString();
  const to = new Date(now.getTime() + BOOK_WINDOW_DAYS * 86_400_000).toISOString();
  const { data: mentors } = await supabaseAdmin.from('human_mentors').select('id, user_id, name, headline, bio, tags, avatar_url').eq('active', true).eq('accepting', true).not('is_demo', 'is', true);
  const list = ((mentors ?? []) as { id: string; user_id: string | null; name: string; headline: string | null; bio: string | null; tags: string[] | null; avatar_url: string | null }[])
    .filter((m) => m.user_id !== userId);
  if (!list.length) return [];
  const { data: slots } = await supabaseAdmin.from('mentor_slots').select('id, mentor_id, starts_at').in('mentor_id', list.map((m) => m.id)).eq('taken', false).gte('starts_at', from).lte('starts_at', to).order('starts_at');
  const by = new Map<string, { id: string; startsAt: string }[]>();
  for (const s of (slots ?? []) as { id: string; mentor_id: string; starts_at: string }[]) {
    const a = by.get(s.mentor_id) ?? []; a.push({ id: s.id, startsAt: s.starts_at }); by.set(s.mentor_id, a);
  }
  return list
    .map((m) => ({ id: m.id, name: m.name, headline: m.headline, bio: m.bio, tags: m.tags ?? [], avatarUrl: m.avatar_url, slots: by.get(m.id) ?? [] }))
    .filter((m) => m.slots.length > 0);
}
