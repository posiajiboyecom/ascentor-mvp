// POST /api/push/subscribe
// Saves a user's push subscription to the DB.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { subscription } = await req.json();
    if (!subscription?.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Upsert by endpoint so re-subscribing the same device doesn't duplicate
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        { user_id: user.id, endpoint: subscription.endpoint, subscription },
        { onConflict: 'endpoint' }
      );

    if (error) {
      console.error('[push/subscribe]', error.message);
      console.error('[push]', error);
    return NextResponse.json({ error: 'Push subscription failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[push]', error);
    return NextResponse.json({ error: 'Push subscription failed' }, { status: 500 });
  }
}
