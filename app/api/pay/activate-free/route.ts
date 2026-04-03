// ================================================================
// POST /api/pay/activate-free  — NEW PAYMENT SYSTEM v2
// ================================================================
// Called when a 100% promo code is applied and user clicks a plan.
// Bypasses Paystack entirely — activates subscription immediately.
//
// Security:
//   • Auth required — userId from session, NOT from body
//   • Validates promo code server-side before activating
//   • Uses atomic DB RPC to prevent double-use race conditions
// ================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const VALID_PLANS = ['builder', 'pro', 'elite']

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
    const { planId, promoCode } = await req.json()

    if (!planId || !VALID_PLANS.includes(planId)) {
      return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 })
    }
    if (!promoCode || typeof promoCode !== 'string') {
      return NextResponse.json({ error: 'Promo code is required.' }, { status: 400 })
    }

    const code = promoCode.trim().toUpperCase()
    const now  = new Date()

    // ── 3. Validate + claim promo (atomic) ────────────────────────
    // Try atomic RPC first (prevents race conditions)
    const { data: rpcResult, error: rpcError } = await supabaseAdmin
      .rpc('claim_promo_code', { p_code: code, p_validate_only: false })

    let discount: number | null = null

    if (!rpcError && rpcResult) {
      if (rpcResult.error === 'invalid') {
        return NextResponse.json({ error: 'Invalid promo code.' }, { status: 400 })
      }
      if (rpcResult.error === 'expired') {
        return NextResponse.json({ error: 'This promo code has expired.' }, { status: 400 })
      }
      if (rpcResult.error === 'limit_reached') {
        return NextResponse.json({ error: 'This promo code has reached its usage limit.' }, { status: 400 })
      }
      if (rpcResult.ok) {
        discount = rpcResult.discount
      }
    } else {
      // RPC not available — fall back to manual DB check
      const { data: promo } = await supabaseAdmin
        .from('promo_codes')
        .select('id, discount, expires_at, max_uses, current_uses, active')
        .eq('code', code)
        .maybeSingle()

      if (!promo || !promo.active) {
        return NextResponse.json({ error: 'Invalid promo code.' }, { status: 400 })
      }
      if (promo.expires_at && new Date(promo.expires_at) < now) {
        return NextResponse.json({ error: 'This promo code has expired.' }, { status: 400 })
      }
      if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
        return NextResponse.json({ error: 'This promo code has reached its usage limit.' }, { status: 400 })
      }

      discount = promo.discount

      // Increment usage manually (not atomic — use RPC in production)
      await supabaseAdmin.from('promo_codes')
        .update({ current_uses: (promo.current_uses || 0) + 1 })
        .eq('id', promo.id)
    }

    // Only 100% promo codes can bypass payment
    if (!discount || discount < 1.0) {
      return NextResponse.json(
        { error: 'This promo code requires payment. Please use the checkout.' },
        { status: 400 }
      )
    }

    // ── 4. Activate subscription ──────────────────────────────────
    const subscriptionEnd = new Date()
    subscriptionEnd.setDate(subscriptionEnd.getDate() + 30) // 30 days free

    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({
        subscription_plan:    planId,
        subscription_status:  'active',
        subscription_start:   now.toISOString(),
        subscription_end:     subscriptionEnd.toISOString(),
        payment_method:       'promo',
        onboarding_completed: true,
        updated_at:           now.toISOString(),
      })
      .eq('id', userId)

    if (updateErr) {
      console.error('[pay/activate-free] Profile update failed:', updateErr)
      return NextResponse.json({ error: 'Activation failed. Please contact support.' }, { status: 500 })
    }

    // ── 5. Notifications + audit ──────────────────────────────────
    const planNames: Record<string, string> = { builder: 'Explorer', pro: 'Builder', elite: 'Climber' }

    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      type:    'payment',
      title:   '🎉 Account Activated!',
      message: `Your ${planNames[planId]} plan is active with promo code ${code}. Enjoy 30 days of full access.`,
      link:    '/dashboard',
    }).catch(() => {})

    await supabaseAdmin.from('audit_logs').insert({
      user_id:     userId,
      action:      'promo_activation',
      entity_type: 'payment',
      entity_id:   code,
      details:     { planId, promoCode: code, discount: '100%' },
    }).catch(() => {})

    return NextResponse.json({ success: true, plan: planId })

  } catch (err: any) {
    console.error('[pay/activate-free]', err)
    return NextResponse.json({ error: 'Activation failed. Please try again.' }, { status: 500 })
  }
}
