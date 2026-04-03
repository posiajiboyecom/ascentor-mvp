// ================================================================
// POST /api/pay/confirm  — PAYMENT SYSTEM v3
// ================================================================
// Called by checkout/page.tsx immediately after PaystackPop fires
// its success callback with a reference.
//
// Security model:
//   • userId taken from session cookie — never from request body
//   • planId taken from payment_attempts DB record — never from client
//   • Idempotent: safe to call twice with same reference
//   • Webhook (/api/pay/webhook) is the SOURCE OF TRUTH for renewals
//     This route handles first-time activation only
// ================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!

export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const auth = await createAuthClient()
    const { data: { user }, error: authErr } = await auth.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = user.id

    // ── 2. Parse reference ───────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const { reference } = body as { reference?: string }

    if (!reference || typeof reference !== 'string') {
      return NextResponse.json({ error: 'Payment reference is required.' }, { status: 400 })
    }

    // ── 3. Idempotency check ─────────────────────────────────────────────────
    // If this reference was already processed, return success immediately.
    // This prevents double-activation if user clicks back or network retries.
    const { data: existingPayment } = await supabaseAdmin
      .from('payments')
      .select('id, plan_id')
      .eq('reference', reference)
      .maybeSingle()

    if (existingPayment) {
      console.log(`[pay/confirm] ${reference} already processed — returning success`)
      return NextResponse.json({ success: true, alreadyProcessed: true })
    }

    // ── 4. Verify with Paystack ──────────────────────────────────────────────
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
        cache: 'no-store',
      }
    )
    const verifyData = await verifyRes.json()

    if (!verifyData.status || verifyData.data?.status !== 'success') {
      console.error('[pay/confirm] Paystack verification failed:', verifyData.message)
      return NextResponse.json(
        {
          error:
            'Payment could not be verified. If you were charged, contact support with reference: ' +
            reference,
        },
        { status: 400 }
      )
    }

    const psTx = verifyData.data

    // ── 5. Read plan from DB — never trust client ────────────────────────────
    const { data: attempt } = await supabaseAdmin
      .from('payment_attempts')
      .select('plan_id, billing')
      .eq('reference', reference)
      .maybeSingle()

    // Fallback to Paystack metadata if attempt record somehow missing
    const planId  = attempt?.plan_id  ?? psTx.metadata?.plan_id  ?? 'explorer'
    const billing = attempt?.billing  ?? psTx.metadata?.billing  ?? 'monthly'

    // ── 6. Calculate subscription end date ───────────────────────────────────
    const now             = new Date()
    const subscriptionEnd = new Date(now)
    // 7-day trial grace period always applied
    subscriptionEnd.setDate(subscriptionEnd.getDate() + 7)
    if (billing === 'annual') {
      subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1)
    } else {
      subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1)
    }

    // ── 7. Activate subscription in profiles ─────────────────────────────────
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .update({
        subscription_plan:    planId,
        subscription_status:  'trialing',
        subscription_start:   now.toISOString(),
        subscription_end:     subscriptionEnd.toISOString(),
        payment_method:       'paystack',
        onboarding_completed: true,
        updated_at:           now.toISOString(),
      })
      .eq('id', userId)

    if (profileErr) {
      console.error('[pay/confirm] Profile update failed:', profileErr)
      return NextResponse.json(
        {
          error:
            'Payment verified but account activation failed. Contact support with reference: ' +
            reference,
        },
        { status: 500 }
      )
    }

    // ── 8. Record payment (idempotency anchor) ───────────────────────────────
    try {
      await supabaseAdmin.from('payments').insert({
        user_id:       userId,
        reference,
        plan_id:       planId,
        billing,
        amount:        psTx.amount ? psTx.amount / 100 : 0,
        currency:      psTx.currency || 'NGN',
        provider:      'paystack',
        status:        'success',
        paystack_data: psTx,
        created_at:    now.toISOString(),
      })
    } catch (e) {
      // Non-critical — idempotency check above already prevents double-activation
      console.warn('[pay/confirm] payments insert error (non-critical):', e)
    }

    // ── 9. Mark attempt as completed ────────────────────────────────────────
    try {
      await supabaseAdmin
        .from('payment_attempts')
        .update({ status: 'completed', completed_at: now.toISOString() })
        .eq('reference', reference)
    } catch (_) {}

    // ── 10. Welcome notification ─────────────────────────────────────────────
    const planDisplayNames: Record<string, string> = {
      explorer: 'Explorer',
      builder:  'Builder',
      climber:  'Climber',
    }
    try {
      await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        type:    'payment',
        title:   'Welcome to Ascentor! 🎉',
        message: `Your 7-day free trial on the ${planDisplayNames[planId] ?? planId} plan has started. You won't be charged until Day 8.`,
        link:    '/dashboard',
      })
    } catch (_) {}

    // ── 11. Audit log ────────────────────────────────────────────────────────
    try {
      await supabaseAdmin.from('audit_logs').insert({
        user_id:     userId,
        action:      'payment_confirmed',
        entity_type: 'payment',
        entity_id:   reference,
        details:     { planId, billing, amount: psTx.amount, currency: psTx.currency },
      })
    } catch (_) {}

    // ── 12. Referral rewards ─────────────────────────────────────────────────
    try {
      await processReferral(userId, subscriptionEnd)
    } catch (e) {
      console.warn('[pay/confirm] Referral processing error (non-critical):', e)
    }

    return NextResponse.json({
      success:          true,
      plan:             planId,
      subscription_end: subscriptionEnd.toISOString(),
    })

  } catch (err: any) {
    console.error('[pay/confirm] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Confirmation failed. Contact support if you were charged.' },
      { status: 500 }
    )
  }
}

