// ================================================================
// POST /api/pay/start  — PAYMENT SYSTEM v4 (HOSTED PAGE)
// ================================================================
// RADICAL FIX: Switched from Paystack inline popup to Paystack
// hosted payment page. No inline.js, no CSP issues, no SW
// interference, no popup blockers. Paystack hosts the entire
// checkout on their domain.
//
// Flow:
//   1. Client POSTs { planId, billing }
//   2. Server calls Paystack /transaction/initialize
//   3. Returns { authorizationUrl, reference } to client
//   4. Client does window.location.href = authorizationUrl
//   5. User pays on Paystack's hosted page
//   6. Paystack redirects to /api/pay/callback?reference=xxx
//   7. /api/pay/callback verifies + activates → redirect /dashboard
//
// Paystack plan codes in env vars:
//   PAYSTACK_PLAN_CODE_EXPLORER_MONTHLY=PLN_xxx
//   PAYSTACK_PLAN_CODE_EXPLORER_ANNUAL=PLN_xxx
//   PAYSTACK_PLAN_CODE_BUILDER_MONTHLY=PLN_xxx
//   PAYSTACK_PLAN_CODE_BUILDER_ANNUAL=PLN_xxx
//   PAYSTACK_PLAN_CODE_CLIMBER_MONTHLY=PLN_xxx
//   PAYSTACK_PLAN_CODE_CLIMBER_ANNUAL=PLN_xxx
// ================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { createAttempt, subscriptionAmountKobo } from '@/lib/paymentSettlement'
import { paymentLimiter, getClientIp } from '@/lib/rate-limit'

// Plan prices live in lib/pricing.ts (single source of truth) and are read via
// subscriptionAmountKobo(); the same value is stored on the payment attempt and
// re-checked when the payment settles.

const VALID_PLANS   = ['explorer', 'builder', 'climber'] as const
const VALID_BILLING = ['monthly', 'annual'] as const

const APP_URL = process.env.NEXT_PUBLIC_URL || 'https://joinascentor.com'

export async function POST(req: NextRequest) {
  const limit = paymentLimiter.check(getClientIp(req))
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a minute and try again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const auth = await createAuthClient()
    const { data: { user }, error: authErr } = await auth.auth.getUser()
    if (authErr || !user?.email) {
      return NextResponse.json(
        { error: 'You must be logged in to subscribe.' },
        { status: 401 }
      )
    }

    // ── 2. Validate body ─────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const { planId, billing } = body as { planId: string; billing: string }

    if (!VALID_PLANS.includes(planId as any)) {
      return NextResponse.json({ error: 'Invalid plan selected.' }, { status: 400 })
    }
    if (!VALID_BILLING.includes(billing as any)) {
      return NextResponse.json({ error: 'Invalid billing cycle.' }, { status: 400 })
    }

    // ── 3. Resolve plan amount ────────────────────────────────────────────────
    // Plan codes (PLN_xxx) are no longer passed to Paystack — they lock channels.
    // Amount is derived directly from PLAN_AMOUNTS instead.
    const planAmount = subscriptionAmountKobo(planId, billing)
    if (!planAmount) {
      console.error(`[pay/start] Missing amount for ${planId}/${billing}`)
      return NextResponse.json(
        { error: 'Plan pricing not configured. Please contact support.' },
        { status: 400 }
      )
    }

    // ── 4. Paystack key check ────────────────────────────────────────────────
    const secret = process.env.PAYSTACK_SECRET_KEY
    if (!secret) {
      console.error('[pay/start] PAYSTACK_SECRET_KEY not set')
      return NextResponse.json(
        { error: 'Payment system misconfigured. Contact support.' },
        { status: 500 }
      )
    }

    // ── 5. Initialize Paystack transaction ───────────────────────────────────
    // IMPORTANT: We do NOT pass `plan` (PLN_xxx) here. When a Paystack plan code
    // is attached, Paystack locks channels to whatever was configured on that plan
    // in the dashboard — ignoring the `channels` array entirely.
    // Instead we pass `amount` directly and track the plan in metadata.
    // Subscription renewal is handled by our webhook (charge.success events).
    const psRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email:        user.email,
        amount:       planAmount,
        callback_url: `${APP_URL}/api/pay/callback`,
        channels:     ['card', 'bank', 'bank_transfer', 'mobile_money', 'ussd', 'qr'],
        metadata: {
          user_id:  user.id,
          plan_id:  planId,
          billing,
          custom_fields: [
            { display_name: 'Plan',    variable_name: 'plan_id', value: planId },
            { display_name: 'Billing', variable_name: 'billing', value: billing },
          ],
        },
      }),
    })

    const psData = await psRes.json()

    if (!psData.status || !psData.data) {
      console.error('[pay/start] Paystack error:', psData.message)
      return NextResponse.json(
        { error: psData.message || 'Payment initialization failed. Please try again.' },
        { status: 400 }
      )
    }

    const { authorization_url, access_code, reference } = psData.data

    // ── 6. Record the attempt ────────────────────────────────────────────────
    // Mandatory: settlement only fulfils references that exist here, with the
    // amount/plan/user recorded server-side. If this fails the customer must
    // not be sent to pay for something we could not later match.
    try {
      await createAttempt({
        reference,
        kind:      'subscription',
        amountKobo: planAmount,
        email:     user.email,
        userId:    user.id,
        planId,
        billing,
      })
    } catch (e) {
      console.error('[pay/start] Could not record payment attempt:', e)
      return NextResponse.json(
        { error: 'Could not start checkout. Please try again.' },
        { status: 500 }
      )
    }

    // ── 7. Return both access_code (inline popup) and authorizationUrl (hosted page) ──
    // useCheckout + usePaystack hooks use access_code with PaystackPop.setup()
    // app/checkout/page.tsx uses authorizationUrl for window.location.href redirect
    return NextResponse.json({
      accessCode:       access_code,
      authorizationUrl: authorization_url,
      reference,
    })

  } catch (err: any) {
    console.error('[pay/start] Unexpected error:', err)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
