import 'server-only';
// lib/rx/mentors.ts
// Human mentorship: who fits a member, their open times, and the member's current matches.

import { createClient } from '@/lib/supabase/server';
import { getMe, namesFor, type Db } from './server';
import type { ChatMsg } from './chat-types';

export interface MentorRow {
  id: string; user_id: string | null; name: string; headline: string | null; bio: string | null;
  tags: string[]; langs: string[]; formats: string[]; avatar_url: string | null; capacity: number; accepting: boolean;
}
export interface SlotRow { id: string; mentor_id: string; starts_at: string }
export interface SuggestedMentor extends MentorRow { why: string; score: number; nextSlot: SlotRow | null }

const norm = (s: string) => s.trim().toLowerCase();

/** Free, future slots per mentor (earliest first). */
export async function freeSlots(db: Db, mentorIds: string[]): Promise<Map<string, SlotRow[]>> {
  const out = new Map<string, SlotRow[]>();
  if (!mentorIds.length) return out;
  const { data } = await db.from('mentor_slots').select('id, mentor_id, starts_at').in('mentor_id', mentorIds).eq('taken', false).gt('starts_at', new Date().toISOString()).order('starts_at');
  for (const s of (data ?? []) as SlotRow[]) { const a = out.get(s.mentor_id) ?? []; a.push(s); out.set(s.mentor_id, a); }
  return out;
}

