// lib/push.ts - server-side Web Push helper
// IMPORTANT: web-push is a Node.js-only package. This file must only
// be imported from server components, API routes, and trigger tasks.
// Never import it from client components.
import { MAILBOX_EMAIL } from '@/lib/contact';
import webpush from 'web-push';

export interface PushPayload {
  title: string;
  body:  string;
  icon?: string;
  url?:  string;
  tag?:  string;
}

export interface NativeSubscription {
  type:  'native';
  token: string;
}

export interface WebSubscription extends webpush.PushSubscription {
  type?: 'web';
}

export type StoredSubscription = NativeSubscription | WebSubscription;

let vapidInitialised = false;

function initVapid(): boolean {
  if (vapidInitialised) return true;

  const pub  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const mail = process.env.VAPID_CONTACT_EMAIL || MAILBOX_EMAIL;

  if (!pub || !priv) {
    console.warn('[push] VAPID keys not set, push notifications disabled');
    return false;
  }

  webpush.setVapidDetails('mailto:' + mail, pub, priv);
  vapidInitialised = true;
  return true;
}

/**
 * Send a push via Firebase Cloud Messaging (FCM) for native Android + iOS.
 * Placeholder until Phase 5 FCM setup is complete.
 */
async function sendFCMPush(token: string, payload: PushPayload): Promise<void> {
  // TODO (Phase 5): initialise Firebase Admin SDK and send via FCM.
  // Example:
  //   await admin.messaging().send({
  //     token,
  //     notification: { title: payload.title, body: payload.body },
  //     data: { url: payload.url ?? '' },
  //   });
  console.warn('[push] FCM not yet configured, skipping native push for token ending', String(token).slice(-6));
}

/** What happened when a push was sent: for logs and the "Send a test" button. */
export interface PushResult {
  configured: boolean;   // VAPID keys present
  devices: number;       // subscriptions found
  sent: number;
  removed: number;       // expired subscriptions deleted (404/410 only)
  failed: number;        // other errors (kept: they may be temporary)
  errors: string[];      // short reasons, e.g. "403 BadJwtToken"
}

type SendOutcome = { ok: true } | { ok: false; gone: boolean; reason: string };

/**
 * Send a push to a single web PushSubscription object.
 * Only a 404 or 410 means the subscription is gone; any other failure (403 key mismatch, 429, 5xx, network) is
 * reported but the subscription is kept, so one bad moment no longer wipes a member's device.
 */
async function sendOne(subscription: webpush.PushSubscription, payload: PushPayload): Promise<SendOutcome> {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 60 * 60 * 24, urgency: 'high' });
    return { ok: true };
  } catch (err: any) {
    const code = err?.statusCode as number | undefined;
    const reason = `${code ?? 'network'} ${String(err?.body || err?.message || '').slice(0, 80)}`.trim();
    if (code === 404 || code === 410) return { ok: false, gone: true, reason };
    console.error('[push] send failed:', reason);
    return { ok: false, gone: false, reason };
  }
}

/** Kept for existing callers: true when the push was accepted. */
export async function sendPush(subscription: webpush.PushSubscription, payload: PushPayload): Promise<boolean> {
  if (!initVapid()) return false;
  return (await sendOne(subscription, payload)).ok;
}

/**
 * Send a push to every registered device for a given user.
 * Native (FCM) tokens are skipped until FCM is set up. Never throws.
 */
export async function sendPushToUser(
  supabase: any,
  userId: string,
  payload: PushPayload
): Promise<PushResult> {
  const out: PushResult = { configured: initVapid(), devices: 0, sent: 0, removed: 0, failed: 0, errors: [] };
  if (!out.configured) return out;

  const { data: subs, error } = await supabase.from('push_subscriptions').select('id, subscription').eq('user_id', userId);
  if (error) { console.error('[push] db error:', error.message); out.errors.push('database'); return out; }
  if (!subs || subs.length === 0) return out;
  out.devices = subs.length;

  const goneIds: string[] = [];
  await Promise.all(subs.map(async (row: any) => {
    const sub = row.subscription as StoredSubscription;
    if (sub?.type === 'native') { await sendFCMPush(sub.token, payload); return; }
    const r = await sendOne(sub as webpush.PushSubscription, payload);
    if (r.ok) out.sent++;
    else if (r.gone) { goneIds.push(row.id); out.removed++; }
    else { out.failed++; out.errors.push(r.reason); }
  }));

  if (goneIds.length > 0) await supabase.from('push_subscriptions').delete().in('id', goneIds);
  return out;
}
