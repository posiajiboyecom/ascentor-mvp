'use server';

import { revalidatePath } from 'next/cache';
import { requireMember, getMe, namesFor, fail } from '@/lib/rx/server';
import type { ActionResult } from '@/lib/rx/types';
import type { ChatMsg } from '@/lib/rx/chat-types';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { groupMessages } from '@/lib/rx/community';
import { getFeed } from '@/lib/rx/feed';
import { COMMENT_MAX, POST_MEDIA_MAX, REACTION_KINDS, type CommentView, type MediaItem, type PostView, type ReactionKind } from '@/lib/rx/feed-types';
import { cleanText, assessMessage, holdForNewAccount } from '@/lib/rx/safety';
import { flagIfRisky, accountAgeDays } from '@/lib/rx/moderation';
import { isOwnMediaUrl, isOwnPostMedia, parseBody, postMediaKind } from '@/lib/rx/media';
import { excerpt, preparePostBody } from '@/lib/rx/richtext';
import { rxNotify } from '@/lib/rx/notifications';

const NEW_ACCOUNT_DAYS = 7;
const NEW_ACCOUNT_MESSAGE = 'In your first week, posts and comments can’t include links, phone numbers or other apps. Share the idea in words, and add links once your account is a week old.';
const typeFor = (category: string) => (category === 'Wins' ? 'Win' : category === 'Questions' ? 'Question' : category === 'Resources' ? 'Resource' : 'Reflection');
const postUrl = (id: string) => `/community/post/${id}`;

async function newAccountBlocked(userId: string, text: string, html?: string): Promise<boolean> {
  if ((await accountAgeDays(userId)) >= NEW_ACCOUNT_DAYS) return false;
  return (html ? /<a\s/i.test(html) : false) || holdForNewAccount(assessMessage(text));
}

async function recent(table: 'feed_posts' | 'feed_replies', userId: string, minutes: number): Promise<number> {
  const since = new Date(Date.now() - minutes * 60000).toISOString();
  const { count } = await supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since);
  return count ?? 0;
}

// ── posts ───────────────────────────────────────────────────────────────────

export async function createPost(input: { html: string; text?: string; category: string; media?: MediaItem[] }): Promise<ActionResult<{ id: string }>> {
  try {
    const { db, userId } = await requireMember();
    const body = preparePostBody(input.html, input.text);
    if (!body.ok) throw new Error(body.error);

    const { data: cat } = await supabaseAdmin.from('feed_categories').select('name').eq('name', cleanText(input.category, 60)).eq('active', true).maybeSingle();
    if (!cat) throw new Error('Choose a category for your post.');

    const media: MediaItem[] = [];
    for (const m of (input.media ?? []).slice(0, POST_MEDIA_MAX)) {
      if (!m || typeof m.url !== 'string' || !isOwnPostMedia(m.url, userId)) throw new Error('One of the attachments isn’t allowed.');
      media.push({ url: m.url, kind: postMediaKind(m.url) });
    }

    if (await newAccountBlocked(userId, body.text, body.html)) throw new Error(NEW_ACCOUNT_MESSAGE);
    if ((await recent('feed_posts', userId, 60)) >= 10) throw new Error('You’ve posted a lot in the last hour. Take a short break and come back.');

    const { data, error } = await db.from('feed_posts').insert({
      user_id: userId, type: typeFor(cat.name as string), category: cat.name, body: body.text, body_html: body.html, media,
    }).select('id').single();
    if (error) throw error;
    void flagIfRisky('post', data.id as string, userId, body.text);
    revalidatePath('/community');
    return { ok: true, id: data.id as string };
  } catch (e) { return fail(e, 'We couldn’t post that. Please try again.'); }
}

