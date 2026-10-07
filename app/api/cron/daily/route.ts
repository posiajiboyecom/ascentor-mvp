// GET /api/cron/daily
// The single daily job. Vercel's Hobby plan allows two cron jobs, each at most once a day, so everything
// that needs a daily run is chained here instead of consuming one slot per task:
//   1. keep the Supabase project awake (tiny read)
//   2. reconcile payments (settle anything Paystack confirmed that we missed)
//   3. Summit event-day emails (a no-op on every day but the Summit)
//   4. commitment reminders (due today) and session reminders (starting in the next 24 hours)
//   5. member app: announcement start/end, daily practice nudges, quiet-member notices to facilitators
// Each step is isolated: one failing never stops the others. Authenticates with the CRON_SECRET bearer
// token like the other cron routes. The individual routes still exist for manual runs.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { pingDatabase } from '@/lib/keepalive';
import { reconcilePayments } from '@/lib/paymentReconciliation';
import { sendEventDayEmails } from '@/lib/summitEventDay';
import { sendCommitmentReminders, sendUpcomingSessionReminders } from '@/lib/reminders';
import { notifyFacilitatorsOfQuietMembers, sendPracticeReminders, syncAnnouncementStatus } from '@/lib/rx/cron';

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
  const results = [
    await step('keepalive', pingDatabase),
    await step('reconcile-payments', reconcilePayments),
    await step('summit-event-day', () => sendEventDayEmails()),
    await step('commitment-reminders', sendCommitmentReminders),
    await step('session-reminders', sendUpcomingSessionReminders),
    await step('announcement-status', syncAnnouncementStatus),
    await step('practice-reminders', sendPracticeReminders),
    await step('quiet-members', notifyFacilitatorsOfQuietMembers),
  ];

  const ok = results.every((r) => r.ok);
  console.log('[cron/daily]', JSON.stringify(results.map((r) => ({ n: r.name, ok: r.ok, ms: r.ms }))));
  return NextResponse.json({ ok, results }, { status: ok ? 200 : 207 });
}
