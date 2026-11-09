// GET /api/cron/referral-invite
// Sends the 2-hour post-registration referral challenge email.
// This route is called by the hourly cron (via app/api/cron/hourly) and can
// also be triggered manually from admin for testing.
// Requires: CRON_SECRET bearer token.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendReferralInviteBatch } from '@/lib/summitReferralInvite';

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
    console.error('[cron/referral-invite] CRON_SECRET is not set');
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 });
  }
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sendReferralInviteBatch();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[cron/referral-invite] failed:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
