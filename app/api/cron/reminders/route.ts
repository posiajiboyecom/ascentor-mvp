// GET /api/cron/reminders
// Daily member reminders: commitments due today + expert sessions starting in
// the next 24h. Authenticates with the CRON_SECRET bearer token (same as the
// other cron routes) and refuses to run when it is unset.
//
// Scheduling: vercel.json currently holds the Hobby plan's two cron jobs. To
// run this daily, either upgrade/replace a job, or call this URL from any
// scheduler with `Authorization: Bearer $CRON_SECRET`.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendCommitmentReminders, sendUpcomingSessionReminders } from '@/lib/reminders';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(req.headers.get('authorization') ?? '');
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error('[cron/reminders] CRON_SECRET is not set - refusing to run');
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 });
  }
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const commitments = await sendCommitmentReminders();
    const sessions = await sendUpcomingSessionReminders();
    return NextResponse.json({ ok: true, commitments, sessions });
  } catch (err) {
    console.error('[cron/reminders] failed:', err);
    return NextResponse.json({ error: 'Reminder run failed' }, { status: 500 });
  }
}
