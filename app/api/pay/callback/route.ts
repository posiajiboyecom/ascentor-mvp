// ================================================================
// GET /api/pay/callback  — PAYMENT SYSTEM v4 (HOSTED PAGE)
// ================================================================
// Paystack redirects to this URL after the user pays on their
// hosted payment page. We verify the reference server-side,
// activate the subscription, then redirect to /dashboard.
//
// This is a GET route (browser redirect from Paystack).
// Reference comes in as a query param: ?reference=xxx&trxref=xxx
//
// Security: reference is verified against Paystack API —
// never trust client-supplied data to activate a subscription.
// ================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!
const APP_URL = process.env.NEXT_PUBLIC_URL || 'https://ascentorbi.com'

// Map planId → subscription_plan stored in profiles table
const PLAN_ID_TO_SUBSCRIPTION: Record<string, string> = {
  explorer: 'explorer',
  builder:  'builder',
  climber:  'climber',
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const reference = searchParams.get('reference') || searchParams.get('trxref')

  // ── 1. Reference must exist ──────────────────────────────────────────────
  if (!reference) {
    return NextResponse.redirect(`${APP_URL}/checkout?error=missing_reference`)
  }

  try {
    // ── 2. Verify with Paystack ────────────────────────────────────────────
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
        cache: 'no-store',
      }
    )
    const verifyData = await verifyRes.json()

    if (!verifyData.status || verifyData.data?.status !== 'success') {
      console.error('[pay/callback] Verification failed:', verifyData.message)
      return NextResponse.redirect(
        `${APP_URL}/checkout?error=payment_failed&ref=${reference}`
      )
    }

    const tx       = verifyData.data
    const userId   = tx.metadata?.user_id
    const planId   = tx.metadata?.plan_id
    const billing  = tx.metadata?.billing

    if (!userId || !planId) {
      console.error('[pay/callback] Missing metadata in transaction:', tx.metadata)
      // Payment succeeded but metadata missing — webhook will reconcile
      return NextResponse.redirect(`${APP_URL}/dashboard?payment=processing`)
    }

    // ── 3. Idempotency — already processed? ───────────────────────────────
    const { data: existing } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('reference', reference)
      .maybeSingle()

    if (existing) {
      console.log(`[pay/callback] ${reference} already processed`)
      return NextResponse.redirect(`${APP_URL}/dashboard?welcome=1`)
    }

    // ── 4. Activate subscription in profiles ──────────────────────────────
    const subscriptionPlan = PLAN_ID_TO_SUBSCRIPTION[planId] || planId
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 7) // 7-day trial period

    await supabaseAdmin
      .from('profiles')
      .update({
        subscription_plan:   subscriptionPlan,
        subscription_status: 'trialing',
        subscription_end:    trialEnd.toISOString(),
        billing_cycle:       billing || 'monthly',
        updated_at:          new Date().toISOString(),
      })
      .eq('id', userId)

    // ── 5. Log payment ────────────────────────────────────────────────────
    try {
      await supabaseAdmin.from('payments').insert({
        user_id:   userId,
        reference,
        plan_id:   planId,
        billing:   billing || 'monthly',
        amount:    tx.amount ? tx.amount / 100 : 0,
        currency:  tx.currency || 'NGN',
        status:    'success',
        paid_at:   tx.paid_at || new Date().toISOString(),
      })

      await supabaseAdmin.from('payment_attempts').update({
        status:     'success',
        updated_at: new Date().toISOString(),
      }).eq('reference', reference)
    } catch (e) {
      console.warn('[pay/callback] Could not log payment (non-critical):', e)
    }

    // ── 6. Redirect to dashboard ──────────────────────────────────────────
    console.log(`[pay/callback] Success — user ${userId} activated on ${subscriptionPlan}`)
    return NextResponse.redirect(`${APP_URL}/dashboard?welcome=1`)

  } catch (err: any) {
    console.error('[pay/callback] Unexpected error:', err)
    // Don't leave user stranded — webhook is the safety net
    return NextResponse.redirect(`${APP_URL}/dashboard?payment=processing`)
  }
}
