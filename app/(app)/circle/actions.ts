'use server';

import { revalidatePath } from 'next/cache';
import { requireMember, getMe, getMyCircle, assignCircle, fail } from '@/lib/rx/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { rxNotify, circleAudience } from '@/lib/rx/notifications';
import { circleTitle } from '@/lib/rx/circles';
import { CIRCLES_PER_MEMBER } from '@/lib/rx/constants';
import type { ActionResult } from '@/lib/rx/types';
import type { ChatMsg } from '@/lib/rx/chat-types';
import { circleMessages } from '@/lib/rx/circle';
import { cleanText } from '@/lib/rx/safety';
import { plainToHtml } from '@/lib/rx/richtext';
import { flagIfRisky } from '@/lib/rx/moderation';
import { isOwnMediaUrl, parseBody } from '@/lib/rx/media';
import { cleanClientId, findByClientId, isMissingColumn, isUniqueViolation } from '@/lib/rx/client-id';
import { featureBlock } from '@/lib/access';


/** Agrees to the confidentiality pledge. */
export async function pledge(circleId?: string): Promise<ActionResult> {
  try {
    const { db } = await requireMember();
    const c = await getMyCircle('member', circleId);
    if (!c) throw new Error('Your Circle isn’t ready yet.');
    const { error } = await db.rpc('rx_pledge', { cid: c.circle.id });
    if (error) throw error;
    revalidatePath('/circle');
    return { ok: true };
  } catch (e) { return fail(e); }
}

/** Retries Circle placement for a member who has none. */
export async function placeMeInCircle(): Promise<ActionResult> {
  try {
    const { userId } = await requireMember();
    const cid = await assignCircle(userId);
    if (!cid) throw new Error('We couldn’t place you in a Circle just now. Please try again soon.');
    revalidatePath('/circle');
    return { ok: true };
  } catch (e) { return fail(e); }
}

