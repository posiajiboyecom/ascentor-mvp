import 'server-only';
// lib/rx/live.ts
// Tells open chat screens that a new message is waiting, the moment it is saved.
//
// The server sends a tiny Supabase Realtime broadcast ("new", no content) on the chat's topic. Every open copy of that
// chat (ChatThread, same topic name) then fetches new messages through /api/rx/chat/poll, which checks the reader is
// allowed to see them. So the broadcast carries no message text or sender: it only says "look now".
// This does not depend on database change feeds (postgres_changes), which drop silently when the browser's session
// isn't attached to the socket yet. Those are still listened to as a second signal.

import { after } from 'next/server';
import { createHmac } from 'node:crypto';

export type ChatTopic = 'circle_messages' | 'dm_messages' | 'rx_group_messages';

/** The topic both sides use: the server here, and ChatThread in the browser. */
export const chatTopic = (table: ChatTopic, id: string) => `rx:${table}:${id}`;

async function broadcast(topic: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ topic, event: 'new', payload: { at: Date.now() }, private: false }] }),
    signal: AbortSignal.timeout(4000),
  });
  if (res.status !== 202 && !res.ok) console.error('[live] broadcast failed', res.status);
}

/** Nudge every open copy of this chat. Never throws; runs after the response if called inside a request. */
export function nudgeChat(table: ChatTopic, id: string): void {
  const work = broadcast(chatTopic(table, id)).catch((e) => console.error('[live] broadcast error', e instanceof Error ? e.message : e));
  try { after(work); } catch { /* outside a request scope */ }
}

/**
 * Each member's inbox topic, for "a new message arrived somewhere" nudges (Messages list, desktop dock).
 * Derived from the member's id with a server-only secret, so nobody can listen in on someone else's inbox timing just
 * by knowing their id. The server hands the topic to the member's own page.
 */
export function inboxTopic(userId: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'ascentor-inbox';
  return `rx:inbox:${createHmac('sha256', secret).update(`inbox:${userId}`).digest('hex').slice(0, 32)}`;
}

/** Nudge these members' inboxes. Never throws. */
export function nudgeInbox(userIds: string[]): void {
  const ids = [...new Set(userIds.filter(Boolean))].slice(0, 50);
  if (!ids.length) return;
  const work = Promise.allSettled(ids.map((id) => broadcast(inboxTopic(id))));
  try { after(work); } catch { /* outside a request scope */ }
}
