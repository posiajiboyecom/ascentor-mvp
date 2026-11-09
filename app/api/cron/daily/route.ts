// GET /api/cron/daily
// The single daily job. Vercel's Hobby plan allows two cron jobs, each at most once a day, so everything
// that needs a daily run is chained here instead of consuming one slot per task:
//   1. keep the Supabase project awake (tiny read)
//   2. reconcile payments (settle anything Paystack confirmed that we missed)
//   3. Summit event-day emails (a no-op on every day but the Summit)
//   4. commitment reminders (due today) and session reminders (starting in the next 24 hours)
//   5. member app: announcement start/end, quiet-member notices to facilitators, call reminders
//      (practice nudges and the weekly summary run hourly, in /api/cron/hourly, so they land in each member's own morning)
//   6. email campaigns: send queued messages with whatever time is left (Trigger.dev normally does this every 5 minutes)
// Each step is isolated: one failing never stops the others. Authenticates with the CRON_SECRET bearer
// token like the other cron routes. The individual routes still exist for manual runs.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { pingDatabase } from '@/lib/keepalive';
import { reconcilePayments } from '@/lib/paymentReconciliation';
import { sendEventDayEmails } from '@/lib/summitEventDay';
import { sendCommitmentReminders, sendUpcomingSessionReminders } from '@/lib/reminders';
import { dispatch as dispatchEmail } from '@/lib/email/system';
import { formCircles, sendMentorAgendas } from '@/lib/rx/formation';
import { enforceMentorSessionRules, flagSmallCircles, notifyFacilitatorsOfQuietMembers, sendCallReminders, sendLessonReminders, syncAnnouncementStatus } from '@/lib/rx/cron';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Hobby maximum

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(req.headers.get('authorization') ?? '');
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function step<T>(name: string, fn: () => Promise<T>) {
  const started = Date.now();
  try {
    return { name, ok: true, ms: Date.now() - started, result: await fn() };
  } catch (err) {
    console.error(`[cron/daily] ${name} failed:`, err);
    return { name, ok: false, ms: Date.now() - started, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error('[cron/daily] CRON_SECRET is not set - refusing to run');
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 });
  }
  if (!isAuthorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Sequential on purpose: the keep-alive goes first so a cold database wakes before the heavier work.
  const t0 = Date.now();
  const results = [
    await step('keepalive', pingDatabase),
    await step('reconcile-payments', reconcilePayments),
    await step('summit-event-day', () => sendEventDayEmails({ budgetMs: 15_000 })),
    await step('commitment-reminders', sendCommitmentReminders),
    await step('session-reminders', sendUpcomingSessionReminders),
    await step('announcement-status', syncAnnouncementStatus),
    await step('quiet-members', notifyFacilitatorsOfQuietMembers),
    await step('mentor-session-rules', enforceMentorSessionRules),
    await step('small-circles', () => flagSmallCircles()),
    await step('call-reminders', sendCallReminders),
    await step('lesson-reminders', sendLessonReminders),
    // Also hourly; here once a day as a safety net, and the one place admins hear about Circles that can't be settled.
    await step('circle-formation', () => formCircles({ reportWaiting: true })),
    await step('mentor-agendas', () => sendMentorAgendas()),
    // Last, with the time that's left: a safety net in case the Trigger.dev dispatcher isn't deployed.
    await step('email-dispatch', async () => {
      const left = 52_000 - (Date.now() - t0);
      return left > 15_000 ? dispatchEmail({ budgetMs: left, owner: 'cron-daily' }) : { ran: false, reason: 'No time left in this run.' };
    }),
  ];

  const ok = results.every((r) => r.ok);
  console.log('[cron/daily]', JSON.stringify(results.map((r) => ({ n: r.name, ok: r.ok, ms: r.ms }))));
  return NextResponse.json({ ok, results }, { status: ok ? 200 : 207 });
}
