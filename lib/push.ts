// ─────────────────────────────────────────────────────────────
// lib/push.ts  — server-side Web Push helper
// IMPORTANT: setVapidDetails() is called lazily inside each
// function — NOT at module level — so the build never crashes
// due to missing env vars at compile time.
// ─────────────────────────────────────────────────────────────
import webpush from 'web-push';

export interface PushPayload {
  title: string;
  body:  string;
  icon?: string;
  url?:  string;
  tag?:  string;
}

function initVapid() {
  const pub  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const mail = process.env.VAPID_CONTACT_EMAIL || 'hello@ascentor.co';

  if (!pub || !priv) {
    throw new Error(
      'VAPID keys not set. Add NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to your environment variables.'
    );
  }

  webpush.setVapidDetails('mailto:' + mail, pub, priv);
}

/**
 * Send a push notification to a single subscription object.
 * Returns false if the subscription is expired (410) — caller should delete it.
 */
export async function sendPush(
  subscription: webpush.PushSubscription,
  payload: PushPayload
): Promise<boolean> {
  initVapid();
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) return false;
    console.error('[push] sendPush error:', err.message);
    return false;
  }
}

/**
 * Send push to ALL subscriptions for a user_id.
 * Automatically removes expired subscriptions.
 */
export async function sendPushToUser(
  supabase: any,
  userId: string,
  payload: PushPayload
): Promise<void> {
  initVapid();

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

  if (expiredIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expiredIds);
  }
}
