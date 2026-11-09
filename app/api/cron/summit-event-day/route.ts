// GET /api/cron/summit-event-day
// ─────────────────────────────────────────────────────────────────────────────
// Vercel Cron target (see vercel.json). Fires daily; the handler itself checks
// whether today is actually the Summit day (WAT calendar date) and no-ops
// otherwise, so it is safe to run every day without a separate one-time cron
// to add and remove later. Hobby plan limits: max 2 cron jobs, each at most
// ONCE PER DAY, fired anywhere inside the scheduled hour.
//
// Auth: Vercel sends `Authorization: Bearer <CRON_SECRET>`. Set CRON_SECRET in
// the Vercel project env vars. Without it this endpoint refuses to run.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendEventDayEmails } from '@/lib/summitEventDay';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Hobby maximum

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error('[cron/summit-event-day] CRON_SECRET is not set - refusing to run');
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 });
  }
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await sendEventDayEmails({ budgetMs: 48_000 });
    console.log('[cron/summit-event-day]', JSON.stringify(summary));
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error('[cron/summit-event-day] failed:', err);
    return NextResponse.json({ error: 'Event-day email run failed' }, { status: 500 });
  }
}
