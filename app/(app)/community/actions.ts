'use server';

import { revalidatePath } from 'next/cache';
import { requireMember, getMe, fail } from '@/lib/rx/server';
import type { ActionResult } from '@/lib/rx/types';
import type { ChatMsg } from '@/lib/rx/chat-types';
import { groupMessages } from '@/lib/rx/community';
import { cleanText } from '@/lib/rx/safety';
import { flagIfRisky } from '@/lib/rx/moderation';
import { isOwnMediaUrl, parseBody } from '@/lib/rx/media';
import { DIMENSIONS, POST_TYPES } from '@/lib/rx/constants';

export async function createPost(input: { text: string; type: string; dimension: string; sub?: string }): Promise<ActionResult<{ type: string }>> {
  try {
    const { db, userId } = await requireMember();
    const text = cleanText(input.text, 1500);
    if (!text) throw new Error('Write something first.');
    if (!(POST_TYPES as readonly string[]).includes(input.type)) throw new Error('Choose a post type.');
    if (!(DIMENSIONS as string[]).includes(input.dimension)) throw new Error('Choose one dimension tag.');
    const { error } = await db.from('feed_posts').insert({ user_id: userId, type: input.type, dimension: input.dimension, sub: cleanText(input.sub, 60) || null, body: text });
    if (error) throw error;
    revalidatePath('/community');
    return { ok: true, type: input.type };
  } catch (e) { return fail(e, 'We couldn’t post that. Please try again.'); }
}

export async function replyToPost(postId: string, body: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const text = cleanText(body, 1000);
    if (!text) throw new Error('Write a reply first.');
    const { error } = await db.from('feed_replies').insert({ post_id: postId, user_id: userId, body: text });
    if (error) throw error;
    revalidatePath('/community');
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t post that reply.'); }
}

export async function deletePost(postId: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const { error } = await db.from('feed_posts').update({ deleted: true }).eq('id', postId).eq('user_id', userId);
    if (error) throw error;
    revalidatePath('/community');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function joinGroup(groupId: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const { error } = await db.from('rx_group_members').upsert({ group_id: groupId, user_id: userId }, { onConflict: 'group_id,user_id', ignoreDuplicates: true });
    if (error) throw error;
    const { data: g } = await db.from('rx_groups').select('is_general').eq('id', groupId).maybeSingle();
    if (g?.is_general) await db.from('member_profile').update({ oh_invite: 'joined' }).eq('user_id', userId);
    revalidatePath('/community/groups');
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t add you to that group.'); }
}

export async function leaveGroup(groupId: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const { error } = await db.from('rx_group_members').delete().eq('group_id', groupId).eq('user_id', userId);
    if (error) throw error;
    revalidatePath('/community/groups');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function declineOpenHouse(): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    await db.from('member_profile').update({ oh_invite: 'later' }).eq('user_id', userId).eq('oh_invite', 'pending');
    revalidatePath('/community/groups');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function requestGroup(text: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const t = cleanText(text, 300);
    if (!t) throw new Error('Tell us what kind of group you’re looking for.');
    const { error } = await db.from('rx_group_requests').insert({ user_id: userId, text: t });
    if (error) throw error;
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function sendGroupMessage(groupId: string, raw: string): Promise<ActionResult<{ message: ChatMsg }>> {
  try {
    const { db, userId } = await requireMember();
    const body = cleanText(raw, 2000);
    if (!body) throw new Error('Write a message first.');
    const p = parseBody(body);
    if (/^\[(voice|img):/.test(body) && p.kind === 'text') throw new Error('That attachment isn’t allowed.');
    if (p.kind !== 'text' && !isOwnMediaUrl(p.url)) throw new Error('That attachment isn’t allowed.');
    const { data, error } = await db.from('rx_group_messages').insert({ group_id: groupId, user_id: userId, body }).select('id, created_at').single();
    if (error) throw error;
    void flagIfRisky('group', data.id as string, userId, body);
    const me = await getMe();
    return { ok: true, message: { id: data.id as string, userId, name: me?.fullName ?? 'You', avatarUrl: me?.avatarUrl ?? null, body, createdAt: data.created_at as string } };
  } catch (e) { return fail(e, 'We couldn’t send that. Join the group to post.'); }
}

export async function pollGroupMessages(groupId: string, afterISO: string | null): Promise<ChatMsg[]> {
  const { db } = await requireMember();
  return groupMessages(db, groupId, afterISO);
}
