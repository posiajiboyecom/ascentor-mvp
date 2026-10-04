// Saves APNs/FCM device tokens for native mobile push
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseJson, parseQuery } from '@/lib/validation/http';
import * as memberSchemas from '@/lib/validation/schemas/member';

export async function POST(req: NextRequest) {
  const parsed = await parseJson(req, memberSchemas.pushSubscribeNative);
  if (!parsed.ok) return parsed.response;
  const { token, platform } = parsed.data;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await supabase.from('push_subscriptions').upsert(
    { user_id: user.id, endpoint: token, subscription: { token, platform, type: 'native' } },
    { onConflict: 'endpoint' }
  );
  return NextResponse.json({ ok: true });
}