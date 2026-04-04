// ================================================================
// POST /api/pay/activate-free
// ================================================================
// Called when a 100% promo code is applied and the user clicks a plan.
// Bypasses Paystack entirely — activates subscription immediately.
//
// Security:
//   • Auth required — userId from session, NOT from body
//   • Validates promo code server-side before activating
//   • Uses atomic DB RPC to prevent race conditions
//
// Plan IDs: explorer | builder | climber (canonical — no legacy)
// ================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const VALID_PLANS = ['explorer', 'builder', 'climber'] as const
type ValidPlan = typeof VALID_PLANS[number]

const PLAN_DISPLAY: Record<ValidPlan, string> = {
  explorer: 'Explorer',
  builder:  'Builder',
  climber:  'Climber',
}

export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth ───────────────────────────────────────────────
    const auth = await createAuthClient()
    const { data: { user }, error: authErr } = await auth.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = user.id

    // ── 2. Parse body ─────────────────────────────────────────
    const { planId, promoCode } = await req.json()

    if (!planId || !VALID_PLANS.includes(planId as ValidPlan)) {
      return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 })
    }
    if (!promoCode || typeof promoCode !== 'string') {
      return NextResponse.json({ error: 'Promo code is required.' }, { status: 400 })
    }

    const code = promoCode.trim().toUpperCase()
    const now  = new Date()

    // ── 3. Validate + claim promo (atomic RPC) ────────────────
    // claim_promo_code is a Supabase DB function that validates,
    // checks expiry, checks max_uses, and increments current_uses
    // atomically in a single transaction — no race condition.
    let discount: number | null = null

    const { data: rpcResult, error: rpcError } = await supabaseAdmin
      .rpc('claim_promo_code', { p_code: code, p_validate_only: false })

    if (rpcError) {
      // RPC not deployed — fall back to manual check with optimistic lock
      console.warn('[pay/activate-free] RPC not available, using fallback:', rpcError.message)

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

      // Atomic increment with optimistic concurrency check:
      // Only increment if current_uses hasn't changed since we read it.
      const { count } = await supabaseAdmin
        .from('promo_codes')
        .update({ current_uses: promo.current_uses + 1 })
        .eq('id', promo.id)
        .eq('current_uses', promo.current_uses) // optimistic lock
        .select('id', { count: 'exact', head: true })

      if (!count || count === 0) {
        // Another request claimed the last use — re-check
        return NextResponse.json({ error: 'This promo code has just been fully claimed. Please try another.' }, { status: 409 })
      }

      discount = promo.discount
    } else {
      if (rpcResult?.error === 'invalid')       return NextResponse.json({ error: 'Invalid promo code.' }, { status: 400 })
      if (rpcResult?.error === 'expired')       return NextResponse.json({ error: 'This promo code has expired.' }, { status: 400 })
      if (rpcResult?.error === 'limit_reached') return NextResponse.json({ error: 'This promo code has reached its usage limit.' }, { status: 400 })
      if (rpcResult?.ok) discount = rpcResult.discount
    }

    // Only 100% promo codes can bypass payment
    if (!discount || discount < 1.0) {
      return NextResponse.json(
        { error: 'This promo code requires payment. Please use the checkout.' },
        { status: 400 }
      )
    }

    // ── 4. Activate subscription ──────────────────────────────
    const subscriptionEnd = new Date()
    subscriptionEnd.setDate(subscriptionEnd.getDate() + 30) // 30 days free

    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({
        subscription_plan:    planId as ValidPlan,
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

    // ── 5. Notifications + audit ──────────────────────────────
    const displayName = PLAN_DISPLAY[planId as ValidPlan]

    try {
      await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        type:    'payment',
        title:   '🎉 Account Activated!',
        message: `Your ${displayName} plan is active with promo code ${code}. Enjoy 30 days of full access.`,
        link:    '/dashboard',
      })
    } catch (_) {}

    try {
      await supabaseAdmin.from('audit_logs').insert({
        user_id:     userId,
        action:      'promo_activation',
        entity_type: 'payment',
        entity_id:   code,
        details:     { planId, promoCode: code, discount: '100%' },
      })
    } catch (_) {}

    return NextResponse.json({ success: true, plan: planId })

  } catch (err: any) {
    console.error('[pay/activate-free]', err)
    return NextResponse.json({ error: 'Activation failed. Please try again.' }, { status: 500 })
  }
}
