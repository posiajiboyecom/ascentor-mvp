// Saves APNs/FCM device tokens for native mobile push
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const { token, platform } = await req.json();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await supabase.from('push_subscriptions').upsert(
    { user_id: user.id, endpoint: token, subscription: { token, platform, type: 'native' } },
    { onConflict: 'endpoint' }
  );
  return NextResponse.json({ ok: true });
}