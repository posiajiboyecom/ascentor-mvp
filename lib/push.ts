// ─────────────────────────────────────────────────────────────
// lib/push.ts  — server-side Web Push helper
// Used by API routes to send push notifications to a user.
// ─────────────────────────────────────────────────────────────
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:' + (process.env.VAPID_CONTACT_EMAIL || 'hello@ascentor.co'),
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface PushPayload {
  title:  string;
  body:   string;
  icon?:  string;
  url?:   string;
  tag?:   string;
}

/**
 * Send a push notification to a single subscription object.
 * subscription = the JSON from pushSubscriptions table.
 */
export async function sendPush(
  subscription: webpush.PushSubscription,
  payload: PushPayload
): Promise<boolean> {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err: any) {
    // 410 Gone = subscription expired/revoked — caller should delete it
    if (err.statusCode === 410) return false;
    console.error('[push] sendPush error:', err.message);
    return false;
  }
}

/**
 * Send push to ALL subscriptions for a user_id.
 * Deletes expired subscriptions automatically.
 */
export async function sendPushToUser(
  supabase: any,
  userId: string,
  payload: PushPayload
): Promise<void> {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, subscription')
    .eq('user_id', userId);

  if (!subs || subs.length === 0) return;

  const expiredIds: string[] = [];

  await Promise.all(
    subs.map(async (row: any) => {
      const ok = await sendPush(row.subscription as webpush.PushSubscription, payload);
      if (!ok) expiredIds.push(row.id);
    })
  );

  // Clean up expired subscriptions
  if (expiredIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expiredIds);
  }
}
