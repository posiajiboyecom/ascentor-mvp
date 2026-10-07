'use server';

import { revalidatePath } from 'next/cache';
import { requireMember, getMe, getMyCircle, fail } from '@/lib/rx/server';
import type { ActionResult } from '@/lib/rx/types';
import type { ChatMsg } from '@/lib/rx/chat-types';
import { dmMessages } from '@/lib/rx/messages';
import { assessMessage, cleanText, holdForNewAccount } from '@/lib/rx/safety';
import { accountAgeDays, accountGate, flagIfRisky } from '@/lib/rx/moderation';
import { isOwnMediaUrl, parseBody } from '@/lib/rx/media';
import { supabaseAdmin } from '@/lib/supabase/admin';

function checkBody(raw: string): string {
  const body = cleanText(raw, 2000);
  if (!body) throw new Error('Write a message first.');
  const p = parseBody(body);
  if (/^\[(voice|img):/.test(body) && p.kind === 'text') throw new Error('That attachment isn’t allowed.');
  if (p.kind !== 'text' && !isOwnMediaUrl(p.url)) throw new Error('That attachment isn’t allowed.');
  return body;
}

/**
 * Opens (or finds) the conversation with another member. People in the same Circle talk freely; anyone else
 * starts as a message request that the recipient can accept or decline.
 */
export async function openThread(otherId: string): Promise<ActionResult<{ threadId: string }>> {
  try {
    const { db, userId } = await requireMember();
    if (otherId === userId) throw new Error('That’s you.');

    const { data: existing } = await db.from('dm_threads').select('id, status').or(`and(user_a.eq.${userId},user_b.eq.${otherId}),and(user_a.eq.${otherId},user_b.eq.${userId})`).maybeSingle();
    if (existing) {
      if (existing.status === 'declined' || existing.status === 'blocked') throw new Error('You can’t message this member.');
      return { ok: true, threadId: existing.id as string };
    }

    // The recipient's rules and blocks. Read with the service role; the answer is never revealed beyond a generic refusal.
    const [{ data: theirs }, { data: block }] = await Promise.all([
      supabaseAdmin.from('member_profile').select('dm_policy').eq('user_id', otherId).maybeSingle(),
      supabaseAdmin.from('dm_blocks').select('blocker_id').eq('blocker_id', otherId).eq('blocked_id', userId).maybeSingle(),
    ]);
    if (block) throw new Error('You can’t message this member.');

    const circle = await getMyCircle();
    let sameCircle = false;
    if (circle) {
      const { data: seat } = await supabaseAdmin.from('circle_seats').select('user_id').eq('circle_id', circle.circle.id).eq('user_id', otherId).maybeSingle();
      sameCircle = !!seat;
      // A Circle's own mentor and its members can talk freely, as the mentor sits inside that Circle's agreement.
      if (!sameCircle) {
        const { data: mentorOfMyCircle } = await supabaseAdmin.from('circle_mentors').select('id, human_mentors!inner(user_id)').eq('circle_id', circle.circle.id).in('status', ['scheduling', 'active', 'paused']).eq('human_mentors.user_id', otherId).maybeSingle();
        sameCircle = !!mentorOfMyCircle;
      }
    }
    if (!sameCircle) {
      const { data: mine } = await supabaseAdmin.from('human_mentors').select('id').eq('user_id', userId).maybeSingle();
      if (mine) {
        const { data: theirSeats } = await supabaseAdmin.from('circle_seats').select('circle_id').eq('user_id', otherId);
        const cids = ((theirSeats ?? []) as { circle_id: string }[]).map((x) => x.circle_id);
        if (cids.length) {
          const { data: cm } = await supabaseAdmin.from('circle_mentors').select('id').eq('mentor_id', mine.id).in('circle_id', cids).in('status', ['scheduling', 'active', 'paused']).maybeSingle();
          sameCircle = !!cm;
        }
      }
    }
    if (!sameCircle) {
      // Outside the Circle: new accounts cannot start conversations, and nobody can flood people with requests.
      const gate = await accountGate(userId);
      if (!gate.ok) throw new Error(gate.reason);
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [{ count: today }, { count: pending }] = await Promise.all([
        supabaseAdmin.from('dm_threads').select('id', { count: 'exact', head: true }).eq('requested_by', userId).gte('created_at', since),
        supabaseAdmin.from('dm_threads').select('id', { count: 'exact', head: true }).eq('requested_by', userId).eq('status', 'request'),
      ]);
      if ((today ?? 0) >= 5) throw new Error('You have sent several requests today. Try again tomorrow.');
      if ((pending ?? 0) >= 15) throw new Error('You have many requests waiting. Wait for replies before sending more.');
    }
    const policy = (theirs?.dm_policy as string | undefined) ?? 'circle_and_requests';
    if (!sameCircle && policy === 'none') throw new Error('This member isn’t taking new messages.');
    if (!sameCircle && policy === 'circle_and_mentor') throw new Error('This member isn’t taking new messages.');

    const { data: t, error } = await db.from('dm_threads').insert({ user_a: userId, user_b: otherId, requested_by: userId, status: 'request' }).select('id').single();
    if (error) throw error;
    // Same-Circle conversations skip the request step. The recipient-only update policy means the service role does this.
    if (sameCircle) await supabaseAdmin.from('dm_threads').update({ status: 'accepted' }).eq('id', t.id);
    return { ok: true, threadId: t.id as string };
  } catch (e) { return fail(e, 'We couldn’t start that conversation.'); }
}

export async function sendDm(threadId: string, raw: string): Promise<ActionResult<{ message: ChatMsg }>> {
  try {
    const { db, userId } = await requireMember();
    const body = checkBody(raw);
    const { data: t } = await db.from('dm_threads').select('status, requested_by').eq('id', threadId).maybeSingle();
    if (!t) throw new Error('This conversation isn’t available.');
    if (t.status === 'request') {
      if (t.requested_by !== userId) throw new Error('Accept the request to reply.');
      const { count } = await db.from('dm_messages').select('id', { count: 'exact', head: true }).eq('thread_id', threadId);
      if ((count ?? 0) >= 1) throw new Error('Wait for them to accept your request before sending more.');
      // A first message from a new account cannot carry links, phone numbers or a hand-off to another app.
      if (holdForNewAccount(assessMessage(body)) && (await accountAgeDays(userId)) < 30) {
        throw new Error('A first message cannot include links, phone numbers or other apps while your account is new. Say hello in words, and share more once they accept.');
      }
    } else if (t.status !== 'accepted') throw new Error('This conversation isn’t available.');

    const { data, error } = await db.from('dm_messages').insert({ thread_id: threadId, sender_id: userId, body, flagged: assessMessage(body).flagged }).select('id, created_at').single();
    if (error) throw error;
    await supabaseAdmin.from('dm_threads').update({ last_message_at: data.created_at }).eq('id', threadId);
    void flagIfRisky('dm', data.id as string, userId, body);
    const me = await getMe();
    revalidatePath('/messages');
    return { ok: true, message: { id: data.id as string, userId, name: me?.fullName ?? 'You', avatarUrl: me?.avatarUrl ?? null, body, createdAt: data.created_at as string } };
  } catch (e) { return fail(e, 'We couldn’t send that. Please try again.'); }
}

export async function pollDm(threadId: string, afterISO: string | null): Promise<ChatMsg[]> {
  const { db } = await requireMember();
  return dmMessages(db, threadId, afterISO);
}

export async function answerRequest(threadId: string, accept: boolean): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const { data: t } = await db.from('dm_threads').select('requested_by, status').eq('id', threadId).maybeSingle();
    if (!t || t.requested_by === userId || t.status !== 'request') throw new Error('This request isn’t available.');
    const { error } = await db.from('dm_threads').update({ status: accept ? 'accepted' : 'declined' }).eq('id', threadId);
    if (error) throw error;
    revalidatePath('/messages');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function blockMember(threadId: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const { data: t } = await db.from('dm_threads').select('user_a, user_b').eq('id', threadId).maybeSingle();
    if (!t) throw new Error('This conversation isn’t available.');
    const other = t.user_a === userId ? t.user_b : t.user_a;
    const { error } = await db.from('dm_blocks').upsert({ blocker_id: userId, blocked_id: other }, { onConflict: 'blocker_id,blocked_id' });
    if (error) throw error;
    revalidatePath('/messages');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function reportThread(kind: 'dm' | 'circle' | 'group', refId: string, reason?: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const { error } = await db.from('rx_reports').insert({ reporter_id: userId, kind, ref_id: refId, reason: cleanText(reason, 500) || null });
    if (error) throw error;
    return { ok: true };
  } catch (e) { return fail(e); }
}
