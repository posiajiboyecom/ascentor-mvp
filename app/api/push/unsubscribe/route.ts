// POST /api/push/unsubscribe
// Removes a push subscription from the DB (user turned off notifications).
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseJson, parseQuery } from '@/lib/validation/http';
import * as memberSchemas from '@/lib/validation/schemas/member';

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJson(req, memberSchemas.pushUnsubscribe);
    if (!parsed.ok) return parsed.response;
    const { endpoint } = parsed.data;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await supabase.from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[push]', err);
    return NextResponse.json({ error: 'Push unsubscribe failed' }, { status: 500 });
  }
}
