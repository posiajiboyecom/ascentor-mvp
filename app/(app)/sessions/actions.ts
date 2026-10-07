'use server';

// Circle mentorship actions. Every rule is checked here, on the server: who may vote, who may confirm a time, when a
// session runs. Writes use the service role after the caller's place in the Circle (or as its mentor) is verified.

import { revalidatePath } from 'next/cache';
import { requireMember, getMe, getMyCircle, fail } from '@/lib/rx/server';
import type { ActionResult } from '@/lib/rx/types';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cleanText } from '@/lib/rx/safety';
import { zonedTimeToUtc } from '@/lib/rx/dates';
import { notifyMany } from '@/lib/notify';
import { MIN_GOING, READY_MEMBERS, MAX_AGREEMENT_GOALS, SESSIONS_PLANNED, SESSION_GAP_DAYS, openRound, settleRound } from '@/lib/rx/cmentor';
import { MENTOR_CALL_MINUTES } from '@/lib/rx/calls';

const CURRENT = ['requested', 'scheduling', 'active', 'paused'];

async function inCircle() {
  const { userId } = await requireMember();
  let c = await getMyCircle();
  let facilitator = false;
  if (!c) { c = await getMyCircle('facilitator'); facilitator = !!c; }
  if (!c) throw new Error('You are not in a Circle yet.');
  return { userId, circle: c, facilitator, member: !facilitator };
}

async function circleAudience(circleId: string): Promise<string[]> {
  const { data } = await supabaseAdmin.from('circle_seats').select('user_id').eq('circle_id', circleId);
  return ((data ?? []) as { user_id: string }[]).map((s) => s.user_id);
}

async function mentorUserOf(cmId: string): Promise<{ circleId: string; mentorId: string; mentorUserId: string | null; status: string }> {
  const { data } = await supabaseAdmin.from('circle_mentors').select('circle_id, mentor_id, status, human_mentors(user_id)').eq('id', cmId).maybeSingle();
  if (!data) throw new Error('This mentorship isn’t available.');
  return { circleId: data.circle_id as string, mentorId: data.mentor_id as string, status: data.status as string, mentorUserId: (data.human_mentors as unknown as { user_id: string | null } | null)?.user_id ?? null };
}

// ── voting ──────────────────────────────────────────────────────────────────

