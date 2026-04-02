// ============================================================
// CANCEL SUBSCRIPTION — /api/subscription/cancel
//
// CRIT-1 FIX: userId now taken from authenticated session,
// NOT from the request body. Any logged-in user could previously
// cancel another user's subscription by passing their userId.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createAuthClient } from '@/lib/supabase/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';

export async function POST(req: NextRequest) {
  try {
    // ── CRIT-1 FIX: Authenticate session first ──────────────
    const authClient = await createAuthClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // userId ALWAYS from session — never from body
    const userId = user.id;

    // Only read reason from body — userId is ignored
    const body = await req.json().catch(() => ({}));
    const reason: string | undefined = body.reason;

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan, subscription_status, subscription_end, payment_method')
      .eq('id', userId)
      .single();

    if (!profile || !['active', 'trialing'].includes(profile.subscription_status)) {
      return NextResponse.json({ error: 'No active subscription to cancel' }, { status: 400 });
    }

    // Try to cancel on Paystack side if applicable (non-critical)
    if (profile.payment_method && PAYSTACK_SECRET) {
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(userId);
        if (authUser?.user?.email) {
          const customerRes = await fetch(
            `https://api.paystack.co/subscription?customer=${encodeURIComponent(authUser.user.email)}`,
            { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
          );
          const customerData = await customerRes.json();

          if (customerData.status && customerData.data?.length > 0) {
            for (const sub of customerData.data) {
              if (sub.status === 'active') {
                await fetch('https://api.paystack.co/subscription/disable', {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    code: sub.subscription_code,
                    token: sub.email_token,
                  }),
                });
              }
            }
          }
        }
      } catch (err) {
        console.error('[Cancel] Paystack error (non-fatal):', err);
        // Continue — still cancel on our side
      }
    }

    // Mark cancelled — access maintained until subscription_end
    await supabase.from('profiles').update({
      subscription_status: 'cancelled',
      updated_at: new Date().toISOString(),
    }).eq('id', userId);

    // Audit log
    try {
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'subscription_cancelled',
        entity_type: 'payment',
        entity_id: profile.subscription_plan,
        details: {
          plan: profile.subscription_plan,
          reason: reason || 'User initiated',
          access_until: profile.subscription_end,
        },
      });
    } catch { /* non-critical */ }

    // In-app notification
    try {
      const endDate = profile.subscription_end
        ? new Date(profile.subscription_end).toLocaleDateString('en-NG', {
            month: 'long', day: 'numeric', year: 'numeric',
          })
        : 'the end of your billing period';

      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'info',
        title: 'Subscription Cancelled',
        message: `Your ${profile.subscription_plan} plan has been cancelled. You'll have access until ${endDate}.`,
        link: '/checkout',
      });
    } catch { /* non-critical */ }

    return NextResponse.json({
      success: true,
      access_until: profile.subscription_end,
      message: `Your subscription has been cancelled. You'll still have access until your billing period ends.`,
    });

  } catch (err: any) {
    console.error('[Cancel] Error:', err);
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
  }
}
