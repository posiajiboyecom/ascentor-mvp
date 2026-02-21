// ============================================================
// FEATURE #4: Paystack Payment System — Backend Logic
// Complete webhook handler + subscription management
// Works with test keys; swap to live when ready.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';

// --- Paystack Webhook Handler: /api/payments/webhook ---
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
        console.log(`Paystack webhook: Unhandled event type ${eventType}`);
    }

    // Log to audit trail
    try {
      await supabase.from('audit_logs').insert({
        action: `payment_${eventType}`,
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
  const amount = data.amount / 100; // Paystack amounts are in kobo/cents
  const metadata = data.metadata || {};
  const userId = metadata.user_id;

  if (!userId && !email) {
    console.error('Paystack charge.success: No user_id or email found');
    return;
  }

  // Find user by ID or email
  let profileId = userId;
  if (!profileId && email) {
    const { data: users } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', (
        await supabase.auth.admin.listUsers()
          .then(r => r.data.users.find(u => u.email === email)?.id)
      ))
      .single();
    profileId = users?.id;
  }

  if (!profileId) {
    console.error('Paystack charge.success: User not found for', email);
    return;
  }

  // Calculate subscription end date (30 days from now)
  const subscriptionEnd = new Date();
  subscriptionEnd.setDate(subscriptionEnd.getDate() + 30);

  // Update user profile
  await supabase
    .from('profiles')
    .update({
      subscription_plan: 'standard',
      subscription_status: 'active',
      subscription_tier: 'standard',
      subscription_end: subscriptionEnd.toISOString(),
      payment_method: 'paystack',
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId);

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
  } catch {} // Non-critical

  // Process referral reward if applicable
  await processReferralReward(profileId);

  console.log(`Payment successful: User ${profileId}, Amount ${amount}, Ref ${reference}`);
}

async function handleSubscriptionCreate(data: any) {
  const email = data.customer?.email;
  const subscriptionCode = data.subscription_code;

  // Find user and update with subscription code for future management
  if (email) {
    const { data: user } = await supabase.auth.admin.listUsers()
      .then(r => ({ data: r.data.users.find(u => u.email === email) }));

    if (user) {
      await supabase.from('profiles').update({
        subscription_status: 'active',
        payment_method: 'paystack',
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);
    }
  }
}

async function handleSubscriptionCancel(data: any) {
  const email = data.customer?.email;

  if (email) {
    const { data: user } = await supabase.auth.admin.listUsers()
      .then(r => ({ data: r.data.users.find(u => u.email === email) }));

    if (user) {
      await supabase.from('profiles').update({
        subscription_status: 'cancelled',
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);
    }
  }
}

async function handlePaymentFailed(data: any) {
  const email = data.customer?.email;

  if (email) {
    const { data: user } = await supabase.auth.admin.listUsers()
      .then(r => ({ data: r.data.users.find(u => u.email === email) }));

    if (user) {
      await supabase.from('profiles').update({
        subscription_status: 'past_due',
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);
    }
  }
}

async function processReferralReward(userId: string) {
  try {
    const { data: referral } = await supabase
      .from('referrals')
      .select('*')
      .eq('referred_id', userId)
      .eq('status', 'onboarded')
      .single();

    if (!referral) return;

    // Update referral status
    await supabase.from('referrals').update({
      status: 'subscribed',
    }).eq('id', referral.id);

    // Extend both users' subscriptions by 7 days
    for (const uid of [referral.referrer_id, referral.referred_id]) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_end')
        .eq('id', uid)
        .single();

      if (profile) {
        const currentEnd = profile.subscription_end
          ? new Date(profile.subscription_end)
          : new Date();
        currentEnd.setDate(currentEnd.getDate() + 7);

        await supabase.from('profiles').update({
          subscription_end: currentEnd.toISOString(),
        }).eq('id', uid);
      }
    }

    // Mark as rewarded
    await supabase.from('referrals').update({
      status: 'rewarded',
      referrer_reward: '7_days_free',
      referred_reward: '7_days_free',
      rewarded_at: new Date().toISOString(),
    }).eq('id', referral.id);
  } catch (err) {
    console.error('Referral reward processing error:', err);
  }
}

// --- SQL: payments table ---
export const PAYMENTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount decimal(10,2) NOT NULL,
  currency text DEFAULT 'NGN',
  reference text UNIQUE,
  provider text DEFAULT 'paystack',
  status text DEFAULT 'pending',
  paystack_data jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments" ON payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all payments" ON payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
`;
