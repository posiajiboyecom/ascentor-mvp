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

    // Process referral reward — extend subscription by 7 days for both referrer and referred
    try {
      // 1. Find if this user was referred
      const { data: referralRecord } = await supabase
        .from('referrals')
        .select('id, referrer_id, status')
        .eq('referred_id', userId)
        .eq('status', 'signed_up')
        .single();

      if (referralRecord) {
        const bonusDays = 7;

        // 2. Extend the referred user's subscription
        const { data: referredProfile } = await supabase
          .from('profiles')
          .select('subscription_end')
          .eq('id', userId)
          .single();

        if (referredProfile?.subscription_end) {
          const newEnd = new Date(referredProfile.subscription_end);
          newEnd.setDate(newEnd.getDate() + bonusDays);
          await supabase.from('profiles')
            .update({ subscription_end: newEnd.toISOString() })
            .eq('id', userId);
        }

        // 3. Extend the referrer's subscription (or bank days if not yet subscribed)
        const { data: referrerProfile } = await supabase
          .from('profiles')
          .select('subscription_end, subscription_status')
          .eq('id', referralRecord.referrer_id)
          .single();

        if (referrerProfile?.subscription_end && referrerProfile.subscription_status !== 'inactive') {
          const refEnd = new Date(referrerProfile.subscription_end);
          refEnd.setDate(refEnd.getDate() + bonusDays);
          await supabase.from('profiles')
            .update({ subscription_end: refEnd.toISOString() })
            .eq('id', referralRecord.referrer_id);
        } else {
          // Referrer not yet subscribed — store credit in referral_bonus_days column
          await supabase.from('profiles')
            .update({ referral_bonus_days: supabase.rpc('coalesce_add', { col: 'referral_bonus_days', val: bonusDays }) })
            .eq('id', referralRecord.referrer_id);
        }

        // 4. Mark referral as rewarded + increment referral_count on referrer
        await supabase.from('referrals')
          .update({ status: 'rewarded', rewarded_at: new Date().toISOString() })
          .eq('id', referralRecord.id);

        await supabase.from('profiles')
          .update({ referral_count: supabase.rpc('increment', { col: 'referral_count', amount: 1 }) })
          .eq('id', referralRecord.referrer_id);

        // 5. Send notification to referrer
        await supabase.from('notifications').insert({
          user_id: referralRecord.referrer_id,
          type: 'referral_reward',
          title: 'Referral reward unlocked! 🎉',
          message: `Someone you referred just subscribed. You both received ${bonusDays} free days added to your account.`,
          link: '/referral',
        });
      }
    } catch (refErr) {
      console.warn('Referral reward non-critical error:', refErr);
    } // Non-critical — payment already verified

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
