// lib/notify.ts
// ─────────────────────────────────────────────────────────────
// Single helper that:
//   1. Inserts a row into `notifications`  → powers the in-app bell
//   2. Fires a Web Push to the user's phone → native OS notification
//
// Use this everywhere on the server instead of raw supabase.insert.
//
// Example:
//   import { notify } from '@/lib/notify';
//   await notify(supabase, {
//     userId:  recipientId,
//     type:    'community',
//     title:   '💬 New reply on your post',
//     message: `${senderName} replied: "${preview}"`,
//     link:    `/community/${cohortId}`,
//   });
// ─────────────────────────────────────────────────────────────

import { sendPushToUser } from '@/lib/push';

export interface NotifyParams {
  userId:  string;
  type:    string;
  title:   string;
  message: string;
  link?:   string;
}

export async function notify(supabase: any, params: NotifyParams): Promise<void> {
  const { userId, type, title, message, link } = params;

  // 1. In-app notification row (powers the bell icon)
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    message,
    link: link ?? null,
  });
  if (error) console.error('[notify] db error:', error.message);

  // 2. Native push — fire-and-forget so the route stays fast
  sendPushToUser(supabase, userId, {
    title,
    body:  message,
    url:   link ?? '/dashboard',
    tag:   type,
    icon:  '/icons/icon-192.png',
  }).catch((err: any) => console.error('[notify] push error:', err?.message));
}
