// ============================================================
// PAYMENT VERIFY — /api/payment/verify
// Called after Paystack popup success to verify and activate
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const { reference, userId, plan, billing } = await req.json();

    if (!reference || !userId) {
      return NextResponse.json({ error: 'Missing reference or userId' }, { status: 400 });
    }

    // Verify with Paystack API
    let verified = false;
    let paystackData: any = null;

    if (PAYSTACK_SECRET) {
      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
      });
      const verifyData = await verifyRes.json();

      if (verifyData.status && verifyData.data?.status === 'success') {
        verified = true;
        paystackData = verifyData.data;
      } else {
        return NextResponse.json({
          error: 'Payment verification failed',
          details: verifyData.message,
        }, { status: 400 });
      }
    } else {
      // Dev mode — no Paystack keys, auto-verify
      verified = true;
      paystackData = { reference, status: 'success', amount: 0, currency: 'NGN' };
    }

    if (!verified) {
      return NextResponse.json({ error: 'Payment not verified' }, { status: 400 });
    }

    // Calculate subscription end date (includes 7-day trial)
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);

    const subscriptionEnd = new Date();
    if (billing === 'yearly') {
      subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
      subscriptionEnd.setDate(subscriptionEnd.getDate() + 7); // +7 days trial
    } else {
      subscriptionEnd.setDate(subscriptionEnd.getDate() + 37); // 30 days + 7 trial
    }

    // Update user profile — start with trialing status
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_plan: plan || 'standard',
        subscription_status: 'trialing',
        subscription_end: subscriptionEnd.toISOString(),
        payment_method: 'paystack',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Profile update error:', updateError);
      return NextResponse.json({
        error: 'Payment verified but profile update failed. Contact support.',
      }, { status: 500 });
    }

    // Record payment
    try {
      await supabase.from('payments').insert({
        user_id: userId,
        amount: paystackData.amount ? paystackData.amount / 100 : 0,
        currency: paystackData.currency || 'NGN',
        reference: reference,
        provider: 'paystack',
        status: 'success',
        paystack_data: paystackData,
      });
    } catch {} // Non-critical

    // Log to audit trail
    try {
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'payment_success',
        entity_type: 'payment',
        entity_id: reference,
        details: {
          plan,
          billing,
          amount: paystackData.amount,
          currency: paystackData.currency,
        },
      });
    } catch {} // Non-critical

    // Process referral reward
    try {
      await supabase.rpc('process_referral_reward', { referred_user_id: userId });
    } catch {} // Non-critical

    // Send notification
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'payment',
        title: 'Welcome to Ascentor! 🎉',
        message: `Your 7-day free trial has started on the ${plan} plan. You won't be charged until day 8.`,
        link: '/dashboard',
      });
    } catch {} // Non-critical

    return NextResponse.json({
      success: true,
      plan,
      subscription_end: subscriptionEnd.toISOString(),
    });
  } catch (err: any) {
    console.error('Payment verification error:', err);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
