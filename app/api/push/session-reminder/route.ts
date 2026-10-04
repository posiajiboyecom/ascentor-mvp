// app/api/push/session-reminder/route.ts
// Secret-protected trigger (x-internal-secret) to remind one session's
// attendees. Body: { sessionId }. Shares lib/reminders.ts with the cron job.
import { NextRequest, NextResponse } from 'next/server';
import { sendSessionReminder } from '@/lib/reminders';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret');
  const configuredSecret = process.env.INTERNAL_API_SECRET;
  if (!secret || !configuredSecret || secret !== configuredSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { sessionId } = await req.json().catch(() => ({}));
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

  const notified = await sendSessionReminder(sessionId);
  if (notified === null) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  return NextResponse.json({ ok: true, notified });
}
