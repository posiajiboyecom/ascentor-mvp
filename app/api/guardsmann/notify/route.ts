// POST /api/guardsmann/notify
// Sends a push notification to Posi's phone for Guardsmann events.
//
// Called by:
//   - Job search (when fresh jobs found)
//   - Trigger.dev scheduled task (3× daily auto-search)
//
// Body: { type: 'jobs_found' | 'test', count?: number, roles?: string[], userId?: string }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { sendPushToUser } from '@/lib/push';

const service = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { type = 'test', count = 0, roles = [], topJob = null } = await req.json();

  let title = '';
  let body  = '';
  let url   = '/guardsmann/jobs';

  switch (type) {
    case 'jobs_found':
      title = `⚡ ${count} fresh GRC job${count !== 1 ? 's' : ''} just posted`;
      body  = roles.length > 0
        ? `${roles.slice(0, 2).join(' · ')}${roles.length > 2 ? ` + ${roles.length - 2} more` : ''} — apply now`
        : 'New remote GRC roles posted in the last hour — apply before the queue fills';
      url   = '/guardsmann/jobs';
      break;

    case 'top_job':
      title = `🎯 ${topJob?.title || 'GRC role'} at ${topJob?.company || 'a global company'}`;
      body  = `${topJob?.salary ? topJob.salary + ' · ' : ''}Posted ${topJob?.postedAt || 'just now'} — apply now`;
      url   = topJob?.url || '/guardsmann/jobs';
      break;

    case 'test':
      title = '✅ Guardsmann push notifications working';
      body  = 'You will receive alerts when fresh GRC jobs are posted.';
      url   = '/guardsmann';
      break;

    default:
      title = 'Guardsmann alert';
      body  = 'Check your Guardsmann dashboard';
  }

  try {
    const sent = await sendPushToUser(service, user.id, {
      title,
      body,
      url,
      icon:  '/icon/icon-192.png',
      tag:   `guardsmann-${type}`,
    });

    return NextResponse.json({ ok: true, sent, title, body });
  } catch (err: any) {
    console.error('[guardsmann/notify]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
