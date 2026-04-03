// ================================================================
// POST /api/pay/confirm  — NEW PAYMENT SYSTEM v2
// ================================================================
// Called by checkout/page.tsx after Paystack popup fires callback.
//
// Rules:
//   • Auth: user MUST be logged in (session cookie)
//   • Verifies reference with Paystack
//   • Idempotent: safe to call twice with same reference
//   • Reads planId from payment_attempts (server-side — never trusts client)
//   • Activates subscription in profiles
//   • Records payment in payments table
//   • Fires referral rewards if applicable
//   • Sends welcome notification
// ================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!

export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth ───────────────────────────────────────────────────
    const auth = await createAuthClient()
    const { data: { user }, error: authErr } = await auth.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = user.id

    // ── 2. Parse body ─────────────────────────────────────────────
    const { reference } = await req.json()
    if (!reference || typeof reference !== 'string') {
      return NextResponse.json({ error: 'Payment reference is required.' }, { status: 400 })
    }

    // ── 3. Idempotency check ──────────────────────────────────────
    const { data: existing } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('reference', reference)
      .maybeSingle()

    if (existing) {
      console.log(`[pay/confirm] ${reference} already processed — returning success`)
      return NextResponse.json({ success: true, alreadyProcessed: true })
    }

    // ── 4. Verify with Paystack ───────────────────────────────────
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    )
    const verifyData = await verifyRes.json()

    if (!verifyData.status || verifyData.data?.status !== 'success') {
      console.error('[pay/confirm] Paystack verification failed:', verifyData.message)
      return NextResponse.json(
        { error: 'Payment could not be verified. If you were charged, contact support with reference: ' + reference },
        { status: 400 }
      )
    }

    const psTx = verifyData.data

    // ── 5. Read plan from DB (NOT from client) ────────────────────
    const { data: attempt } = await supabaseAdmin
      .from('payment_attempts')
      .select('plan_id, billing')
      .eq('reference', reference)
      .maybeSingle()

    // Fallback to Paystack metadata if attempt record missing
    const planId  = attempt?.plan_id  ?? psTx.metadata?.plan_id  ?? 'builder'
    const billing = attempt?.billing  ?? psTx.metadata?.billing  ?? 'monthly'

    // ── 6. Subscription end date ──────────────────────────────────
    const now             = new Date()
    const subscriptionEnd = new Date(now)
    subscriptionEnd.setDate(subscriptionEnd.getDate() + 7) // 7-day trial
    if (billing === 'annual') {
      subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1)
    } else {
      subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1)
    }

    // ── 7. Activate subscription ──────────────────────────────────
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
        { error: 'Payment verified but account activation failed. Contact support with reference: ' + reference },
        { status: 500 }
      )
    }

    // ── 8. Record payment ─────────────────────────────────────────
    await supabaseAdmin.from('payments').insert({
      user_id:       userId,
      reference,
      amount:        psTx.amount ? psTx.amount / 100 : 0,
      currency:      psTx.currency || 'NGN',
      plan_id:       planId,
      billing,
      provider:      'paystack',
      status:        'success',
      paystack_data: psTx,
      created_at:    now.toISOString(),
    }).catch(e => console.warn('[pay/confirm] payments insert non-critical:', e))

    // Mark attempt completed
    await supabaseAdmin.from('payment_attempts')
      .update({ status: 'completed', completed_at: now.toISOString() })
      .eq('reference', reference)
      .catch(() => {})

    // ── 9. Welcome notification ───────────────────────────────────
    const planNames: Record<string, string> = { builder: 'Explorer', pro: 'Builder', elite: 'Climber' }
    const planName = planNames[planId] || planId

    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      type:    'payment',
      title:   '🎉 Welcome to Ascentor!',
      message: `Your 7-day free trial has started on the ${planName} plan. You won't be charged until day 8.`,
      link:    '/dashboard',
    }).catch(() => {})

    // ── 10. Audit log ─────────────────────────────────────────────
    await supabaseAdmin.from('audit_logs').insert({
      user_id:     userId,
      action:      'payment_confirmed',
      entity_type: 'payment',
      entity_id:   reference,
      details:     { planId, billing, amount: psTx.amount, currency: psTx.currency },
    }).catch(() => {})

    // ── 11. Referral rewards ──────────────────────────────────────
    await processReferral(userId).catch(e =>
      console.warn('[pay/confirm] Referral non-critical:', e)
    )

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
async function processReferral(userId: string) {
  const BONUS = 7

  const { data: referral } = await supabaseAdmin
    .from('referrals')
    .select('id, referrer_id')
    .eq('referred_id', userId)
    .eq('status', 'signed_up')
    .maybeSingle()

  if (!referral) return

  // Extend referred user
  const { data: me } = await supabaseAdmin
    .from('profiles').select('subscription_end').eq('id', userId).maybeSingle()
  if (me?.subscription_end) {
    const d = new Date(me.subscription_end)
    d.setDate(d.getDate() + BONUS)
    await supabaseAdmin.from('profiles').update({ subscription_end: d.toISOString() }).eq('id', userId)
  }

  // Extend referrer
  const { data: referrer } = await supabaseAdmin
    .from('profiles')
    .select('subscription_end, subscription_status, referral_bonus_days, referral_count')
    .eq('id', referral.referrer_id).maybeSingle()

  if (referrer?.subscription_end && referrer.subscription_status !== 'inactive') {
    const d = new Date(referrer.subscription_end)
    d.setDate(d.getDate() + BONUS)
    await supabaseAdmin.from('profiles').update({
      subscription_end: d.toISOString(),
      referral_count: (referrer.referral_count || 0) + 1,
    }).eq('id', referral.referrer_id)
  } else {
    await supabaseAdmin.from('profiles').update({
      referral_bonus_days: (referrer?.referral_bonus_days || 0) + BONUS,
      referral_count:      (referrer?.referral_count || 0) + 1,
    }).eq('id', referral.referrer_id)
  }

  await supabaseAdmin.from('referrals')
    .update({ status: 'rewarded', rewarded_at: new Date().toISOString() })
    .eq('id', referral.id)

  await supabaseAdmin.from('notifications').insert({
    user_id: referral.referrer_id,
    type:    'referral_reward',
    title:   '🎉 Referral reward unlocked!',
    message: `Someone you referred just subscribed. You both received ${BONUS} bonus days.`,
    link:    '/referral',
  }).catch(() => {})
}
