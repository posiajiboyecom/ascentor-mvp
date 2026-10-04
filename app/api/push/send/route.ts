// POST /api/push/send
// Internal route called by DB triggers (via Supabase Edge Function) or
// other API routes when an event occurs (upvote, reply, follow, etc.)
// Body: { userId, title, body, url?, tag?, icon? }
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendPushToUser } from '@/lib/push';
import { parseJson, parseQuery } from '@/lib/validation/http';
import * as memberSchemas from '@/lib/validation/schemas/member';

// Guard: only callable from within the app (service key) or same origin
export async function POST(req: NextRequest) {
  try {
    // Verify internal secret so random callers can't spam notifications
    const secret = req.headers.get('x-push-secret');
    if (secret !== process.env.PUSH_INTERNAL_SECRET) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = await parseJson(req, memberSchemas.pushSend);
    if (!parsed.ok) return parsed.response;
    const { userId, title, body, url, tag, icon } = parsed.data;

    const supabase = await createClient();
    await sendPushToUser(supabase, userId, { title, body, url, tag, icon });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[push]', err);
    return NextResponse.json({ error: 'Push notification failed' }, { status: 500 });
  }
}
