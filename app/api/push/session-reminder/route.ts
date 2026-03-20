// app/api/push/session-reminder/route.ts
// Called by a cron/trigger 24h and 1h before an expert session
// to notify all registered attendees.
// Body: { sessionId }

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { notify, NotifyTemplates } from '@/lib/notify';

const service = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret');
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { sessionId } = await req.json();
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

  // Get session details
  const { data: session } = await service
    .from('expert_sessions')
    .select('title, expert_name, scheduled_at')
    .eq('id', sessionId)
    .single();

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  // Get all registered attendees
  const { data: registrations } = await service
    .from('session_registrations')
    .select('user_id')
    .eq('session_id', sessionId);

  if (!registrations?.length) return NextResponse.json({ ok: true, notified: 0 });

  const hoursAway = Math.round(
    (new Date(session.scheduled_at).getTime() - Date.now()) / 3_600_000
  );

  const payload = NotifyTemplates.expertSessionReminder(
    session.title,
    session.expert_name,
    '/experts',
    hoursAway
  );

  await Promise.allSettled(
    registrations.map(r => notify(r.user_id, payload))
  );

  return NextResponse.json({ ok: true, notified: registrations.length });
}
