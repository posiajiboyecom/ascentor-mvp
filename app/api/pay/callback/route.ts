// FILE: app/api/pay/callback/route.ts
// FIX: #5b — saves Paystack card details (last4, brand, expiry) to profiles.card_details on first payment

// ================================================================
// GET /api/pay/callback  — PAYMENT SYSTEM v5
// ================================================================
// Paystack redirects here after the user pays on their hosted page.
// We verify the reference server-side, activate the subscription,
// then redirect to /dashboard.
//
// Security: reference is verified against Paystack API —
// never trust client-supplied data to activate a subscription.
//
// Plan IDs: explorer | builder | climber (canonical — no legacy)
// ================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!
const APP_URL = process.env.NEXT_PUBLIC_URL || 'https://ascentorbi.com'

// Legacy plan ID normalisation — safe net for any old references
// After the DB migration, plan codes will always be canonical
const LEGACY_PLAN_MAP: Record<string, string> = {
  pro:   'builder',
  elite: 'climber',
}

function normalisePlanId(raw: string | null | undefined): string {
  if (!raw) return 'explorer'
  return LEGACY_PLAN_MAP[raw] ?? raw
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const reference = searchParams.get('reference') || searchParams.get('trxref')

  // ── 1. Reference must exist ──────────────────────────────────
  if (!reference) {
    return NextResponse.redirect(`${APP_URL}/checkout?error=missing_reference`)
  }

  try {
    // ── 2. Verify with Paystack ────────────────────────────────
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
        `${APP_URL}/checkout?error=payment_failed`
      )
    }

    const tx      = verifyData.data
    const userId  = tx.metadata?.user_id
    const rawPlan = tx.metadata?.plan_id
    const billing = tx.metadata?.billing ?? 'monthly'

    if (!userId || !rawPlan) {
      console.error('[pay/callback] Missing metadata in transaction:', tx.metadata)
      // Payment succeeded but metadata missing — webhook will reconcile
      return NextResponse.redirect(`${APP_URL}/dashboard?payment=processing`)
    }

    // ── 3. Idempotency — already processed? ───────────────────
    const { data: existing } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('reference', reference)
      .maybeSingle()

    if (existing) {
      console.log(`[pay/callback] ${reference} already processed`)
      return NextResponse.redirect(`${APP_URL}/dashboard?welcome=1`)
    }

    // ── 4. Normalise plan ID to canonical set ──────────────────
    const planId = normalisePlanId(rawPlan)

    // ── 5. Activate subscription ───────────────────────────────
    const now             = new Date()
    const subscriptionEnd = new Date(now)
    subscriptionEnd.setDate(subscriptionEnd.getDate() + 7) // 7-day trial grace
    if (billing === 'annual') {
      subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1)
    } else {
      subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1)
    }

    // Extract and save card details from Paystack authorization
    const auth = tx.authorization
    const cardDetails = auth ? {
      last4:      auth.last4 || null,
      card_type:  auth.card_type || auth.brand || null,
      exp_month:  auth.exp_month || null,
      exp_year:   auth.exp_year || null,
      bank:       auth.bank || null,
      channel:    auth.channel || tx.channel || 'card',
      auth_code:  auth.authorization_code || null,
    } : null

    await supabaseAdmin
      .from('profiles')
      .update({
        subscription_plan:    planId,
        subscription_status:  'trialing',
        subscription_start:   now.toISOString(),
        subscription_end:     subscriptionEnd.toISOString(),
        billing_cycle:        billing,
        payment_method:       tx.channel || 'paystack',
        ...(cardDetails ? { card_details: cardDetails } : {}),
        onboarding_completed: true,
        updated_at:           now.toISOString(),
      })
      .eq('id', userId)

    // ── 6. Log payment ─────────────────────────────────────────
    try {
      await supabaseAdmin.from('payments').insert({
        user_id:   userId,
        reference,
        plan_id:   planId,
        billing,
        amount:    tx.amount ? tx.amount / 100 : 0,
        currency:  tx.currency || 'NGN',
        provider:  'paystack',
        status:    'success',
        paid_at:   tx.paid_at || now.toISOString(),
      })

      await supabaseAdmin.from('payment_attempts').update({
        status:     'success',
        updated_at: now.toISOString(),
      }).eq('reference', reference)
    } catch (e) {
      console.warn('[pay/callback] Could not log payment (non-critical):', e)
    }

    // ── 7. Redirect to dashboard ───────────────────────────────
    console.log(`[pay/callback] ✅ Success — user ${userId} activated on ${planId} (${billing})`)
    return NextResponse.redirect(`${APP_URL}/dashboard?welcome=1`)

  } catch (err: any) {
    console.error('[pay/callback] Unexpected error:', err)
    return NextResponse.redirect(`${APP_URL}/dashboard?payment=processing`)
  }
}
