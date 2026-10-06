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
import { brandedEmailLayout, esc, p, goldButton } from '@/lib/emailTemplate';
import { sendEmail as sendMail } from '@/lib/nodemailer';

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
  // Email fallback - if omitted, email is not sent even without push
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

// ── Send email via shared SMTP mailer ───────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    await sendMail({ from: 'Ascentor <notifications@ascentorbi.com>', to, subject, html });
    return true;
  } catch (err: any) {
    console.error('[notify] email send error:', err.message);
    return false;
  }
}

// ── Build email HTML from push payload ──────────────────────────────────────
function buildEmailHtml(payload: NotifyPayload, recipient: string): string {
  const url = payload.url
    ? `https://joinascentor.com${payload.url.startsWith('/') ? '' : '/'}${payload.url}`
    : 'https://joinascentor.com/dashboard';

  return brandedEmailLayout({
    preheader: payload.body,
    eyebrow: 'Ascentor Notification',
    heading: payload.title,
    recipient,
    content:
      p(esc(payload.body)) +
      goldButton('View in Ascentor →', url) +
      p('<span style="color:#9CA3AF;font-size:13px;">You are receiving this because you have an Ascentor account. <a href="https://joinascentor.com/account" style="color:#C8A96E;text-decoration:none;">Manage notification preferences</a></span>'),
  });
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
      // Push succeeded - no email needed
      return;
    }

    // No push subscription - fall back to email if subject provided
    if (payload.emailSubject) {
      const email = await getUserEmail(userId);
      if (email) {
        const html = payload.emailHtml || buildEmailHtml(payload, email);
        await sendEmail(email, payload.emailSubject, html);
      }
    }
  } catch (err: any) {
    // Never throw - notifications are non-fatal
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
    body:  `Hey ${firstName}, Sage is ready when you are`,
    url:   '/coach',
    tag:   'welcome',
    emailSubject: 'Welcome to Ascentor, your first session is waiting',
  }),
};