function checkBody(raw: string): string {
  const body = cleanText(raw, 2000);
  if (!body) throw new Error('Write a message first.');
  const p = parseBody(body);
  if (body.startsWith('[') && /^\[(voice|img):/.test(body) && p.kind === 'text') throw new Error('That attachment isn’t allowed.');
  if (p.kind !== 'text' && !isOwnMediaUrl(p.url)) throw new Error('That attachment isn’t allowed.');
  return body;
}

/** `clientId` is the outbox's idempotency key: sending the same id twice posts one message. */
export async function sendCircleMessage(circleId: string, raw: string, clientId?: string): Promise<ActionResult<{ message: ChatMsg }>> {
  try {
    const { db, userId } = await requireMember();
    // Billing v2: Circle chat pauses on light access (members without a v2 row are never blocked).
    const paused = await featureBlock(userId, 'circleChat');
    if (paused) throw new Error(paused);
    const body = checkBody(raw);
    const cid = cleanClientId(clientId);
    const me = await getMe();
    const asMsg = (id: string, createdAt: string): ChatMsg => ({ id, userId, name: me?.fullName ?? 'You', avatarUrl: me?.avatarUrl ?? null, body, createdAt });

    const prior = await findByClientId(db, 'circle_messages', 'user_id', userId, cid);
    if (prior) return { ok: true, message: asMsg(prior.id, prior.created_at) };

    const row = { circle_id: circleId, user_id: userId, body, kind: 'text' };
    const insert = (r: Record<string, unknown>) => db.from('circle_messages').insert(r).select('id, created_at').single();
    let res = await insert(cid ? { ...row, client_id: cid } : row);
    if (res.error && cid) {
      if (isUniqueViolation(res.error)) {
        const again = await findByClientId(db, 'circle_messages', 'user_id', userId, cid);
        if (again) return { ok: true, message: asMsg(again.id, again.created_at) };
      } else if (isMissingColumn(res.error)) {
        res = await insert(row);   // column not migrated yet: post without dedupe
      }
    }
    if (res.error) throw res.error;
    const data = res.data;
    void flagIfRisky('circle', data.id as string, userId, body);
    return { ok: true, message: asMsg(data.id as string, data.created_at as string) };
  } catch (e) { return fail(e, 'We couldn’t send that. Please try again.'); }
}

export async function pollCircleMessages(circleId: string, afterISO: string | null): Promise<ChatMsg[]> {
  const { db, userId } = await requireMember();
  if (await featureBlock(userId, 'circleChat')) return [];
  return circleMessages(db, circleId, afterISO);
}

/** Posts one of the member's own Circle messages to the public Wins board. */
export async function shareWin(messageId: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const { data: m } = await db.from('circle_messages').select('body, user_id').eq('id', messageId).maybeSingle();
    if (!m || m.user_id !== userId) throw new Error('You can only share your own wins.');


    const winText = cleanText(m.body, 1000);
    const winHtml = plainToHtml(winText);
    const { error } = await db.from('feed_posts').insert({ user_id: userId, type: 'Win', category: 'Wins', body: winText, body_html: winHtml });
    if (error) throw error;
    await db.from('circle_messages').update({ is_win: true }).eq('id', messageId);
    revalidatePath('/community');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function saveReport(week: number, kept: string, obstacle: string, next: string, circleId?: string): Promise<ActionResult> {
  try {
    if (!['Kept', 'Partly kept', 'Not kept'].includes(kept)) throw new Error('Choose how this week’s practice went.');
    if (!(week >= 1 && week <= 12)) throw new Error('That week isn’t open yet.');
    const { db, userId } = await requireMember();
    const c = await getMyCircle('member', circleId);
    if (!c) throw new Error('Your Circle isn’t ready yet.');
    const { error } = await db.from('circle_reports').upsert(
      { circle_id: c.circle.id, user_id: userId, week_no: week, kept, obstacle: cleanText(obstacle, 300) || null, next_step: cleanText(next, 500) || null },
      { onConflict: 'circle_id,user_id,week_no' },
    );
    if (error) throw error;
    revalidatePath('/circle/reports');
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t share your report. Please try again.'); }
}

export async function saveReview(carry: string, choice: 'join' | 'break', circleId?: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const c = await getMyCircle('member', circleId);
    if (!c) throw new Error('Your Circle isn’t ready yet.');
    const { error } = await db.from('circle_reviews').upsert(
      { circle_id: c.circle.id, user_id: userId, carry_forward: cleanText(carry, 600) || null, next_choice: choice },
      { onConflict: 'circle_id,user_id' },
    );
    if (error) throw error;
    return { ok: true };
  } catch (e) { return fail(e); }
}

export type NextChoice = 'stay' | 'new' | 'lead' | 'break';

/** Saves the member's choice for cycle 2. Needs migration 20261020 for stay/lead; 'new' falls back to the older 'join' value. */
export async function saveNextChoice(choice: NextChoice, circleId?: string): Promise<ActionResult> {
  try {
    if (!['stay', 'new', 'lead', 'break'].includes(choice)) throw new Error('Choose an option first.');
    const { db, userId } = await requireMember();
    const c = await getMyCircle('member', circleId);
    if (!c) throw new Error('Your Circle isn’t ready yet.');
    const row = (v: string) => ({ circle_id: c.circle.id, user_id: userId, next_choice: v });
    let { error } = await db.from('circle_reviews').upsert(row(choice), { onConflict: 'circle_id,user_id' });
    if (error && (error as { code?: string }).code === '23514') {
      // Constraint not widened yet: keep what we can.
      const legacy = choice === 'new' ? 'join' : choice === 'break' ? 'break' : null;
      if (legacy) ({ error } = await db.from('circle_reviews').upsert(row(legacy), { onConflict: 'circle_id,user_id' }));
      else error = null;
    }
    if (error) throw error;
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ── joining and leaving Circles ─────────────────────────────────────────────

/** Joins a Circle the member chose. Up to three per member, eight seats per Circle, never two people on the last seat. */
export async function joinCircle(circleId: string): Promise<ActionResult<{ name: string }>> {
  try {
    const { userId } = await requireMember();
    if (!/^[0-9a-f-]{36}$/i.test(circleId)) throw new Error('That Circle isn’t available.');
    const { data: c } = await supabaseAdmin.from('circles').select('id, name, number, interest, is_demo, status').eq('id', circleId).maybeSingle();
    if (!c || c.status === 'completed') throw new Error('That Circle isn’t available.');
    const me = await getMe();
    if (c.is_demo && !me?.isStaff) throw new Error('That Circle isn’t available.');

    const { data: result, error } = await supabaseAdmin.rpc('rx_join_circle', { p_user: userId, p_circle: circleId, p_max: CIRCLES_PER_MEMBER });
    if (error) throw error;
    const messages: Record<string, string> = {
      already: 'You’re already in this Circle.',
      full: 'This Circle just filled up. Pick another one.',
      limit: `You can be in up to ${CIRCLES_PER_MEMBER} Circles. Leave one to join another.`,
      closed: 'This Circle has finished its cycle.',
      missing: 'That Circle isn’t available.',
    };
    if (result !== 'ok') throw new Error(messages[result as string] ?? 'We couldn’t add you to that Circle.');

    const title = circleTitle(c as { name: string; number: number; interest: string | null });
    const others = await circleAudience(circleId, { except: userId });
    const { count } = await supabaseAdmin.from('circle_seats').select('user_id', { count: 'exact', head: true }).eq('circle_id', circleId).eq('role', 'member');
    void rxNotify(userId, { kind: 'circle_joined', entityId: circleId, url: `/circle?c=${circleId}`, title: `You joined ${title}`, body: `${count ?? 1} of 8 seats are filled. Say hello in the chat.` });
    void rxNotify(others, {
      kind: 'circle_new_member', actorId: userId, entityId: circleId, url: `/circle?c=${circleId}`,
      title: (count ?? 0) === 6 ? `${title} now has 6 members` : `${me?.firstName ?? 'Someone'} joined ${title}`,
      body: (count ?? 0) === 6 ? 'Weekly calls and the 90-day cycle begin. You can now choose a mentor together.' : `${count ?? 0} of 8 seats are filled.`,
    });
    revalidatePath('/circle');
    return { ok: true, name: title };
  } catch (e) { return fail(e, 'We couldn’t add you to that Circle.'); }
}

/** Leaves an interest Circle. A member's home Circle (the first one they joined) stays. */
export async function leaveCircle(circleId: string): Promise<ActionResult> {
  try {
    const { userId } = await requireMember();
    const { data: seats } = await supabaseAdmin.from('circle_seats').select('circle_id, joined_at').eq('user_id', userId).eq('role', 'member').order('joined_at', { ascending: true });
    const list = (seats ?? []) as { circle_id: string }[];
    if (!list.some((s) => s.circle_id === circleId)) throw new Error('You’re not in that Circle.');
    if (list[0].circle_id === circleId) throw new Error('This is your home Circle, so it stays. Contact the Ascentor team if you need to move.');
    const { error } = await supabaseAdmin.from('circle_seats').delete().eq('circle_id', circleId).eq('user_id', userId).eq('role', 'member');
    if (error) throw error;
    revalidatePath('/circle');
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t leave that Circle.'); }
}
