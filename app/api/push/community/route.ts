// POST /api/push/community
// Fires a native Web Push notification for community events
// (upvotes and replies). Called client-side after the DB insert
// because web-push requires Node.js and cannot run in the browser.
//
// Body: { targetUserId, title, body, url }
// Auth: the calling user must be authenticated (any member can trigger
//       a push to another member via community interaction).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendPushToUser } from '@/lib/push';

export async function POST(req: NextRequest) {
  try {
    // Verify the caller is authenticated
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { targetUserId, title, body, url } = await req.json();

    if (!targetUserId || !title || !body) {
      return NextResponse.json({ error: 'targetUserId, title and body required' }, { status: 400 });
    }

    // Don't push to yourself (belt-and-suspenders — client already checks)
    if (targetUserId === user.id) {
      return NextResponse.json({ ok: true, skipped: 'self' });
    }

    await sendPushToUser(supabase, targetUserId, {
      title,
      body,
      url:  url || '/community',
      tag:  'community',
      icon: '/icons/icon-192.png',
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // Push failure is non-critical — log but return 200 so client doesn't retry
    console.error('[push/community]', err.message);
    return NextResponse.json({ ok: true, error: err.message });
  }
}
