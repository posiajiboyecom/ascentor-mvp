// GET /api/cron/reconcile-payments
// ─────────────────────────────────────────────────────────────────────────────
// Vercel Cron target (see vercel.json). Hobby plan limits: max 2 cron jobs, each
// at most ONCE PER DAY, fired anywhere inside the scheduled hour. The job is
// therefore a batch sweep, not a per-minute poller.
//
// Auth: Vercel sends `Authorization: Bearer <CRON_SECRET>`. Set CRON_SECRET in
// the Vercel project env vars. Without it this endpoint refuses to run.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { reconcilePayments } from '@/lib/paymentReconciliation';

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
    console.error('[cron/reconcile-payments] CRON_SECRET is not set - refusing to run');
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 });
  }
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await reconcilePayments();
    console.info('[cron/reconcile-payments]', JSON.stringify(summary));
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error('[cron/reconcile-payments] failed:', err);
    return NextResponse.json({ error: 'Reconciliation failed' }, { status: 500 });
  }
}
