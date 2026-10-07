'use server';

import { revalidatePath } from 'next/cache';
import { requireMember, getMe, fail } from '@/lib/rx/server';
import type { ActionResult } from '@/lib/rx/types';
import type { ChatMsg } from '@/lib/rx/chat-types';
import { mentorMessages, suggestMentors } from '@/lib/rx/mentors';
import { cleanText } from '@/lib/rx/safety';
import { isOwnMediaUrl, parseBody } from '@/lib/rx/media';
import { MENTOR_FORMAT, MENTOR_FREQUENCY, MENTOR_TIMES } from '@/lib/rx/constants';
import { zonedTimeToUtc } from '@/lib/rx/dates';
import { supabaseAdmin } from '@/lib/supabase/admin';

// ── member side ─────────────────────────────────────────────────────────────

export async function saveIntake(input: { goal: string; interests: string[]; frequency: string; format: string; times: string[] }): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const { error } = await db.from('mentee_intake').upsert({
      user_id: userId,
      goal: cleanText(input.goal, 300) || null,
      interests: input.interests.slice(0, 20).map((s) => cleanText(s, 60)).filter(Boolean),
      frequency: MENTOR_FREQUENCY.includes(input.frequency) ? input.frequency : null,
      format: MENTOR_FORMAT.includes(input.format) ? input.format : null,
      times: input.times.filter((t) => MENTOR_TIMES.includes(t)),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw error;
    revalidatePath('/sessions');
    return { ok: true };
  } catch (e) { return fail(e); }
}

/** Asks a mentor for a taster session, optionally at a chosen free time. */
export async function requestTaster(mentorId: string, slotId: string | null): Promise<ActionResult<{ matchId: string }>> {
  try {
    const { db, userId } = await requireMember();
    const { data: open } = await db.from('mentor_matches').select('id, mentor_id, status').eq('member_id', userId).in('status', ['requested', 'accepted', 'active']);
    const rows = (open ?? []) as { id: string; mentor_id: string; status: string }[];
    if (rows.some((r) => r.status === 'active' || r.status === 'accepted')) throw new Error('You already have a mentor. End that first to start a new match.');
    const same = rows.find((r) => r.mentor_id === mentorId);
    if (same) return { ok: true, matchId: same.id };
    if (rows.length >= 3) throw new Error('You have three requests waiting. Wait for a reply or cancel one.');

    const { data: mentor } = await db.from('human_mentors').select('id, accepting, active').eq('id', mentorId).maybeSingle();
    if (!mentor || !mentor.active || !mentor.accepting) throw new Error('This mentor isn’t taking new requests right now.');

    let slotAt: string | null = null;
    if (slotId) {
      const { data: slot } = await db.from('mentor_slots').select('id, starts_at, taken, mentor_id').eq('id', slotId).maybeSingle();
      if (!slot || slot.taken || slot.mentor_id !== mentorId || new Date(slot.starts_at as string) < new Date()) throw new Error('That time is no longer free. Pick another.');
      slotAt = slot.starts_at as string;
    }
    const why = (await suggestMentors()).find((m) => m.id === mentorId)?.why ?? null;
    const { data: m, error } = await db.from('mentor_matches').insert({ member_id: userId, mentor_id: mentorId, status: 'requested', slot_id: slotId, slot_at: slotAt, why }).select('id').single();
    if (error) throw error;
    revalidatePath('/sessions');
    return { ok: true, matchId: m.id as string };
  } catch (e) { return fail(e, 'We couldn’t send that request.'); }
}