/** Opens the vote for the Circle's mentor, with up to three recommended mentors. */
export async function startVote(): Promise<ActionResult> {
  try {
    const { circle } = await inCircle();
    if (circle.memberCount < READY_MEMBERS) throw new Error(`Mentor sessions begin when your Circle has ${READY_MEMBERS} members.`);
    const { data: cur } = await supabaseAdmin.from('circle_mentors').select('id').eq('circle_id', circle.circle.id).in('status', CURRENT).maybeSingle();
    if (cur) throw new Error('Your Circle already has a mentor.');
    const { data: ended } = await supabaseAdmin.from('circle_mentors').select('mentor_id').eq('circle_id', circle.circle.id).in('status', ['ended', 'declined']);
    const id = await openRound(circle.circle.id, false, ((ended ?? []) as { mentor_id: string }[]).map((e) => e.mentor_id));
    if (!id) throw new Error('No mentors are available for your Circle yet. We’ll tell you as soon as one is.');
    await notifyMany(await circleAudience(circle.circle.id), { title: 'Choose your Circle’s mentor', body: 'Three mentors are suggested. Vote within 5 days.', url: '/sessions', tag: 'mentor-vote' });
    revalidatePath('/sessions');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function castVote(roundId: string, mentorId: string): Promise<ActionResult> {
  try {
    const { userId, circle, member } = await inCircle();
    if (!member) throw new Error('Members vote. The facilitator breaks ties.');
    const { data: round } = await supabaseAdmin.from('circle_mentor_rounds').select('id, circle_id, status, closes_at').eq('id', roundId).maybeSingle();
    if (!round || round.circle_id !== circle.circle.id || round.status !== 'open') throw new Error('This vote is closed.');
    if (new Date(round.closes_at as string).getTime() < Date.now()) { await settleRound(roundId); throw new Error('This vote has just closed.'); }
    const { data: cand } = await supabaseAdmin.from('circle_mentor_candidates').select('mentor_id').eq('round_id', roundId).eq('mentor_id', mentorId).maybeSingle();
    if (!cand) throw new Error('That mentor isn’t one of the choices.');
    const { error } = await supabaseAdmin.from('circle_mentor_votes').upsert({ round_id: roundId, circle_id: circle.circle.id, mentor_id: mentorId, user_id: userId }, { onConflict: 'round_id,user_id' });
    if (error) throw error;
    await settleRound(roundId);
    revalidatePath('/sessions');
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t record your vote.'); }
}

export async function breakTie(roundId: string, mentorId: string): Promise<ActionResult> {
  try {
    const { circle, facilitator } = await inCircle();
    if (!facilitator && !circle.isFacilitator) throw new Error('Only the facilitator breaks a tie.');
    const { data: round } = await supabaseAdmin.from('circle_mentor_rounds').select('id, circle_id, status, is_swap').eq('id', roundId).maybeSingle();
    if (!round || round.circle_id !== circle.circle.id || round.status !== 'tie') throw new Error('There’s no tie to break.');
    const { data: cand } = await supabaseAdmin.from('circle_mentor_candidates').select('mentor_id').eq('round_id', roundId).eq('mentor_id', mentorId).maybeSingle();
    if (!cand) throw new Error('That mentor isn’t one of the choices.');
    const { data: prior } = await supabaseAdmin.from('circle_mentors').select('swap_used').eq('circle_id', circle.circle.id).eq('swap_used', true).limit(1);
    await supabaseAdmin.from('circle_mentor_rounds').update({ status: 'closed', winner_mentor_id: mentorId }).eq('id', roundId);
    await supabaseAdmin.from('circle_mentors').insert({ circle_id: circle.circle.id, mentor_id: mentorId, round_id: roundId, status: 'requested', swap_used: !!round.is_swap || !!prior?.length });
    revalidatePath('/sessions');
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ── the mentor answers the Circle's request ─────────────────────────────────

export async function respondCircleRequest(cmId: string, accept: boolean): Promise<ActionResult> {
  try {
    const { userId } = await requireMember();
    const cm = await mentorUserOf(cmId);
    if (cm.mentorUserId !== userId || cm.status !== 'requested') throw new Error('This request isn’t available.');
    if (accept) {
      const { data: m } = await supabaseAdmin.from('human_mentors').select('capacity').eq('id', cm.mentorId).maybeSingle();
      const { count } = await supabaseAdmin.from('circle_mentors').select('id', { count: 'exact', head: true }).eq('mentor_id', cm.mentorId).in('status', ['scheduling', 'active', 'paused']);
      if ((count ?? 0) >= ((m?.capacity as number | undefined) ?? 0)) throw new Error('You’re at capacity. Raise it to accept more Circles.');
      await supabaseAdmin.from('circle_mentors').update({ status: 'scheduling' }).eq('id', cmId);
      await notifyMany(await circleAudience(cm.circleId), { title: 'Your mentor said yes', body: 'Mark the times you can attend so the Circle can pick one.', url: '/sessions', tag: 'mentor-accepted' });
    } else {
      await supabaseAdmin.from('circle_mentors').update({ status: 'declined' }).eq('id', cmId);
      // back to the Circle with the remaining choices
      const { data: ended } = await supabaseAdmin.from('circle_mentors').select('mentor_id').eq('circle_id', cm.circleId).in('status', ['ended', 'declined']);
      const id = await openRound(cm.circleId, false, ((ended ?? []) as { mentor_id: string }[]).map((e) => e.mentor_id));
      await notifyMany(await circleAudience(cm.circleId), { title: id ? 'Choose another mentor' : 'Your mentor can’t take your Circle', body: id ? 'Your first choice wasn’t available. Vote again.' : 'We’ll tell you when another mentor is available.', url: '/sessions', tag: 'mentor-declined' });
    }
    revalidatePath('/sessions'); revalidatePath('/sessions/mentoring');
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ── picking a time ──────────────────────────────────────────────────────────

export async function markSlot(cmId: string, slotId: string, on: boolean): Promise<ActionResult> {
  try {
    const { userId, circle, member } = await inCircle();
    if (!member) throw new Error('Members mark the times they can attend.');
    const cm = await mentorUserOf(cmId);
    if (cm.circleId !== circle.circle.id || cm.status !== 'scheduling') throw new Error('This isn’t open for times right now.');
    const { data: slot } = await supabaseAdmin.from('mentor_slots').select('id, mentor_id, taken, starts_at').eq('id', slotId).maybeSingle();
    if (!slot || slot.mentor_id !== cm.mentorId || slot.taken) throw new Error('That time is no longer free.');
    if (on) { const { error } = await supabaseAdmin.from('slot_marks').upsert({ circle_mentor_id: cmId, circle_id: circle.circle.id, slot_id: slotId, user_id: userId }, { onConflict: 'circle_mentor_id,slot_id,user_id' }); if (error) throw error; }
    else await supabaseAdmin.from('slot_marks').delete().eq('circle_mentor_id', cmId).eq('slot_id', slotId).eq('user_id', userId);
    revalidatePath('/sessions');
    return { ok: true };
  } catch (e) { return fail(e); }
}

/** The facilitator or the mentor confirms a time that at least 6 members can attend. Sessions then repeat every two weeks. */
export async function confirmSlot(cmId: string, slotId: string): Promise<ActionResult> {
  try {
    const { userId, circle, facilitator } = await inCircle().catch(async () => ({ userId: (await requireMember()).userId, circle: null, facilitator: false }));
    const cm = await mentorUserOf(cmId);
    const isMentor = cm.mentorUserId === userId;
    const isFac = !!circle && cm.circleId === circle.circle.id && (facilitator || circle.isFacilitator);
    if (!isMentor && !isFac) throw new Error('The facilitator or the mentor confirms the time.');
    if (cm.status !== 'scheduling') throw new Error('A time has already been confirmed.');
    const { data: slot } = await supabaseAdmin.from('mentor_slots').select('id, mentor_id, taken, starts_at').eq('id', slotId).maybeSingle();
    if (!slot || slot.mentor_id !== cm.mentorId || slot.taken) throw new Error('That time is no longer free.');
    const { count } = await supabaseAdmin.from('slot_marks').select('user_id', { count: 'exact', head: true }).eq('circle_mentor_id', cmId).eq('slot_id', slotId);
    if ((count ?? 0) < MIN_GOING) throw new Error(`At least ${MIN_GOING} members need to be able to attend. Ask the Circle to mark this time.`);
    const first = new Date(slot.starts_at as string);
    const rows = Array.from({ length: SESSIONS_PLANNED }, (_, i) => ({ circle_mentor_id: cmId, circle_id: cm.circleId, mentor_id: cm.mentorId, starts_at: new Date(first.getTime() + i * SESSION_GAP_DAYS * 86400000).toISOString(), duration_min: MENTOR_CALL_MINUTES }));
    const { error } = await supabaseAdmin.from('circle_mentor_sessions').insert(rows);
    if (error) throw error;
    await supabaseAdmin.from('mentor_slots').update({ taken: true }).eq('id', slotId);
    await supabaseAdmin.from('circle_mentors').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', cmId);
    await notifyMany([...(await circleAudience(cm.circleId)), ...(cm.mentorUserId ? [cm.mentorUserId] : [])], { title: 'Mentor sessions are booked', body: 'Every two weeks, 20 minutes, audio only. Say whether you’re going.', url: '/sessions', tag: 'mentor-booked' });
    revalidatePath('/sessions'); revalidatePath('/sessions/mentoring');
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ── RSVP and questions ──────────────────────────────────────────────────────

async function sessionOf(sessionId: string, circleId: string) {
  const { data: s } = await supabaseAdmin.from('circle_mentor_sessions').select('id, circle_id, starts_at, duration_min, status').eq('id', sessionId).maybeSingle();
  if (!s || s.circle_id !== circleId) throw new Error('That session isn’t available.');
  return s as { id: string; circle_id: string; starts_at: string; duration_min: number; status: string };
}

export async function setRsvp(sessionId: string, status: 'going' | 'cannot'): Promise<ActionResult> {
  try {
    const { userId, circle, member } = await inCircle();
    if (!member) throw new Error('Members say whether they are going.');
    if (status !== 'going' && status !== 'cannot') throw new Error('Choose going or can’t.');
    const s = await sessionOf(sessionId, circle.circle.id);
    if (s.status !== 'scheduled' || new Date(s.starts_at).getTime() < Date.now()) throw new Error('That session has passed.');
    const { error } = await supabaseAdmin.from('session_rsvps').upsert({ session_id: sessionId, circle_id: circle.circle.id, user_id: userId, status, updated_at: new Date().toISOString() }, { onConflict: 'session_id,user_id' });
    if (error) throw error;
    revalidatePath('/sessions');
    return { ok: true };
  } catch (e) { return fail(e); }
}

/** One question per member per session, until 24 hours before it starts. */
export async function askQuestion(sessionId: string, text: string): Promise<ActionResult> {
  try {
    const { userId, circle, member } = await inCircle();
    if (!member) throw new Error('Members ask the questions.');
    const s = await sessionOf(sessionId, circle.circle.id);
    if (new Date(s.starts_at).getTime() - Date.now() < 24 * 3600000) throw new Error('Questions close 24 hours before the session.');
    const t = cleanText(text, 280);
    if (t.length < 5) throw new Error('Write your question first (at least a few words).');
    const { error } = await supabaseAdmin.from('mentor_questions').upsert({ session_id: sessionId, circle_id: circle.circle.id, user_id: userId, text: t }, { onConflict: 'session_id,user_id' });
    if (error) throw error;
    revalidatePath('/sessions');
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ── the agreement ───────────────────────────────────────────────────────────

async function agreementActor(cmId: string) {
  const { userId } = await requireMember();
  const cm = await mentorUserOf(cmId);
  const mine = await getMyCircle();
  const isMember = !!mine && mine.circle.id === cm.circleId;
  const isMentor = cm.mentorUserId === userId;
  if (!isMember && !isMentor) throw new Error('This agreement isn’t available.');
  if (cm.status !== 'active' && cm.status !== 'paused') throw new Error('The agreement opens once sessions are booked.');
  return { userId, cm, isMember, isMentor };
}

export async function addAgreementGoal(cmId: string, text: string): Promise<ActionResult> {
  try {
    const { cm, isMember } = await agreementActor(cmId);
    if (!isMember) throw new Error('The Circle sets its goals.');
    const t = cleanText(text, 160);
    if (t.length < 3) throw new Error('Write the goal first.');
    const { count } = await supabaseAdmin.from('agreement_goals').select('id', { count: 'exact', head: true }).eq('circle_mentor_id', cmId);
    if ((count ?? 0) >= MAX_AGREEMENT_GOALS) throw new Error(`Keep it to ${MAX_AGREEMENT_GOALS} goals. Remove one to add another.`);
    const { error } = await supabaseAdmin.from('agreement_goals').insert({ circle_mentor_id: cmId, circle_id: cm.circleId, text: t, position: count ?? 0 });
    if (error) throw error;
    revalidatePath('/sessions');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function removeAgreementGoal(cmId: string, goalId: string): Promise<ActionResult> {
  try {
    const { isMember } = await agreementActor(cmId);
    if (!isMember) throw new Error('The Circle sets its goals.');
    await supabaseAdmin.from('agreement_goals').delete().eq('id', goalId).eq('circle_mentor_id', cmId);
    revalidatePath('/sessions');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function addAgreementTask(cmId: string, task: string, ownerId: string, due: string | null): Promise<ActionResult> {
  try {
    const { cm, isMember } = await agreementActor(cmId);
    if (!isMember) throw new Error('The Circle adds the tasks.');
    const t = cleanText(task, 160);
    if (t.length < 3) throw new Error('Write the task first.');
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new Error('That date isn’t valid.');
    const { data: seat } = await supabaseAdmin.from('circle_seats').select('user_id').eq('circle_id', cm.circleId).eq('user_id', ownerId).eq('role', 'member').maybeSingle();
    if (!seat) throw new Error('A task’s owner must be a member of the Circle.');
    const { error } = await supabaseAdmin.from('agreement_tasks').insert({ circle_mentor_id: cmId, circle_id: cm.circleId, task: t, owner_id: ownerId, due: due || null });
    if (error) throw error;
    revalidatePath('/sessions');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function removeAgreementTask(cmId: string, taskId: string): Promise<ActionResult> {
  try {
    const { isMember } = await agreementActor(cmId);
    if (!isMember) throw new Error('The Circle manages the tasks.');
    await supabaseAdmin.from('agreement_tasks').delete().eq('id', taskId).eq('circle_mentor_id', cmId);
    revalidatePath('/sessions');
    return { ok: true };
  } catch (e) { return fail(e); }
}

/** A task is complete only when its owner and the mentor have both confirmed it. Each side confirms their own part. */
export async function confirmAgreementTask(cmId: string, taskId: string, on: boolean): Promise<ActionResult> {
  try {
    const { userId, isMentor } = await agreementActor(cmId);
    const { data: t } = await supabaseAdmin.from('agreement_tasks').select('id, owner_id').eq('id', taskId).eq('circle_mentor_id', cmId).maybeSingle();
    if (!t) throw new Error('That task isn’t available.');
    const patch: Record<string, boolean> = {};
    if (t.owner_id === userId) patch.owner_confirmed = on;
    if (isMentor) patch.mentor_confirmed = on;
    if (!Object.keys(patch).length) throw new Error('Only the task’s owner and the mentor can confirm it.');
    await supabaseAdmin.from('agreement_tasks').update(patch).eq('id', taskId);
    revalidatePath('/sessions'); revalidatePath('/sessions/mentoring');
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ── swap and pause ──────────────────────────────────────────────────────────

/** One free swap after the first session. The Circle votes again, without the mentor it is leaving. */
export async function requestSwap(cmId: string, reason: string): Promise<ActionResult> {
  try {
    const { circle, member } = await inCircle();
    if (!member) throw new Error('Members suggest a different mentor.');
    const cm = await mentorUserOf(cmId);
    if (cm.circleId !== circle.circle.id || cm.status !== 'active') throw new Error('This mentorship isn’t active.');
    const { data: used } = await supabaseAdmin.from('circle_mentors').select('id').eq('circle_id', circle.circle.id).eq('swap_used', true).limit(1);
    if (used?.length) throw new Error('Your Circle has used its free swap.');
    const { data: first } = await supabaseAdmin.from('circle_mentor_sessions').select('starts_at, duration_min').eq('circle_mentor_id', cmId).order('starts_at').limit(1).maybeSingle();
    if (!first || new Date(first.starts_at as string).getTime() + (first.duration_min as number) * 60000 > Date.now()) throw new Error('You can swap after your first session.');
    await supabaseAdmin.from('circle_mentors').update({ status: 'ended' }).eq('id', cmId);
    await supabaseAdmin.from('circle_mentor_sessions').update({ status: 'cancelled', cancel_reason: `swap: ${cleanText(reason, 120)}` }).eq('circle_mentor_id', cmId).eq('status', 'scheduled');
    const { data: ended } = await supabaseAdmin.from('circle_mentors').select('mentor_id').eq('circle_id', circle.circle.id).in('status', ['ended', 'declined']);
    const id = await openRound(circle.circle.id, true, ((ended ?? []) as { mentor_id: string }[]).map((e) => e.mentor_id));
    await notifyMany(await circleAudience(circle.circle.id), { title: 'Choose a different mentor', body: id ? 'Your Circle is voting again. Vote within 5 days.' : 'No other mentor is available yet. We’ll tell you.', url: '/sessions', tag: 'mentor-swap' });
    revalidatePath('/sessions');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function setPaused(cmId: string, paused: boolean): Promise<ActionResult> {
  try {
    const { circle, facilitator } = await inCircle();
    if (!facilitator && !circle.isFacilitator) throw new Error('The facilitator pauses and resumes sessions.');
    const cm = await mentorUserOf(cmId);
    if (cm.circleId !== circle.circle.id || (cm.status !== 'active' && cm.status !== 'paused')) throw new Error('This mentorship isn’t active.');
    await supabaseAdmin.from('circle_mentors').update({ status: paused ? 'paused' : 'active' }).eq('id', cmId);
    revalidatePath('/sessions');
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ── mentor: capacity (in Circles) and open times ────────────────────────────

async function requireMentor() {
  const { db, userId } = await requireMember();
  const { data: mentor } = await db.from('human_mentors').select('id, capacity').eq('user_id', userId).maybeSingle();
  if (!mentor) throw new Error('This area is for mentors.');
  return { db, userId, mentor: mentor as { id: string; capacity: number } };
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

/** Adds an open 30-minute slot. `local` is "YYYY-MM-DDTHH:mm" in the mentor's own time zone. */
export async function addSlot(local: string): Promise<ActionResult> {
  try {
    const { db, mentor } = await requireMentor();
    const me = await getMe();
    const m = local.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);
    if (!m) throw new Error('Choose a date and time.');
    const at = zonedTimeToUtc(m[1], m[2], me?.tz ?? 'Africa/Lagos');
    if (at.getTime() < Date.now() + 36 * 3600 * 1000) throw new Error('Pick a time at least a day and a half from now, so a Circle has time to choose.');
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
