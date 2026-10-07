'use server';

import { revalidatePath } from 'next/cache';
import { requireMember, getMe, getMyCircle, assignCircle, fail } from '@/lib/rx/server';
import type { ActionResult } from '@/lib/rx/types';
import type { ChatMsg } from '@/lib/rx/chat-types';
import { circleMessages } from '@/lib/rx/circle';
import { cleanText } from '@/lib/rx/safety';
import { isOwnMediaUrl, parseBody } from '@/lib/rx/media';
import { dimensionOf } from '@/lib/rx/constants';

/** Agrees to the confidentiality pledge. */
export async function pledge(): Promise<ActionResult> {
  try {
    const { db } = await requireMember();
    const c = await getMyCircle();
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

export async function sendCircleMessage(circleId: string, raw: string): Promise<ActionResult<{ message: ChatMsg }>> {
  try {
    const { db, userId } = await requireMember();
    const body = checkBody(raw);
    const { data, error } = await db.from('circle_messages').insert({ circle_id: circleId, user_id: userId, body, kind: 'text' }).select('id, created_at').single();
    if (error) throw error;
    const me = await getMe();
    return { ok: true, message: { id: data.id as string, userId, name: me?.fullName ?? 'You', avatarUrl: me?.avatarUrl ?? null, body, createdAt: data.created_at as string } };
  } catch (e) { return fail(e, 'We couldn’t send that. Please try again.'); }
}

export async function pollCircleMessages(circleId: string, afterISO: string | null): Promise<ChatMsg[]> {
  const { db } = await requireMember();
  return circleMessages(db, circleId, afterISO);
}

/** Posts one of the member's own Circle messages to the public Wins board. */
export async function shareWin(messageId: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const me = await getMe();
    const { data: m } = await db.from('circle_messages').select('body, user_id').eq('id', messageId).maybeSingle();
    if (!m || m.user_id !== userId) throw new Error('You can only share your own wins.');
    const first = me?.profile?.interests?.[0];
    const dim = (first && dimensionOf(first)) || 'Character';
    const { error } = await db.from('feed_posts').insert({ user_id: userId, type: 'Win', dimension: dim, body: cleanText(m.body, 1000) });
    if (error) throw error;
    await db.from('circle_messages').update({ is_win: true }).eq('id', messageId);
    revalidatePath('/community');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function saveReport(week: number, kept: string, obstacle: string, next: string): Promise<ActionResult> {
  try {
    if (!['Kept', 'Partly kept', 'Not kept'].includes(kept)) throw new Error('Choose how this week’s practice went.');
    if (!(week >= 1 && week <= 12)) throw new Error('That week isn’t open yet.');
    const { db, userId } = await requireMember();
    const c = await getMyCircle();
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

export async function saveReview(carry: string, choice: 'join' | 'break'): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const c = await getMyCircle();
    if (!c) throw new Error('Your Circle isn’t ready yet.');
    const { error } = await db.from('circle_reviews').upsert(
      { circle_id: c.circle.id, user_id: userId, carry_forward: cleanText(carry, 600) || null, next_choice: choice },
      { onConflict: 'circle_id,user_id' },
    );
    if (error) throw error;
    return { ok: true };
  } catch (e) { return fail(e); }
}
