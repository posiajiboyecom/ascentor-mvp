// GET /api/cron/billing
// Hourly billing v2 renewal engine (see lib/billing/engine.ts). Authenticates with the CRON_SECRET bearer token, like the
// daily and hourly jobs. BILLING_V2_CHARGING = off (default, returns at once) | dry (logs would_charge) | live (charges).
// Safe to repeat: charges use an idempotent reference per user per hour.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { runBillingCycle, chargingMode } from '@/lib/billing/engine';

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
    console.error('[cron/billing] CRON_SECRET is not set - refusing to run');
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 });
  }
  if (!isAuthorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (chargingMode() === 'off') return NextResponse.json({ ok: true, mode: 'off' });
  try {
    const summary = await runBillingCycle();
    console.log('[cron/billing]', JSON.stringify(summary));
    return NextResponse.json({ ok: summary.errors === 0, ...summary }, { status: summary.errors === 0 ? 200 : 207 });
  } catch (err) {
    console.error('[cron/billing] failed:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ ok: false, error: 'Billing run failed' }, { status: 500 });
  }
}
