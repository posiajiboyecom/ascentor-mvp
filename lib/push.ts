// lib/push.ts — server-side Web Push helper
// IMPORTANT: web-push is a Node.js-only package. This file must only
// be imported from server components, API routes, and trigger tasks.
// Never import it from client components.
import webpush from 'web-push';

export interface PushPayload {
  title: string;
  body:  string;
  icon?: string;
  url?:  string;
  tag?:  string;
}

let vapidInitialised = false;

function initVapid(): boolean {
  if (vapidInitialised) return true;

  const pub  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const mail = process.env.VAPID_CONTACT_EMAIL || 'hello@ascentorbi.com';

  if (!pub || !priv) {
    console.warn('[push] VAPID keys not set — push notifications disabled');
    return false;
  }

  webpush.setVapidDetails('mailto:' + mail, pub, priv);
  vapidInitialised = true;
  return true;
}

/**
 * Send a push to a single PushSubscription object.
 * Returns false if the subscription has expired (caller should delete it).
 */
export async function sendPush(
  subscription: webpush.PushSubscription,
  payload: PushPayload
): Promise<boolean> {
  if (!initVapid()) return false;
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) return false; // expired
    console.error('[push] sendPush error:', err.statusCode, err.message);
    return false;
  }
}

/**
 * Send a push to every registered device for a given user.
 * Silently removes expired subscriptions.
 * Never throws.
 */
export async function sendPushToUser(
  supabase: any,
  userId: string,
  payload: PushPayload
): Promise<void> {
  if (!initVapid()) return;

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, subscription')
    .eq('user_id', userId);

  if (error) { console.error('[push] db error:', error.message); return; }
  if (!subs || subs.length === 0) return;

  const expiredIds: string[] = [];

  await Promise.all(
    subs.map(async (row: any) => {
      const ok = await sendPush(row.subscription as webpush.PushSubscription, payload);
      if (!ok) expiredIds.push(row.id);
    })
  );

  if (expiredIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expiredIds);
  }
}