export async function updateRequest(matchId: string, patch: { firstAsk?: string; slotId?: string }): Promise<ActionResult> {
  try {
    const { db } = await requireMember();
    const upd: Record<string, unknown> = {};
    if (patch.firstAsk !== undefined) upd.first_ask = cleanText(patch.firstAsk, 400) || null;
    if (patch.slotId) {
      const { data: m } = await db.from('mentor_matches').select('mentor_id').eq('id', matchId).maybeSingle();
      const { data: slot } = await db.from('mentor_slots').select('id, starts_at, taken, mentor_id').eq('id', patch.slotId).maybeSingle();
      if (!m || !slot || slot.taken || slot.mentor_id !== m.mentor_id) throw new Error('That time is no longer free. Pick another.');
      upd.slot_id = slot.id; upd.slot_at = slot.starts_at;
    }
    const { error } = await db.from('mentor_matches').update(upd).eq('id', matchId);
    if (error) throw error;
    revalidatePath('/sessions');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function cancelRequest(matchId: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const { error } = await db.from('mentor_matches').update({ status: 'ended' }).eq('id', matchId).eq('member_id', userId).eq('status', 'requested');
    if (error) throw error;
    revalidatePath('/sessions');
    return { ok: true };
  } catch (e) { return fail(e); }
}

/** Moves the next session of an active mentorship to another of the mentor's free times. */
export async function rescheduleSession(matchId: string, slotId: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const { data: m } = await db.from('mentor_matches').select('mentor_id, slot_id, member_id, status').eq('id', matchId).maybeSingle();
    if (!m || m.member_id !== userId || m.status !== 'active') throw new Error('This mentorship isn’t active.');
    const { data: slot } = await supabaseAdmin.from('mentor_slots').select('id, starts_at, taken, mentor_id').eq('id', slotId).maybeSingle();
    if (!slot || slot.taken || slot.mentor_id !== m.mentor_id) throw new Error('That time is no longer free. Pick another.');
    await supabaseAdmin.from('mentor_slots').update({ taken: true }).eq('id', slotId);
    if (m.slot_id) await supabaseAdmin.from('mentor_slots').update({ taken: false }).eq('id', m.slot_id);
    await supabaseAdmin.from('mentor_matches').update({ slot_id: slotId, slot_at: slot.starts_at }).eq('id', matchId);
    revalidatePath('/sessions');
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t reschedule. Please try again.'); }
}

/** Ends an active mentorship from either side. The agreement and messages are kept. */
export async function endMentorship(matchId: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const { data: m } = await db.from('mentor_matches').select('member_id, slot_id, status').eq('id', matchId).maybeSingle();
    if (!m || m.member_id !== userId || m.status !== 'active') throw new Error('This mentorship isn’t active.');
    // The member's own update policy only allows "requested" rows, so closing an active one goes through the service role.
    await supabaseAdmin.from('mentor_matches').update({ status: 'ended' }).eq('id', matchId);
    revalidatePath('/sessions');
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ── mentor side ─────────────────────────────────────────────────────────────

async function requireMentor() {
  const { db, userId } = await requireMember();
  const { data: mentor } = await db.from('human_mentors').select('id, capacity').eq('user_id', userId).maybeSingle();
  if (!mentor) throw new Error('This area is for mentors.');
  return { db, userId, mentor: mentor as { id: string; capacity: number } };
}

export async function respondToRequest(matchId: string, accept: boolean): Promise<ActionResult> {
  try {
    const { db, mentor } = await requireMentor();
    const { data: m } = await db.from('mentor_matches').select('id, mentor_id, status, slot_id').eq('id', matchId).maybeSingle();
    if (!m || m.mentor_id !== mentor.id || m.status !== 'requested') throw new Error('This request isn’t available.');
    if (accept) {
      const { count } = await db.from('mentor_matches').select('id', { count: 'exact', head: true }).eq('mentor_id', mentor.id).in('status', ['accepted', 'active']);
      if ((count ?? 0) >= mentor.capacity) throw new Error('You’re at capacity. Raise it to accept more.');
      if (m.slot_id) await db.from('mentor_slots').update({ taken: true }).eq('id', m.slot_id);
    }
    const { error } = await db.from('mentor_matches').update(accept ? { status: 'active', accepted_at: new Date().toISOString() } : { status: 'declined' }).eq('id', matchId);
    if (error) throw error;
    revalidatePath('/sessions/mentoring');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function setCapacity(n: number): Promise<ActionResult> {
  try {
    const { db, mentor } = await requireMentor();
    const cap = Math.max(0, Math.min(8, Math.round(n)));
    const { error } = await db.from('human_mentors').update({ capacity: cap }).eq('id', mentor.id);
    if (error) throw error;
    revalidatePath('/sessions/mentoring');
    return { ok: true };
  } catch (e) { return fail(e); }
}

/** Adds a free time. `local` is "YYYY-MM-DDTHH:mm" in the mentor's own time zone. */
export async function addSlot(local: string): Promise<ActionResult> {
  try {
    const { db, mentor } = await requireMentor();
    const me = await getMe();
    const m = local.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);
    if (!m) throw new Error('Choose a date and time.');
    const at = zonedTimeToUtc(m[1], m[2], me?.tz ?? 'Africa/Lagos');
    if (at.getTime() < Date.now() + 3600 * 1000) throw new Error('Pick a time at least an hour from now.');
    const { error } = await db.from('mentor_slots').upsert({ mentor_id: mentor.id, starts_at: at.toISOString(), taken: false }, { onConflict: 'mentor_id,starts_at', ignoreDuplicates: true });
    if (error) throw error;
    revalidatePath('/sessions/mentoring');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function removeSlot(slotId: string): Promise<ActionResult> {
  try {
    const { db, mentor } = await requireMentor();
    const { error } = await db.from('mentor_slots').delete().eq('id', slotId).eq('mentor_id', mentor.id).eq('taken', false);
    if (error) throw error;
    revalidatePath('/sessions/mentoring');
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ── the agreement (both sides) ──────────────────────────────────────────────

async function partyFor(matchId: string): Promise<{ db: Awaited<ReturnType<typeof requireMember>>['db']; userId: string; party: 'member' | 'mentor' }> {
  const { db, userId } = await requireMember();
  const { data: m } = await db.from('mentor_matches').select('member_id, human_mentors(user_id)').eq('id', matchId).maybeSingle();
  if (!m) throw new Error('This mentorship isn’t available.');
  const mentorUser = (m.human_mentors as unknown as { user_id: string | null } | null)?.user_id;
  if (m.member_id === userId) return { db, userId, party: 'member' };
  if (mentorUser === userId) return { db, userId, party: 'mentor' };
  throw new Error('This mentorship isn’t available.');
}

/** Any change to the agreement clears both confirmations, so what is confirmed is what is written. */
async function reopen(db: Awaited<ReturnType<typeof requireMember>>['db'], matchId: string) {
  await db.from('mentor_confirmations').delete().eq('match_id', matchId);
}

export async function addGoal(matchId: string, text: string): Promise<ActionResult> {
  try {
    const { db } = await partyFor(matchId);
    const t = cleanText(text, 200);
    if (!t) throw new Error('Write the goal first.');
    const { count } = await db.from('mentor_goals').select('id', { count: 'exact', head: true }).eq('match_id', matchId);
    if ((count ?? 0) >= 5) throw new Error('Five goals is plenty. Remove one to add another.');
    const { error } = await db.from('mentor_goals').insert({ match_id: matchId, text: t, position: count ?? 0 });
    if (error) throw error;
    await reopen(db, matchId);
    revalidatePath('/sessions');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function removeGoal(matchId: string, goalId: string): Promise<ActionResult> {
  try {
    const { db } = await partyFor(matchId);
    const { error } = await db.from('mentor_goals').delete().eq('id', goalId).eq('match_id', matchId);
    if (error) throw error;
    await reopen(db, matchId);
    revalidatePath('/sessions');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function addTask(matchId: string, task: string, owner: 'member' | 'mentor', due: string | null): Promise<ActionResult> {
  try {
    const { db } = await partyFor(matchId);
    const t = cleanText(task, 200);
    if (!t) throw new Error('Write the task first.');
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new Error('That date isn’t valid.');
    const { error } = await db.from('mentor_tasks').insert({ match_id: matchId, task: t, owner: owner === 'mentor' ? 'mentor' : 'member', due: due || null });
    if (error) throw error;
    await reopen(db, matchId);
    revalidatePath('/sessions');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function toggleTask(matchId: string, taskId: string, done: boolean): Promise<ActionResult> {
  try {
    const { db } = await partyFor(matchId);
    const { error } = await db.from('mentor_tasks').update({ done }).eq('id', taskId).eq('match_id', matchId);
    if (error) throw error;
    revalidatePath('/sessions');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function removeTask(matchId: string, taskId: string): Promise<ActionResult> {
  try {
    const { db } = await partyFor(matchId);
    const { error } = await db.from('mentor_tasks').delete().eq('id', taskId).eq('match_id', matchId);
    if (error) throw error;
    await reopen(db, matchId);
    revalidatePath('/sessions');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function confirmAgreement(matchId: string): Promise<ActionResult> {
  try {
    const { db, party } = await partyFor(matchId);
    const { count } = await db.from('mentor_goals').select('id', { count: 'exact', head: true }).eq('match_id', matchId);
    if (!count) throw new Error('Add at least one goal before confirming.');
    const { error } = await db.from('mentor_confirmations').upsert({ match_id: matchId, party }, { onConflict: 'match_id,party' });
    if (error) throw error;
    revalidatePath('/sessions');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function sendMentorMessage(matchId: string, raw: string): Promise<ActionResult<{ message: ChatMsg }>> {
  try {
    const { db, userId } = await partyFor(matchId);
    const body = cleanText(raw, 2000);
    if (!body) throw new Error('Write a message first.');
    const p = parseBody(body);
    if (/^\[(voice|img):/.test(body) && p.kind === 'text') throw new Error('That attachment isn’t allowed.');
    if (p.kind !== 'text' && !isOwnMediaUrl(p.url)) throw new Error('That attachment isn’t allowed.');
    const { data, error } = await db.from('mentor_messages').insert({ match_id: matchId, sender_id: userId, body }).select('id, created_at').single();
    if (error) throw error;
    const me = await getMe();
    return { ok: true, message: { id: data.id as string, userId, name: me?.fullName ?? 'You', avatarUrl: me?.avatarUrl ?? null, body, createdAt: data.created_at as string } };
  } catch (e) { return fail(e, 'We couldn’t send that.'); }
}

export async function pollMentorMessages(matchId: string, afterISO: string | null): Promise<ChatMsg[]> {
  const { db } = await partyFor(matchId);
  return mentorMessages(db, matchId, afterISO);
}
