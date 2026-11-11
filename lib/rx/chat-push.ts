import 'server-only';
// lib/rx/chat-push.ts
// Phone pushes for chat messages: direct messages, Circle chat and group chat. Chats keep their own unread counts,
// so these send a push only (no row in Notifications). They obey the member's "Messages" switch in Settings.
//
//   Direct message: every message, one notification per conversation (the newest replaces the last).
//   Circle chat:    at most once every 5 minutes per member per Circle.
//   Group chat:     at most once every 15 minutes per member per group.
// Demo accounts and the sender never get one. Runs after the response via after(), so sending never slows the chat.

import { after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendPushToUser } from '@/lib/push';
import { isOn } from './notify-rules';

const MESSAGES_PREF = 'Messages';

export interface ChatPush {
  to: string[];
  senderId: string;
  title: string;
  body: string;
  url: string;
  /** One notification per chat on the phone: a newer one replaces the older. */
  tag: string;
  /** Minimum minutes between pushes for this chat, per member. 0 = every message. */
  throttleMinutes: number;
}

/** Keep work running after the response (Vercel stops the function otherwise). Outside a request it simply runs. */
function later(work: Promise<unknown>): void {
  const safe = work.catch((e) => console.error('[chat-push] failed', e instanceof Error ? e.message : e));
  try { after(safe); } catch { /* outside a request scope */ }
}

export function pushChat(p: ChatPush): void { later(send(p)); }

async function send(p: ChatPush): Promise<void> {
  const ids = [...new Set(p.to)].filter((id) => id && id !== p.senderId);
  if (!ids.length) return;

  const { data: profiles } = await supabaseAdmin.from('member_profile').select('user_id, notif, is_demo').in('user_id', ids);
  const by = new Map(((profiles ?? []) as { user_id: string; notif: Record<string, boolean> | null; is_demo: boolean }[]).map((r) => [r.user_id, r]));
  let targets = ids.filter((id) => !by.get(id)?.is_demo && isOn(by.get(id)?.notif ?? null, MESSAGES_PREF));
  if (!targets.length) return;

  if (p.throttleMinutes > 0) {
    const since = new Date(Date.now() - p.throttleMinutes * 60_000).toISOString();
    const { data: recent } = await supabaseAdmin.from('push_throttle').select('user_id').eq('key', p.tag).in('user_id', targets).gte('sent_at', since);
    const skip = new Set(((recent ?? []) as { user_id: string }[]).map((r) => r.user_id));
    targets = targets.filter((id) => !skip.has(id));
    if (!targets.length) return;
    await supabaseAdmin.from('push_throttle').upsert(targets.map((user_id) => ({ user_id, key: p.tag, sent_at: new Date().toISOString() })), { onConflict: 'user_id,key' });
  }

  const body = p.body.length > 140 ? `${p.body.slice(0, 139)}…` : p.body;
  await Promise.allSettled(targets.map((id) => sendPushToUser(supabaseAdmin, id, { title: p.title, body, url: p.url, tag: p.tag })));
}

/** What the push says for a message: plain text, or a word for a voice note or photo. */
export function chatPreview(body: string): string {
  if (/^\[voice:/.test(body)) return 'Sent a voice note';
  if (/^\[img:/.test(body)) return 'Sent a photo';
  return body.replace(/\s+/g, ' ').trim();
}

const firstName = (full: string | null | undefined) => (full ?? 'A member').trim().split(/\s+/)[0] || 'A member';

/** Direct message: push the other person in the conversation. */
export function pushDm(threadId: string, senderId: string, senderName: string | null | undefined, body: string): void {
  later((async () => {
  const { data: t } = await supabaseAdmin.from('dm_threads').select('user_a, user_b').eq('id', threadId).maybeSingle();
  if (!t) return;
  const other = (t.user_a === senderId ? t.user_b : t.user_a) as string;
  await send({ to: [other], senderId, title: firstName(senderName), body: chatPreview(body), url: `/messages?t=${threadId}`, tag: `dm-${threadId}`, throttleMinutes: 0 });
  })());
}

/** Circle chat: push everyone seated in the Circle. */
export function pushCircleChat(circleId: string, senderId: string, senderName: string | null | undefined, body: string): void {
  later((async () => {
  const [{ data: seats }, { data: c }] = await Promise.all([
    supabaseAdmin.from('circle_seats').select('user_id').eq('circle_id', circleId),
    supabaseAdmin.from('circles').select('name, interest, number').eq('id', circleId).maybeSingle(),
  ]);
  const name = c ? `${(c.interest as string | null) ?? (c.name as string)}${c.number ? ` · Circle ${c.number}` : ''}` : 'Your Circle';
  await send({ to: ((seats ?? []) as { user_id: string }[]).map((s) => s.user_id), senderId, title: name, body: `${firstName(senderName)}: ${chatPreview(body)}`, url: `/circle/chat?c=${circleId}`, tag: `circle-${circleId}`, throttleMinutes: 5 });
  })());
}

/** Group chat: push the group's members. */
export function pushGroupChat(groupId: string, senderId: string, senderName: string | null | undefined, body: string): void {
  later((async () => {
  const [{ data: members }, { data: g }] = await Promise.all([
    supabaseAdmin.from('rx_group_members').select('user_id').eq('group_id', groupId).limit(2000),
    supabaseAdmin.from('rx_groups').select('name, slug').eq('id', groupId).maybeSingle(),
  ]);
  await send({ to: ((members ?? []) as { user_id: string }[]).map((m) => m.user_id), senderId, title: (g?.name as string | undefined) ?? 'Your group', body: `${firstName(senderName)}: ${chatPreview(body)}`, url: g?.slug ? `/community/groups/${g.slug}` : '/community', tag: `group-${groupId}`, throttleMinutes: 15 });
  })());
}
