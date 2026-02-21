// ============================================================
// PAYSTACK WEBHOOK — /api/payment/webhook
// Receives events from Paystack and updates subscriptions
// Add this URL in Paystack Dashboard → Settings → Webhooks
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();

    // Verify Paystack signature
    if (PAYSTACK_SECRET) {
      const hash = crypto
        .createHmac('sha512', PAYSTACK_SECRET)
        .update(body)
        .digest('hex');
      const signature = req.headers.get('x-paystack-signature');

      if (hash !== signature) {
        console.error('Paystack webhook: Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const event = JSON.parse(body);
    const eventType = event.event;
    const data = event.data;

    console.log(`Paystack webhook: ${eventType}`, data?.reference);

    switch (eventType) {
      case 'charge.success':
        await handleChargeSuccess(data);
        break;

      case 'subscription.create':
        await handleSubscriptionCreate(data);
        break;

      case 'subscription.not_renew':
      case 'subscription.disable':
        await handleSubscriptionCancel(data);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(data);
        break;

      default:
        console.log(`Paystack webhook: Unhandled event ${eventType}`);
    }

    // Audit log
    try {
      await supabase.from('audit_logs').insert({
        action: `webhook_${eventType}`,
        entity_type: 'payment',
        entity_id: data?.reference || data?.id || 'unknown',
        details: {
          event: eventType,
          amount: data?.amount,
          currency: data?.currency,
          customer_email: data?.customer?.email,
          reference: data?.reference,
        },
      });
    } catch {} // Non-critical

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Paystack webhook error:', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// --- Event Handlers ---

async function handleChargeSuccess(data: any) {
  const email = data.customer?.email;
  const reference = data.reference;
  const amount = data.amount / 100; // kobo → NGN
  const metadata = data.metadata || {};
  const userId = metadata.user_id;
  const plan = metadata.plan || 'pro';
  const billingCycle = metadata.billing_cycle || 'monthly';

  // Find user
  let profileId = userId;
  if (!profileId && email) {
    const { data: authData } = await supabase.auth.admin.listUsers();
    const authUser = authData?.users?.find(u => u.email === email);
    profileId = authUser?.id;
  }

  if (!profileId) {
    console.error('Webhook charge.success: User not found for', email);
    return;
  }

  // Calculate subscription end
  const subscriptionEnd = new Date();
  if (billingCycle === 'yearly') {
    subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
  } else {
    subscriptionEnd.setDate(subscriptionEnd.getDate() + 30);
  }

  // Update profile
  await supabase.from('profiles').update({
    subscription_plan: plan,
    subscription_status: 'active',
    subscription_end: subscriptionEnd.toISOString(),
    payment_method: 'paystack',
    updated_at: new Date().toISOString(),
  }).eq('id', profileId);

  // Record payment
  try {
    await supabase.from('payments').insert({
      user_id: profileId,
      amount,
      currency: data.currency || 'NGN',
      reference,
      provider: 'paystack',
      status: 'success',
      paystack_data: data,
    });
  } catch {} // Non-critical — might already exist from verify

  // Process referral
  try {
    await supabase.rpc('process_referral_reward', { referred_user_id: profileId });
  } catch {} // Non-critical

  console.log(`Webhook: Payment success — User ${profileId}, Amount ${amount}, Ref ${reference}`);
}

async function handleSubscriptionCreate(data: any) {
  const email = data.customer?.email;
  if (!email) return;

  const { data: authData } = await supabase.auth.admin.listUsers();
  const user = authData?.users?.find(u => u.email === email);
  if (!user) return;

  await supabase.from('profiles').update({
    subscription_status: 'active',
    payment_method: 'paystack',
    updated_at: new Date().toISOString(),
  }).eq('id', user.id);
}

async function handleSubscriptionCancel(data: any) {
  const email = data.customer?.email;
  if (!email) return;

  const { data: authData } = await supabase.auth.admin.listUsers();
  const user = authData?.users?.find(u => u.email === email);
  if (!user) return;

  await supabase.from('profiles').update({
    subscription_status: 'cancelled',
    updated_at: new Date().toISOString(),
  }).eq('id', user.id);

  // Notify user
  try {
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'warning',
      title: 'Subscription Cancelled',
      message: 'Your subscription has been cancelled. You can still access Pro features until your billing period ends.',
      link: '/checkout',
    });
  } catch {} // Non-critical
}

async function handlePaymentFailed(data: any) {
  const email = data.customer?.email;
  if (!email) return;

  const { data: authData } = await supabase.auth.admin.listUsers();
  const user = authData?.users?.find(u => u.email === email);
  if (!user) return;

  await supabase.from('profiles').update({
    subscription_status: 'past_due',
    updated_at: new Date().toISOString(),
  }).eq('id', user.id);

  // Notify user
  try {
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'error',
      title: 'Payment Failed',
      message: 'Your latest payment failed. Please update your payment method to keep your Pro access.',
      link: '/checkout',
    });
  } catch {} // Non-critical
}
