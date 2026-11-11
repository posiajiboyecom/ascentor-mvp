// POST /api/push/test
// Sends a test notification to the signed-in member's own devices and says what happened, so a member (or the team)
// can tell "not set up on the server", "no device registered" and "sent" apart. At most once every 30 seconds.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendPushToUser } from '@/lib/push';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const since = new Date(Date.now() - 30_000).toISOString();
  const { data: recent } = await supabaseAdmin.from('push_throttle').select('user_id').eq('user_id', user.id).eq('key', 'test').gte('sent_at', since).maybeSingle();
  if (recent) return NextResponse.json({ error: 'Give it 30 seconds before sending another test.' }, { status: 429 });
  await supabaseAdmin.from('push_throttle').upsert({ user_id: user.id, key: 'test', sent_at: new Date().toISOString() }, { onConflict: 'user_id,key' });

  const r = await sendPushToUser(supabaseAdmin, user.id, { title: 'Ascentor', body: 'Test notification: push is working on this device.', url: '/settings?tab=alerts', tag: 'push-test' });
  const message = !r.configured ? 'Push isn’t set up on the server yet. The team has been told.'
    : r.devices === 0 ? 'No device is registered for you. Turn notifications on here first.'
    : r.sent > 0 ? `Sent to ${r.sent} ${r.sent === 1 ? 'device' : 'devices'}. It should arrive in a few seconds.`
    : r.removed > 0 && r.failed === 0 ? 'That device had expired. Turn notifications off and on again here.'
    : 'Sending failed. Try again in a minute.';
  if (!r.configured || (r.devices > 0 && r.sent === 0)) console.error('[push/test]', JSON.stringify({ configured: r.configured, devices: r.devices, removed: r.removed, failed: r.failed, errors: r.errors.slice(0, 3) }));
  return NextResponse.json({ ok: r.sent > 0, message, devices: r.devices, sent: r.sent });
}
