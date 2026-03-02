// ============================================================
// PAYMENT VERIFY — /api/payment/verify
// Called after Paystack popup success to verify and activate
//
// SECURITY FIX (S1): userId is now taken from the authenticated
// session, NOT from the request body. A caller cannot activate
// a different user's account by passing an arbitrary userId.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createAuthClient } from '@/lib/supabase/server';

// Service role client — for writes that need to bypass RLS
const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';

export async function POST(req: NextRequest) {
  try {
    // ── 1. AUTHENTICATE SESSION FIRST ──────────────────────────────
    // Get the real user from the session cookie — never trust body userId
    const authClient = await createAuthClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── 2. PARSE BODY (userId from body is IGNORED — session is source of truth) ──
    const { reference, plan, billing } = await req.json();

    if (!reference) {
      return NextResponse.json({ error: 'Missing payment reference' }, { status: 400 });
    }

    // Use session user id — not anything from the request body
    const userId = user.id;

    // ── 3. VERIFY WITH PAYSTACK ─────────────────────────────────────
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
      // Dev mode — no Paystack keys configured
      verified = true;
      paystackData = { reference, status: 'success', amount: 0, currency: 'NGN' };
    }

    if (!verified) {
      return NextResponse.json({ error: 'Payment not verified' }, { status: 400 });
    }

    // ── 4. CALCULATE SUBSCRIPTION END ──────────────────────────────
    const subscriptionEnd = new Date();
    if (billing === 'yearly') {
      subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
      subscriptionEnd.setDate(subscriptionEnd.getDate() + 7); // +7 trial
    } else {
      subscriptionEnd.setDate(subscriptionEnd.getDate() + 37); // 30 days + 7 trial
    }

    // ── 5. ACTIVATE SUBSCRIPTION ───────────────────────────────────
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_plan:   plan || 'standard',
        subscription_status: 'trialing',
        subscription_end:    subscriptionEnd.toISOString(),
        payment_method:      'paystack',
        updated_at:          new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Profile update error:', updateError);
      return NextResponse.json({
        error: 'Payment verified but profile update failed. Contact support.',
      }, { status: 500 });
    }

    // ── 6. RECORD PAYMENT ──────────────────────────────────────────
    try {
      await supabase.from('payments').insert({
        user_id:      userId,
        amount:       paystackData.amount ? paystackData.amount / 100 : 0,
        currency:     paystackData.currency || 'NGN',
        reference,
        provider:     'paystack',
        status:       'success',
        paystack_data: paystackData,
      });
    } catch {} // Non-critical

    // ── 7. AUDIT LOG ───────────────────────────────────────────────
    try {
      await supabase.from('audit_logs').insert({
        user_id:     userId,
        action:      'payment_success',
        entity_type: 'payment',
        entity_id:   reference,
        details:     { plan, billing, amount: paystackData.amount, currency: paystackData.currency },
      });
    } catch {} // Non-critical

    // ── 8. REFERRAL REWARD ─────────────────────────────────────────
    try {
      const { data: referralRecord } = await supabase
        .from('referrals')
        .select('id, referrer_id, status')
        .eq('referred_id', userId)
        .eq('status', 'signed_up')
        .single();

      if (referralRecord) {
        const bonusDays = 7;

        // Extend referred user's subscription
        const { data: referredProfile } = await supabase
          .from('profiles').select('subscription_end').eq('id', userId).single();
        if (referredProfile?.subscription_end) {
          const newEnd = new Date(referredProfile.subscription_end);
          newEnd.setDate(newEnd.getDate() + bonusDays);
          await supabase.from('profiles')
            .update({ subscription_end: newEnd.toISOString() }).eq('id', userId);
        }

        // Extend referrer's subscription
        const { data: referrerProfile } = await supabase
          .from('profiles').select('subscription_end, subscription_status')
          .eq('id', referralRecord.referrer_id).single();
        if (referrerProfile?.subscription_end && referrerProfile.subscription_status !== 'inactive') {
          const refEnd = new Date(referrerProfile.subscription_end);
          refEnd.setDate(refEnd.getDate() + bonusDays);
          await supabase.from('profiles')
            .update({ subscription_end: refEnd.toISOString() })
            .eq('id', referralRecord.referrer_id);
        } else {
          // Referrer not yet subscribed — accumulate bonus days directly
          const { data: refBonus } = await supabase
            .from('profiles').select('referral_bonus_days').eq('id', referralRecord.referrer_id).single();
          const currentBonus = (refBonus?.referral_bonus_days || 0) + bonusDays;
          await supabase.from('profiles')
            .update({ referral_bonus_days: currentBonus })
            .eq('id', referralRecord.referrer_id);
        }

        // Mark referral rewarded + increment referral_count
        await supabase.from('referrals')
          .update({ status: 'rewarded', rewarded_at: new Date().toISOString() })
          .eq('id', referralRecord.id);

        const { data: refCountData } = await supabase
          .from('profiles').select('referral_count').eq('id', referralRecord.referrer_id).single();
        await supabase.from('profiles')
          .update({ referral_count: (refCountData?.referral_count || 0) + 1 })
          .eq('id', referralRecord.referrer_id);

        // Notify referrer
        await supabase.from('notifications').insert({
          user_id: referralRecord.referrer_id,
          type:    'referral_reward',
          title:   'Referral reward unlocked! 🎉',
          message: `Someone you referred just subscribed. You both received ${bonusDays} free days.`,
          link:    '/referral',
        });
      }
    } catch (refErr) {
      console.warn('Referral reward non-critical error:', refErr);
    }

    // ── 9. WELCOME NOTIFICATION ────────────────────────────────────
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        type:    'payment',
        title:   'Welcome to Ascentor! 🎉',
        message: `Your 7-day free trial has started. You won't be charged until day 8.`,
        link:    '/dashboard',
      });
    } catch {} // Non-critical

    return NextResponse.json({
      success:          true,
      plan,
      subscription_end: subscriptionEnd.toISOString(),
    });

  } catch (err: any) {
    console.error('Payment verification error:', err);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
