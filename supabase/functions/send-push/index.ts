// Supabase Edge Function: send-push
// Listens to new push_events rows via Supabase Realtime (webhook trigger)
// and fires the actual Web Push notification to each device.
//
// Deploy with:  supabase functions deploy send-push
// Set secrets:  supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_EMAIL=...

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Minimal VAPID Web Push implementation (no npm in Edge Functions)
async function sendWebPush(subscription: any, payload: string, vapidPublic: string, vapidPrivate: string, vapidEmail: string) {
  // Build VAPID JWT
  const audience = new URL(subscription.endpoint).origin;
  const expiry   = Math.floor(Date.now() / 1000) + 12 * 3600;

  const header  = btoa(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).replace(/=/g, '');
  const claims  = btoa(JSON.stringify({ aud: audience, exp: expiry, sub: 'mailto:' + vapidEmail })).replace(/=/g, '');
  const signing = header + '.' + claims;

  // Import VAPID private key
  const keyData = Uint8Array.from(atob(vapidPrivate.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const privKey = await crypto.subtle.importKey(
    'pkcs8', keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );

  const sigBuf  = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privKey,
    new TextEncoder().encode(signing)
  );
  const sig     = btoa(String.fromCharCode(...new Uint8Array(sigBuf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const jwt     = signing + '.' + sig;

  const headers: Record<string, string> = {
    'Authorization':  'vapid t=' + jwt + ', k=' + vapidPublic,
    'Content-Type':   'application/octet-stream',
    'Content-Length': payload.length.toString(),
    'TTL':            '60',
  };

  return fetch(subscription.endpoint, { method: 'POST', headers, body: payload });
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')!;
  const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
  const VAPID_EMAIL   = Deno.env.get('VAPID_EMAIL') || 'hello@ascentor.co';

  // Fetch unsent push_events (batch of 50)
  const { data: events } = await supabase
    .from('push_events')
    .select('*')
    .eq('sent', false)
    .order('created_at')
    .limit(50);

  if (!events || events.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
  }

  let processed = 0;

  for (const event of events) {
    // Get all push subscriptions for this recipient
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, subscription')
      .eq('user_id', event.recipient_id);

    if (subs && subs.length > 0) {
      const payload = JSON.stringify({
        title: event.title,
        body:  event.body,
        url:   event.url || '/dashboard',
        tag:   event.event_type,
        icon:  '/icons/icon-192.png',
      });

      const expiredIds: string[] = [];

      await Promise.all(subs.map(async (sub: any) => {
        try {
          const res = await sendWebPush(sub.subscription, payload, VAPID_PUBLIC, VAPID_PRIVATE, VAPID_EMAIL);
          if (res.status === 410) expiredIds.push(sub.id); // subscription expired
        } catch (err) {
          console.error('Push send error:', err);
        }
      }));

      // Clean up expired subscriptions
      if (expiredIds.length > 0) {
        await supabase.from('push_subscriptions').delete().in('id', expiredIds);
      }
    }

    // Mark as sent
    await supabase.from('push_events').update({ sent: true }).eq('id', event.id);
    processed++;
  }

  return new Response(JSON.stringify({ processed }), { status: 200 });
});
