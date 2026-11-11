'use server';

// Pinnacle private mentor sessions. Every rule is checked here on the server (lib/rx/private-mentor-rules.ts), and the
// database backs the one-a-month rule with a unique index, so a double click can never book two.

import { revalidatePath } from 'next/cache';
import { requireMember, fail } from '@/lib/rx/server';
import type { ActionResult } from '@/lib/rx/types';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cleanText } from '@/lib/rx/safety';
import { rxNotify } from '@/lib/rx/notifications';
import { getMemberAccess } from '@/lib/access';
import { getPrivateSession } from '@/lib/rx/private-mentor';
import { AGENDA_MAX, bookingProblem, memberCanChange, mentorCanCancel, MEMBER_CHANGE_HOURS, PRIVATE_SESSION_MINUTES } from '@/lib/rx/private-mentor-rules';

const when = (iso: string) => `${new Date(iso).toUTCString().slice(0, 22)} UTC`;

function refresh() {
  revalidatePath('/sessions'); revalidatePath('/sessions/private'); revalidatePath('/sessions/mentoring');
}

async function requirePinnacle(): Promise<string> {
  const { userId } = await requireMember();
  const a = await getMemberAccess(userId);
  if (!a.features.privateMentor) {
    throw new Error(a.level === 'light' ? 'Private sessions are paused while your plan is paused. Reactivate in Billing to book.' : 'Private mentor sessions are part of Pinnacle. Change your plan in Billing to book one.');
  }
  return userId;
}

export async function bookPrivateSession(slotId: string, agendaRaw: string): Promise<ActionResult> {
  try {
    const userId = await requirePinnacle();
    if (!/^[0-9a-f-]{36}$/i.test(slotId)) throw new Error('Choose a time.');
    const agenda = cleanText(agendaRaw, AGENDA_MAX + 1);

    const { data: slot } = await supabaseAdmin.from('mentor_slots').select('id, mentor_id, starts_at, taken, human_mentors(user_id, name, active, accepting)').eq('id', slotId).maybeSingle();
    const mentor = (slot?.human_mentors ?? null) as unknown as { user_id: string | null; name: string; active: boolean; accepting: boolean } | null;
    if (!slot || slot.taken || !mentor?.active || !mentor.accepting) throw new Error('That time is no longer free. Pick another.');
    if (mentor.user_id === userId) throw new Error('You can’t book yourself.');

    const { data: mine } = await supabaseAdmin.from('private_mentor_sessions').select('starts_at').eq('member_id', userId).neq('status', 'cancelled');
    const problem = bookingProblem({
      slotStartsAt: new Date(slot.starts_at as string),
      liveSessionStarts: ((mine ?? []) as { starts_at: string }[]).map((r) => new Date(r.starts_at)),
      agenda, now: new Date(),
    });
    if (problem) throw new Error(problem);

    // Claim the slot first, only if it is still free, so two members can never take the same time.
    const { data: claimed } = await supabaseAdmin.from('mentor_slots').update({ taken: true }).eq('id', slotId).eq('taken', false).select('id');
    if (!claimed?.length) throw new Error('Someone has just booked that time. Pick another.');

    const { data: row, error } = await supabaseAdmin.from('private_mentor_sessions').insert({
      member_id: userId, mentor_id: slot.mentor_id, slot_id: slotId, starts_at: slot.starts_at, duration_min: PRIVATE_SESSION_MINUTES, agenda,
    }).select('id').single();
    if (error || !row) {
      await supabaseAdmin.from('mentor_slots').update({ taken: false }).eq('id', slotId);
      if (error?.code === '23505') throw new Error('You already have your private session for that month.');
      throw error ?? new Error('We couldn’t book that time.');
    }

    if (mentor.user_id) {
      void rxNotify(mentor.user_id, {
        kind: 'private_booked', entityId: row.id as string, url: '/sessions/mentoring', actorId: userId,
        title: 'A private session was booked with you',
        body: `${PRIVATE_SESSION_MINUTES} minutes on ${when(slot.starts_at as string)}. The member’s agenda is in your mentor view.`,
      });
    }
    refresh();
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t book that time.'); }
}

export async function updatePrivateAgenda(sessionId: string, agendaRaw: string): Promise<ActionResult> {
  try {
    const { userId } = await requireMember();
    const s = await getPrivateSession(sessionId);
    if (!s || s.memberId !== userId || s.status !== 'scheduled') throw new Error('That session isn’t available.');
    if (!memberCanChange(new Date(s.startsAt), new Date())) throw new Error(`The agenda is locked ${MEMBER_CHANGE_HOURS} hours before the session.`);
    const agenda = cleanText(agendaRaw, AGENDA_MAX + 1);
    if (agenda.length < 10) throw new Error('Write what you want to talk about first.');
    if (agenda.length > AGENDA_MAX) throw new Error(`Keep the agenda under ${AGENDA_MAX} characters.`);
    await supabaseAdmin.from('private_mentor_sessions').update({ agenda, updated_at: new Date().toISOString() }).eq('id', sessionId);
    refresh();
    return { ok: true };
  } catch (e) { return fail(e); }
}

/** The member cancels (until 24 hours before) and gets the month back; the mentor cancels any time before the start. */
export async function cancelPrivateSession(sessionId: string, reasonRaw: string): Promise<ActionResult> {
  try {
    const { userId } = await requireMember();
    const s = await getPrivateSession(sessionId);
    if (!s || s.status !== 'scheduled') throw new Error('That session isn’t available.');
    const isMember = s.memberId === userId;
    const isMentor = !!s.mentorUserId && s.mentorUserId === userId;
    if (!isMember && !isMentor) throw new Error('That session isn’t available.');
    const now = new Date();
    if (isMember && !memberCanChange(new Date(s.startsAt), now)) throw new Error(`It’s less than ${MEMBER_CHANGE_HOURS} hours to go, so the session can’t be cancelled here. Message your mentor instead.`);
    if (isMentor && !mentorCanCancel(new Date(s.startsAt), now)) throw new Error('This session has already started.');
    const reason = cleanText(reasonRaw, 200) || null;

    const { data: done } = await supabaseAdmin.from('private_mentor_sessions').update({
      status: 'cancelled', cancelled_by: isMember ? 'member' : 'mentor', cancel_reason: reason, cancelled_at: now.toISOString(), updated_at: now.toISOString(),
    }).eq('id', sessionId).eq('status', 'scheduled').select('slot_id');
    if (!done?.length) throw new Error('That session has already changed.');
    // A member's cancellation reopens the time for others. A mentor who cancels is not free then, so the time stays closed.
    const slotId = (done[0] as { slot_id: string | null }).slot_id;
    if (isMember && slotId) await supabaseAdmin.from('mentor_slots').update({ taken: false }).eq('id', slotId);

    const other = isMember ? s.mentorUserId : s.memberId;
    if (other) {
      void rxNotify(other, {
        kind: 'private_cancelled', entityId: sessionId, actorId: userId, url: isMember ? '/sessions/mentoring' : '/sessions/private',
        title: isMember ? 'A private session was cancelled' : 'Your mentor cancelled your private session',
        body: `${when(s.startsAt)}${reason ? `: ${reason}` : '.'}${isMember ? '' : ' Your month is free again, so you can book another time.'}`,
      });
    }
    refresh();
    return { ok: true };
  } catch (e) { return fail(e); }
}