export async function deletePost(postId: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const me = await getMe();
    const q = me?.isStaff ? supabaseAdmin.from('feed_posts').update({ deleted: true }).eq('id', postId) : db.from('feed_posts').update({ deleted: true }).eq('id', postId).eq('user_id', userId);
    const { error } = await q;
    if (error) throw error;
    revalidatePath('/community');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function loadMorePosts(category: string | null, before: string | null): Promise<{ posts: PostView[]; next: string | null }> {
  await requireMember();
  return getFeed({ category, before });
}

// ── reactions ───────────────────────────────────────────────────────────────

export async function setReaction(postId: string, kind: ReactionKind | null): Promise<ActionResult<{ counts: Record<ReactionKind, number> }>> {
  try {
    const { db, userId } = await requireMember();
    if (kind !== null && !(REACTION_KINDS as readonly string[]).includes(kind)) throw new Error('That reaction isn’t available.');
    const { data: post } = await db.from('feed_posts').select('id, user_id, body').eq('id', postId).eq('deleted', false).maybeSingle();
    if (!post) throw new Error('This post isn’t available.');

    const { data: before } = await db.from('feed_reactions').select('kind').eq('post_id', postId).eq('user_id', userId).maybeSingle();
    if (kind === null) {
      const { error } = await db.from('feed_reactions').delete().eq('post_id', postId).eq('user_id', userId);
      if (error) throw error;
    } else {
      const { error } = await db.from('feed_reactions').upsert({ post_id: postId, user_id: userId, kind }, { onConflict: 'post_id,user_id' });
      if (error) throw error;
    }

    const { data: all } = await supabaseAdmin.from('feed_reactions').select('user_id, kind').eq('post_id', postId);
    const rows = (all ?? []) as { user_id: string; kind: ReactionKind }[];
    const counts: Record<ReactionKind, number> = { like: 0, support: 0, insight: 0 };
    for (const r of rows) if (r.kind in counts) counts[r.kind]++;

    // Tell the author about a new reaction (not a change of mind, not a removal, not their own).
    if (kind !== null && !before && post.user_id && post.user_id !== userId) {
      const others = rows.filter((r) => r.user_id !== post.user_id).length;
      const me = await getMe();
      void rxNotify(post.user_id as string, {
        kind: 'post_reaction', actorId: userId, entityId: postId, url: postUrl(postId),
        title: others <= 1 ? `${me?.firstName ?? 'Someone'} reacted to your post` : `${others} people reacted to your post`,
        body: excerpt(post.body as string),
      });
    }
    return { ok: true, counts };
  } catch (e) { return fail(e, 'We couldn’t save that reaction.'); }
}

// ── comments ────────────────────────────────────────────────────────────────

export async function addComment(postId: string, raw: string, parentId?: string | null): Promise<ActionResult<{ comment: CommentView }>> {
  try {
    const { db, userId } = await requireMember();
    const text = cleanText(raw, COMMENT_MAX);
    if (!text) throw new Error('Write a comment first.');
    const { data: post } = await db.from('feed_posts').select('id, user_id, body').eq('id', postId).eq('deleted', false).maybeSingle();
    if (!post) throw new Error('This post isn’t available.');

    type Parent = { id: string; user_id: string | null; post_id: string };
    let parent = null as Parent | null;
    if (parentId) {
      const { data } = await db.from('feed_replies').select('id, user_id, post_id').eq('id', parentId).maybeSingle();
      if (!data || data.post_id !== postId) throw new Error('That comment isn’t available.');
      parent = data as Parent;
    }
    if (await newAccountBlocked(userId, text)) throw new Error(NEW_ACCOUNT_MESSAGE);
    if ((await recent('feed_replies', userId, 60)) >= 30) throw new Error('You’ve commented a lot in the last hour. Take a short break and come back.');

    const { data, error } = await db.from('feed_replies').insert({ post_id: postId, user_id: userId, body: text, parent_id: parent?.id ?? null }).select('id, created_at').single();
    if (error) throw error;
    void flagIfRisky('comment', data.id as string, userId, text);

    const me = await getMe();
    const who = me?.firstName ?? 'Someone';
    const notified = new Set<string>();
    if (parent?.user_id && parent.user_id !== userId) {
      notified.add(parent.user_id);
      void rxNotify(parent.user_id, { kind: 'comment_reply', actorId: userId, entityId: parent.id, url: postUrl(postId), title: `${who} replied to your comment`, body: excerpt(text) });
    }
    if (post.user_id && post.user_id !== userId && !notified.has(post.user_id as string)) {
      void rxNotify(post.user_id as string, { kind: 'post_comment', actorId: userId, entityId: postId, url: postUrl(postId), title: `${who} commented on your post`, body: excerpt(text) });
    }

    revalidatePath('/community');
    return { ok: true, comment: { id: data.id as string, userId, name: 'You', avatarUrl: me?.avatarUrl ?? null, body: text, time: 'Just now', mine: true, parentId: parent?.id ?? null, replies: [] } };
  } catch (e) { return fail(e, 'We couldn’t post that comment.'); }
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const me = await getMe();
    const q = me?.isStaff ? supabaseAdmin.from('feed_replies').delete().eq('id', commentId) : db.from('feed_replies').delete().eq('id', commentId).eq('user_id', userId);
    const { error } = await q;
    if (error) throw error;
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ── sharing and reporting ───────────────────────────────────────────────────

export interface ShareTargets { circles: { id: string; name: string }[]; people: { threadId: string; name: string }[] }

export async function getShareTargets(): Promise<ShareTargets> {
  const { db, userId } = await requireMember();
  const [{ data: seats }, { data: threads }] = await Promise.all([
    db.from('circle_seats').select('circle_id, circles(name, number, interest)').eq('user_id', userId).eq('role', 'member'),
    db.from('dm_threads').select('id, user_a, user_b').eq('status', 'accepted').order('last_message_at', { ascending: false, nullsFirst: false }).limit(20),
  ]);
  const circles = ((seats ?? []) as unknown as { circle_id: string; circles: { name: string; number: number; interest: string | null } | null }[])
    .map((s) => ({ id: s.circle_id, name: s.circles ? (s.circles.interest ? `${s.circles.interest} · Circle ${s.circles.number}` : `${s.circles.name} · Circle ${s.circles.number}`) : 'Circle' }));
  const rows = (threads ?? []) as { id: string; user_a: string; user_b: string }[];
  const others = rows.map((t) => (t.user_a === userId ? t.user_b : t.user_a));
  const names = await namesFor(db, others);
  return { circles, people: rows.map((t, i) => ({ threadId: t.id, name: names.get(others[i])?.name ?? 'Member' })) };
}

export async function sharePost(postId: string, target: 'link' | 'circle' | 'person', targetId?: string): Promise<ActionResult<{ path: string }>> {
  try {
    const { db, userId } = await requireMember();
    const { data: post } = await db.from('feed_posts').select('id, user_id, body').eq('id', postId).eq('deleted', false).maybeSingle();
    if (!post) throw new Error('This post isn’t available.');
    const path = postUrl(postId);
    const text = `Shared a post: ${path}`;

    if (target === 'circle') {
      if (!targetId) throw new Error('Choose a Circle.');
      const { data: seat } = await db.from('circle_seats').select('circle_id').eq('circle_id', targetId).eq('user_id', userId).maybeSingle();
      if (!seat) throw new Error('You can only share into your own Circles.');
      const { error } = await db.from('circle_messages').insert({ circle_id: targetId, user_id: userId, body: text, kind: 'text' });
      if (error) throw error;
    } else if (target === 'person') {
      if (!targetId) throw new Error('Choose a person.');
      const { data: t } = await db.from('dm_threads').select('id, status').eq('id', targetId).maybeSingle();
      if (!t || t.status !== 'accepted') throw new Error('You can share with people you already talk to.');
      const { data: m, error } = await db.from('dm_messages').insert({ thread_id: targetId, sender_id: userId, body: text, flagged: false }).select('created_at').single();
      if (error) throw error;
      await supabaseAdmin.from('dm_threads').update({ last_message_at: m.created_at }).eq('id', targetId);
    } else if (target !== 'link') throw new Error('Choose where to share.');

    await db.from('feed_shares').insert({ post_id: postId, user_id: userId, target, target_id: target === 'link' ? null : targetId ?? null });
    if (target !== 'link' && post.user_id && post.user_id !== userId) {
      const me = await getMe();
      void rxNotify(post.user_id as string, { kind: 'post_share', actorId: userId, entityId: postId, url: path, title: `${me?.firstName ?? 'Someone'} shared your post`, body: excerpt(post.body as string) });
    }
    return { ok: true, path };
  } catch (e) { return fail(e, 'We couldn’t share that.'); }
}

export async function reportContent(kind: 'post' | 'comment', refId: string, reason?: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    if (kind !== 'post' && kind !== 'comment') throw new Error('That can’t be reported here.');
    if (!/^[0-9a-f-]{36}$/i.test(refId)) throw new Error('That can’t be reported here.');
    const { error } = await db.from('rx_reports').insert({ reporter_id: userId, kind, ref_id: refId, reason: cleanText(reason, 500) || null });
    if (error) throw error;
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t send that report.'); }
}

// ── groups ──────────────────────────────────────────────────────────────────

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
