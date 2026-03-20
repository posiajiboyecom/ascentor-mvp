// lib/notify.ts
// ─────────────────────────────────────────────────────────────────────────────
// ASCENTOR UNIFIED NOTIFICATION SYSTEM
//
// Single function: notify(userId, payload)
//
// Tries push notification first (if user has installed the app and enabled
// notifications). Falls back to email via Resend if no push subscription
// exists or if push fails.
//
// Usage:
//   import { notify } from '@/lib/notify';
//   await notify(userId, {
//     title: 'Someone replied to your post',
//     body: 'Check what they said in The Promotion Track',
//     url: '/community/cohort-id',
//     tag: 'community-reply',
//     emailSubject: 'You have a reply in Ascentor',
//     emailHtml: '<p>...</p>',
//   });
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import { sendPushToUser } from '@/lib/push';

const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface NotifyPayload {
  title:        string;
  body:         string;
  url?:         string;
  tag?:         string;
  icon?:        string;
  // Email fallback — if omitted, email is not sent even without push
  emailSubject?: string;
  emailHtml?:   string;
}

// ── Check if user has push subscriptions ────────────────────────────────────
async function hasPushSubscription(userId: string): Promise<boolean> {
  const { data } = await service
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .limit(1);
  return !!(data && data.length > 0);
}

// ── Get user email from auth ─────────────────────────────────────────────────
async function getUserEmail(userId: string): Promise<string | null> {
  const { data } = await service.auth.admin.getUserById(userId);
  return data?.user?.email || null;
}

// ── Send email via Resend ────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.warn('[notify] RESEND_API_KEY not set'); return false; }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: 'Ascentor <notifications@ascentorbi.com>',
        to,
        subject,
        html,
      }),
    });
    return res.ok;
  } catch (err: any) {
    console.error('[notify] email send error:', err.message);
    return false;
  }
}

// ── Build email HTML from push payload ──────────────────────────────────────
function buildEmailHtml(payload: NotifyPayload): string {
  const url = payload.url
    ? `https://ascentorbi.com${payload.url.startsWith('/') ? '' : '/'}${payload.url}`
    : 'https://ascentorbi.com/dashboard';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E5DDD0;">
        <!-- Header -->
        <tr><td style="background:#0C0B08;padding:24px 32px;">
          <img src="https://ascentorbi.com/ascentor-logo-for-dark.svg" alt="Ascentor" height="28" style="display:block;">
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0C0B08;line-height:1.3;">${payload.title}</h2>
          <p style="margin:0 0 28px;font-size:15px;color:#4A4438;line-height:1.6;">${payload.body}</p>
          <a href="${url}" style="display:inline-block;padding:13px 24px;background:#E8A020;color:#0C0B08;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">
            View in Ascentor →
          </a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid #F0E8DC;">
          <p style="margin:0;font-size:11px;color:#9A9080;font-family:'Courier New',monospace;letter-spacing:0.04em;">
            YOU ARE RECEIVING THIS BECAUSE YOU HAVE AN ASCENTOR ACCOUNT.<br>
            <a href="https://ascentorbi.com/account" style="color:#C8841A;text-decoration:none;">MANAGE NOTIFICATION PREFERENCES</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Main notify function ─────────────────────────────────────────────────────
export async function notify(userId: string, payload: NotifyPayload): Promise<void> {
  try {
    const hasPush = await hasPushSubscription(userId);

    if (hasPush) {
      // Try push first
      await sendPushToUser(service, userId, {
        title: payload.title,
        body:  payload.body,
        url:   payload.url,
        tag:   payload.tag,
        icon:  payload.icon || '/icon/icon-192.png',
      });
      // Push succeeded — no email needed
      return;
    }

    // No push subscription — fall back to email if subject provided
    if (payload.emailSubject) {
      const email = await getUserEmail(userId);
      if (email) {
        const html = payload.emailHtml || buildEmailHtml(payload);
        await sendEmail(email, payload.emailSubject, html);
      }
    }
  } catch (err: any) {
    // Never throw — notifications are non-fatal
    console.error('[notify] error:', err.message);
  }
}

// ── Batch notify multiple users ──────────────────────────────────────────────
export async function notifyMany(userIds: string[], payload: NotifyPayload): Promise<void> {
  await Promise.allSettled(userIds.map(id => notify(id, payload)));
}

// ── Pre-built notification templates ────────────────────────────────────────
export const NotifyTemplates = {

  communityReply: (replierName: string, cohortName: string, postUrl: string) => ({
    title: `${replierName} replied to your post`,
    body:  `See what they said in ${cohortName}`,
    url:   postUrl,
    tag:   'community-reply',
    emailSubject: `${replierName} replied to your post in Ascentor`,
  }),

  communityUpvote: (cohortName: string, postUrl: string) => ({
    title: 'Your post got an upvote',
    body:  `People are engaging with your post in ${cohortName}`,
    url:   postUrl,
    tag:   'community-upvote',
    emailSubject: 'Your Ascentor post is getting attention',
  }),

  expertSessionReminder: (sessionTitle: string, expertName: string, sessionUrl: string, hoursAway: number) => ({
    title: `Session in ${hoursAway} hour${hoursAway !== 1 ? 's' : ''}`,
    body:  `${sessionTitle} with ${expertName} is coming up`,
    url:   sessionUrl,
    tag:   'session-reminder',
    emailSubject: `Reminder: "${sessionTitle}" starts in ${hoursAway} hour${hoursAway !== 1 ? 's' : ''}`,
  }),

  sageCommitmentDue: (commitmentText: string) => ({
    title: 'Commitment due today',
    body:  commitmentText,
    url:   '/coach',
    tag:   'commitment-due',
    emailSubject: 'Your Ascentor commitment is due today',
  }),

  weeklyDigest: (insights: string) => ({
    title: 'Your weekly Ascentor digest',
    body:  insights,
    url:   '/dashboard',
    tag:   'weekly-digest',
    emailSubject: 'Your Ascentor week in review',
  }),

  newCohortActivity: (cohortName: string, cohortUrl: string) => ({
    title: `New activity in ${cohortName}`,
    body:  'Someone posted in your community circle',
    url:   cohortUrl,
    tag:   'cohort-activity',
    emailSubject: `New post in ${cohortName} on Ascentor`,
  }),

  welcomeToApp: (firstName: string) => ({
    title: 'Welcome to Ascentor',
    body:  `Hey ${firstName} — Sage is ready when you are`,
    url:   '/coach',
    tag:   'welcome',
    emailSubject: 'Welcome to Ascentor — your first session is waiting',
  }),
};