/** Up to three mentors who fit this member, with a plain reason for each. Nobody is assigned. */
export async function suggestMentors(): Promise<SuggestedMentor[]> {
  const me = await getMe();
  if (!me) return [];
  const db = await createClient();
  const [{ data: mentors }, { data: intake }, { data: goal }, { data: load }] = await Promise.all([
    db.from('human_mentors').select('id, user_id, name, headline, bio, tags, langs, formats, avatar_url, capacity, accepting').eq('active', true).eq('accepting', true),
    db.from('mentee_intake').select('goal, interests, format').eq('user_id', me.userId).maybeSingle(),
    db.from('user_goals').select('goal_text').eq('user_id', me.userId).order('position').limit(1).maybeSingle(),
    db.from('mentor_matches').select('mentor_id, status').in('status', ['accepted', 'active']),
  ]);
  const rows = ((mentors ?? []) as MentorRow[]).filter((m) => m.user_id !== me.userId);
  const busy = new Map<string, number>();
  for (const l of (load ?? []) as { mentor_id: string }[]) busy.set(l.mentor_id, (busy.get(l.mentor_id) ?? 0) + 1);
  const open = rows.filter((m) => (busy.get(m.id) ?? 0) < m.capacity);

  const interests = new Set([...(me.profile?.interests ?? []), ...((intake?.interests as string[] | undefined) ?? [])].map(norm));
  const goalWords = new Set(`${intake?.goal ?? ''} ${goal?.goal_text ?? ''}`.toLowerCase().split(/[^a-z0-9+]+/).filter((w) => w.length > 3));
  const lang = norm(me.profile?.language ?? 'English');
  const slots = await freeSlots(db, open.map((m) => m.id));

  const scored: SuggestedMentor[] = open.map((m) => {
    const tagHits = m.tags.filter((t) => interests.has(norm(t)));
    const goalHits = m.tags.filter((t) => !tagHits.includes(t) && [...goalWords].some((w) => norm(t).includes(w) || w.includes(norm(t))));
    const shareLang = m.langs.some((l) => norm(l) === lang);
    const next = (slots.get(m.id) ?? [])[0] ?? null;
    const score = tagHits.length * 3 + goalHits.length * 2 + (shareLang ? 1 : 0) + (next ? 1 : 0);
    let why: string;
    if (tagHits.length) why = `Shares ${tagHits.length === 1 ? 'one of your interests' : `${tagHits.length} of your interests`}: ${tagHits.slice(0, 2).join(' and ')}.`;
    else if (goalHits.length) why = `Works in the area you described: ${goalHits.slice(0, 2).join(' and ')}.`;
    else if (shareLang) why = `Speaks ${me.profile?.language ?? 'your language'}.`;
    else why = 'Has open times in the coming days.';
    return { ...m, why, score, nextSlot: next };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, 3);
}

export interface MatchRow {
  id: string; member_id: string; mentor_id: string; status: 'requested' | 'accepted' | 'declined' | 'active' | 'ended';
  slot_id: string | null; slot_at: string | null; first_ask: string | null; why: string | null; created_at: string; accepted_at: string | null;
}

/** The member's current mentorship: an active one, else the newest open request. */
export async function myMatch(): Promise<{ match: MatchRow; mentor: MentorRow } | null> {
  const me = await getMe();
  if (!me) return null;
  const db = await createClient();
  const { data } = await db.from('mentor_matches').select('*').eq('member_id', me.userId).in('status', ['requested', 'accepted', 'active']).order('created_at', { ascending: false });
  const rows = (data ?? []) as MatchRow[];
  const match = rows.find((r) => r.status === 'active' || r.status === 'accepted') ?? rows[0];
  if (!match) return null;
  const { data: mentor } = await db.from('human_mentors').select('id, user_id, name, headline, bio, tags, langs, formats, avatar_url, capacity, accepting').eq('id', match.mentor_id).maybeSingle();
  if (!mentor) return null;
  return { match, mentor: mentor as MentorRow };
}

export async function myMentorProfile(): Promise<MentorRow | null> {
  const me = await getMe();
  if (!me) return null;
  const db = await createClient();
  const { data } = await db.from('human_mentors').select('id, user_id, name, headline, bio, tags, langs, formats, avatar_url, capacity, accepting').eq('user_id', me.userId).maybeSingle();
  return (data as MentorRow | null) ?? null;
}

export async function mentorMessages(db: Db, matchId: string, afterISO?: string | null, limit = 200): Promise<ChatMsg[]> {
  let q = db.from('mentor_messages').select('id, sender_id, body, created_at').eq('match_id', matchId);
  q = afterISO ? q.gt('created_at', afterISO).order('created_at') : q.order('created_at', { ascending: false }).limit(limit);
  const { data } = await q;
  const rows = (data ?? []) as { id: string; sender_id: string; body: string; created_at: string }[];
  if (!afterISO) rows.reverse();
  const names = await namesFor(db, rows.map((r) => r.sender_id));
  return rows.map((r) => ({ id: r.id, userId: r.sender_id, name: names.get(r.sender_id)?.name ?? 'Member', avatarUrl: names.get(r.sender_id)?.avatarUrl ?? null, body: r.body, createdAt: r.created_at }));
}

export interface Agreement {
  goals: { id: string; text: string }[];
  tasks: { id: string; task: string; owner: 'member' | 'mentor'; due: string | null; done: boolean }[];
  memberConfirmed: boolean;
  mentorConfirmed: boolean;
}

export async function agreementFor(db: Db, matchId: string): Promise<Agreement> {
  const [{ data: goals }, { data: tasks }, { data: conf }] = await Promise.all([
    db.from('mentor_goals').select('id, text, position').eq('match_id', matchId).order('position'),
    db.from('mentor_tasks').select('id, task, owner, due, done').eq('match_id', matchId).order('due', { nullsFirst: false }),
    db.from('mentor_confirmations').select('party').eq('match_id', matchId),
  ]);
  const parties = new Set(((conf ?? []) as { party: string }[]).map((c) => c.party));
  return {
    goals: ((goals ?? []) as { id: string; text: string }[]).map((g) => ({ id: g.id, text: g.text })),
    tasks: (tasks ?? []) as Agreement['tasks'],
    memberConfirmed: parties.has('member'), mentorConfirmed: parties.has('mentor'),
  };
}
