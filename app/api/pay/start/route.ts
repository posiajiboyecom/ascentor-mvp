// ================================================================
// POST /api/pay/start  — NEW PAYMENT SYSTEM v2
// ================================================================
// Called by checkout/page.tsx before opening the Paystack popup.
//
// Rules:
//   • Auth: user MUST be logged in (session cookie)
//   • Sends ONLY { email, plan } to Paystack — NO currency, NO amount
//   • Returns { accessCode, reference } to the client
//   • Logs the attempt in payment_attempts for plan reconciliation
//
// Why no currency/amount?
//   Paystack plan codes carry amount + currency from the dashboard.
//   Sending currency alongside a plan code triggers "Invalid Amount Sent".
// ================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Plan code map — single source of truth for Paystack plan codes
const PLAN_CODES: Record<string, { monthly: string; annual: string }> = {
  builder: { monthly: 'PLN_4v5qnnjk9rt6cdk', annual: 'PLN_vxl1wn9nirjic5j' },
  pro:     { monthly: 'PLN_4gok25gn1vz20i0', annual: 'PLN_73hl3c3n3zxhh79' },
  elite:   { monthly: 'PLN_ve92id76obworr6', annual: 'PLN_4gbyspguka7qn0h' },
}

export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth ───────────────────────────────────────────────────
    const auth = await createAuthClient()
    const { data: { user }, error: authErr } = await auth.auth.getUser()
    if (authErr || !user?.email) {
      return NextResponse.json({ error: 'You must be logged in to subscribe.' }, { status: 401 })
    }

    // ── 2. Parse body ─────────────────────────────────────────────
    const { planId, billing } = await req.json()

    if (!planId || !PLAN_CODES[planId]) {
      return NextResponse.json({ error: 'Invalid plan selected.' }, { status: 400 })
    }
    if (billing !== 'monthly' && billing !== 'annual') {
      return NextResponse.json({ error: 'Invalid billing cycle.' }, { status: 400 })
    }

    const planCode = PLAN_CODES[planId][billing as 'monthly' | 'annual']

    // ── 3. Paystack key check ─────────────────────────────────────
    const secret = process.env.PAYSTACK_SECRET_KEY
    if (!secret) {
      console.error('[pay/start] PAYSTACK_SECRET_KEY not configured')
      return NextResponse.json({ error: 'Payment system is not configured. Contact support.' }, { status: 500 })
    }

    // ── 4. Initialize Paystack transaction ────────────────────────
    // CRITICAL: Only { email, plan } — no currency, no amount
    const psRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method:  'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        plan:  planCode,
        metadata: {
          user_id: user.id,
          plan_id: planId,
          billing,
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

    // ── 5. Log pending attempt ────────────────────────────────────
    try {
      await supabaseAdmin.from('payment_attempts').upsert({
        user_id:    user.id,
        reference:  psData.data.reference,
        plan_id:    planId,
        billing,
        status:     'pending',
        created_at: new Date().toISOString(),
      }, { onConflict: 'reference' })
    } catch (e) {
      console.warn('[pay/start] Could not log attempt (non-critical):', e)
    }

    return NextResponse.json({
      accessCode: psData.data.access_code,
      reference:  psData.data.reference,
    })

  } catch (err: any) {
    console.error('[pay/start] Unexpected error:', err)
    return NextResponse.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 })
  }
}