// ── Referral helper ───────────────────────────────────────────────────────────
async function processReferral(userId: string, subscriptionEnd: Date) {
  const BONUS_DAYS = 7

  const { data: referral } = await supabaseAdmin
    .from('referrals')
    .select('id, referrer_id')
    .eq('referred_id', userId)
    .eq('status', 'signed_up')
    .maybeSingle()

  if (!referral) return

  // Extend referred user's subscription
  const extendedEnd = new Date(subscriptionEnd)
  extendedEnd.setDate(extendedEnd.getDate() + BONUS_DAYS)
  await supabaseAdmin
    .from('profiles')
    .update({ subscription_end: extendedEnd.toISOString() })
    .eq('id', userId)

  // Extend referrer
  const { data: referrer } = await supabaseAdmin
    .from('profiles')
    .select('subscription_end, subscription_status, referral_bonus_days, referral_count')
    .eq('id', referral.referrer_id)
    .maybeSingle()

  if (referrer?.subscription_end && referrer.subscription_status !== 'inactive') {
    const refEnd = new Date(referrer.subscription_end)
    refEnd.setDate(refEnd.getDate() + BONUS_DAYS)
    await supabaseAdmin
      .from('profiles')
      .update({
        subscription_end: refEnd.toISOString(),
        referral_count:   (referrer.referral_count || 0) + 1,
      })
      .eq('id', referral.referrer_id)
  } else {
    await supabaseAdmin
      .from('profiles')
      .update({
        referral_bonus_days: (referrer?.referral_bonus_days || 0) + BONUS_DAYS,
        referral_count:      (referrer?.referral_count || 0) + 1,
      })
      .eq('id', referral.referrer_id)
  }

  await supabaseAdmin
    .from('referrals')
    .update({ status: 'rewarded', rewarded_at: new Date().toISOString() })
    .eq('id', referral.id)

  try {
    await supabaseAdmin.from('notifications').insert({
      user_id: referral.referrer_id,
      type:    'referral_reward',
      title:   'Referral reward unlocked! 🎉',
      message: `Someone you referred just subscribed. You both received ${BONUS_DAYS} bonus days.`,
      link:    '/referral',
    })
  } catch (_) {}
}
