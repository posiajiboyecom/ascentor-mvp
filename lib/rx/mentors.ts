import 'server-only';
// lib/rx/mentors.ts
// Mentor profile lookups shared by the Sessions screens. Mentorship itself (votes, scheduling, sessions, agreement)
// lives in lib/rx/cmentor.ts.

import { createClient } from '@/lib/supabase/server';
import { getMe, type Db } from './server';

export interface MentorRow {
  id: string; user_id: string | null; name: string; headline: string | null; bio: string | null;
  tags: string[]; langs: string[]; formats: string[]; avatar_url: string | null; capacity: number; accepting: boolean;
}
export interface SlotRow { id: string; mentor_id: string; starts_at: string }

/** Free, future slots per mentor (earliest first). */
export async function freeSlots(db: Db, mentorIds: string[]): Promise<Map<string, SlotRow[]>> {
  const out = new Map<string, SlotRow[]>();
  if (!mentorIds.length) return out;
  const { data } = await db.from('mentor_slots').select('id, mentor_id, starts_at').in('mentor_id', mentorIds).eq('taken', false).gt('starts_at', new Date().toISOString()).order('starts_at');
  for (const s of (data ?? []) as SlotRow[]) { const a = out.get(s.mentor_id) ?? []; a.push(s); out.set(s.mentor_id, a); }
  return out;
}

export async function myMentorProfile(): Promise<MentorRow | null> {
  const me = await getMe();
  if (!me) return null;
  const db = await createClient();
  const { data } = await db.from('human_mentors').select('id, user_id, name, headline, bio, tags, langs, formats, avatar_url, capacity, accepting').eq('user_id', me.userId).maybeSingle();
  return (data as MentorRow | null) ?? null;
}
