// app/api/push/commitment-reminder/route.ts
// Secret-protected trigger (x-internal-secret). The scheduled path is
// /api/cron/reminders; both share lib/reminders.ts.
import { NextRequest, NextResponse } from 'next/server';
import { sendCommitmentReminders } from '@/lib/reminders';
import { safeEqual } from '@/lib/security';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret');
  const configuredSecret = process.env.INTERNAL_API_SECRET;
  // Reject if env var unset OR if sent secret is empty / wrong
  if (!safeEqual(secret, configuredSecret)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const notified = await sendCommitmentReminders();
  return NextResponse.json({ ok: true, notified });
}
