// GET /api/cron/hourly
// Runs every hour. Things that depend on the member's own clock live here, because the daily job runs once at 06:00 UTC and
// cannot reach people in every time zone at the right moment:
//   1. the practice nudge, in each member's morning (and evening for those who chose two reminders a day)
//   2. the Monday weekly summary, at 8 in the morning where each member is
// Authenticates with the CRON_SECRET bearer token, like the daily job. Safe to repeat: each step checks it has not already sent.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendPracticeReminders, sendWeeklyDigests } from '@/lib/rx/cron';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(req.headers.get('authorization') ?? '');
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function step<T>(name: string, fn: () => Promise<T>) {
  const started = Date.now();
  try { return { name, ok: true, ms: Date.now() - started, result: await fn() }; }
  catch (err) {
    console.error(`[cron/hourly] ${name} failed:`, err);
    return { name, ok: false, ms: Date.now() - started, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error('[cron/hourly] CRON_SECRET is not set - refusing to run');
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 });
  }
  if (!isAuthorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const results = [
    await step('practice-reminders', () => sendPracticeReminders()),
    await step('weekly-digests', () => sendWeeklyDigests()),
  ];
  return NextResponse.json({ ok: results.every((r) => r.ok), results });
}
