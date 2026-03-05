// ============================================================
// CANCEL SUBSCRIPTION — /api/subscription/cancel
// Cancels user's Paystack subscription and updates profile.
// Access is maintained until current billing period ends.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { addOrUpdateSubscriber, ML_GROUPS } from '@/lib/mailerlite';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const { userId, reason } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // Get current profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan, subscription_status, subscription_end, payment_method')
      .eq('id', userId)
      .single();

    if (!profile || !['active', 'trialing'].includes(profile.subscription_status)) {
      return NextResponse.json({ error: 'No active subscription to cancel' }, { status: 400 });
    }

    // If paid via Paystack, try to disable the subscription there
    if (profile.payment_method === 'paystack' && PAYSTACK_SECRET) {
      try {
        // Find the Paystack subscription by user email
        const { data: authUser } = await supabase.auth.admin.getUserById(userId);
        if (authUser?.user?.email) {
          // List customer's subscriptions
          const customerRes = await fetch(
            `https://api.paystack.co/subscription?customer=${encodeURIComponent(authUser.user.email)}`,
            { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
          );
          const customerData = await customerRes.json();

          if (customerData.status && customerData.data?.length > 0) {
            // Disable active subscriptions
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
        console.error('Paystack cancellation error:', err);
        // Continue — still cancel on our side even if Paystack fails
      }
    }

    // Update profile — keep access until subscription_end
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
    } catch {} // Non-critical

    // Notification
    try {
      const endDate = profile.subscription_end
        ? new Date(profile.subscription_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : 'the end of your billing period';

      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'info',
        title: 'Subscription Cancelled',
        message: `Your ${profile.subscription_plan} plan has been cancelled. You'll have access until ${endDate}.`,
        link: '/checkout',
      });
    } catch {} // Non-critical

    // Sync cancellation to MailerLite — move from Paid back to Free Users
    try {
      const { data: authData } = await supabase.auth.admin.getUserById(userId);
      const userEmail = authData?.user?.email;
      if (userEmail) {
        await addOrUpdateSubscriber({
          email: userEmail,
          groups: [ML_GROUPS.APP_USERS, ML_GROUPS.FREE_USERS],
          fields: {
            plan:          'free',
            cancelled_at:  new Date().toISOString(),
            cancel_reason: reason || 'user_initiated',
            access_until:  profile.subscription_end || '',
          },
        });
      }
    } catch (mlErr) {
      console.error('[subscription/cancel] MailerLite error (non-fatal):', mlErr);
    }

    return NextResponse.json({
      success: true,
      access_until: profile.subscription_end,
      message: `Your subscription has been cancelled. You'll still have access until your billing period ends.`,
    });
  } catch (err: any) {
    console.error('Subscription cancellation error:', err);
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
  }
}
