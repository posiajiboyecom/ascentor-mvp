// ================================================================
// POST /api/pay/start  — PAYMENT SYSTEM v3 (CLEAN REBUILD)
// ================================================================
// Single entry point for all B2C checkout.
// Used by: app/checkout/page.tsx
//
// Flow:
//   1. Auth check (session cookie — never trust body)
//   2. Validate planId + billing
//   3. Call Paystack initialize with plan code + metadata
//   4. Log pending attempt to payment_attempts
//   5. Return { accessCode, reference } to client
//
// Client then opens PaystackPop.setup({ access_code, ref }) inline popup.
// After payment: POST /api/pay/confirm
// ================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// ── Single source of truth for plan codes ────────────────────────────────────
// Plan ID convention (matches profiles.subscription_plan and lib/pricing.ts):
//   explorer → Explorer tier  (was 'builder' in old code)
//   builder  → Builder tier   (was 'pro' in old code)
//   climber  → Climber tier   (was 'elite' in old code)
//
// To get your plan codes: Paystack Dashboard → Products → Plans
// Then add them to your .env.local:
//   PAYSTACK_PLAN_CODE_EXPLORER_MONTHLY=PLN_xxx
//   PAYSTACK_PLAN_CODE_EXPLORER_ANNUAL=PLN_xxx
//   PAYSTACK_PLAN_CODE_BUILDER_MONTHLY=PLN_xxx
//   PAYSTACK_PLAN_CODE_BUILDER_ANNUAL=PLN_xxx
//   PAYSTACK_PLAN_CODE_CLIMBER_MONTHLY=PLN_xxx
//   PAYSTACK_PLAN_CODE_CLIMBER_ANNUAL=PLN_xxx
// ─────────────────────────────────────────────────────────────────────────────
const PLAN_CODES: Record<string, Record<string, string | undefined>> = {
  explorer: {
    monthly: process.env.PAYSTACK_PLAN_CODE_EXPLORER_MONTHLY,
    annual:  process.env.PAYSTACK_PLAN_CODE_EXPLORER_ANNUAL,
  },
  builder: {
    monthly: process.env.PAYSTACK_PLAN_CODE_BUILDER_MONTHLY,
    annual:  process.env.PAYSTACK_PLAN_CODE_BUILDER_ANNUAL,
  },
  climber: {
    monthly: process.env.PAYSTACK_PLAN_CODE_CLIMBER_MONTHLY,
    annual:  process.env.PAYSTACK_PLAN_CODE_CLIMBER_ANNUAL,
  },
}

const VALID_PLANS   = ['explorer', 'builder', 'climber'] as const
const VALID_BILLING = ['monthly', 'annual'] as const

export async function POST(req: NextRequest) {
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

    // ── 3. Resolve Paystack plan code ────────────────────────────────────────
    const planCode = PLAN_CODES[planId]?.[billing]

    if (!planCode) {
      console.error(`[pay/start] Missing env var for ${planId}/${billing}`)
      return NextResponse.json(
        { error: 'This plan is not yet available. Please contact support.' },
        { status: 400 }
      )
    }

    // ── 4. Paystack key check ────────────────────────────────────────────────
    const secret = process.env.PAYSTACK_SECRET_KEY
    if (!secret) {
      console.error('[pay/start] PAYSTACK_SECRET_KEY not set')
      return NextResponse.json(
        { error: 'Payment system is misconfigured. Contact support.' },
        { status: 500 }
      )
    }

    // ── 5. Initialize Paystack transaction ───────────────────────────────────
    // CRITICAL: Only send { email, plan } — no amount, no currency.
    // Paystack derives amount + currency from the plan code itself.
    // Sending currency alongside a plan code causes "Invalid Amount Sent".
    const psRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        plan:  planCode,
        metadata: {
          user_id:  user.id,
          plan_id:  planId,
          billing,
          // custom_fields render in Paystack dashboard receipts
          custom_fields: [
            { display_name: 'Plan',    variable_name: 'plan_id', value: planId },
            { display_name: 'Billing', variable_name: 'billing', value: billing },
          ],
        },
      }),
    })

    const psData = await psRes.json()

    if (!psData.status || !psData.data?.access_code) {
      console.error('[pay/start] Paystack error:', psData.message)
      return NextResponse.json(
        { error: psData.message || 'Payment initialization failed. Please try again.' },
        { status: 400 }
      )
    }

    const { access_code, reference } = psData.data

    // ── 6. Log pending attempt (best-effort) ─────────────────────────────────
    try {
      await supabaseAdmin.from('payment_attempts').upsert({
        user_id:    user.id,
        reference,
        plan_id:    planId,
        billing,
        status:     'pending',
        created_at: new Date().toISOString(),
      }, { onConflict: 'reference' })
    } catch (e) {
      console.warn('[pay/start] Could not log attempt (non-critical):', e)
    }

    // ── 7. Return to client ──────────────────────────────────────────────────
    return NextResponse.json({ accessCode: access_code, reference })

  } catch (err: any) {
    console.error('[pay/start] Unexpected error:', err)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
