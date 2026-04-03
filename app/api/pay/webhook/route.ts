// ================================================================
// POST /api/pay/webhook  — PAYMENT SYSTEM v3
// ================================================================
// Paystack calls this server-to-server for ALL subscription events.
// This is the SOURCE OF TRUTH for renewals, cancellations, failures.
//
// ⚠️  REQUIRED SETUP — Two things you must do:
//
// 1. Register this URL in Paystack Dashboard:
//    Settings → API Keys & Webhooks → Webhook URL
//    → https://ascentorbi.com/api/pay/webhook
//
// 2. Whitelist in proxy.ts PUBLIC_API_ROUTES (Paystack has no cookie):
//    '/api/pay/webhook'
//
// Events handled:
//   charge.success          → First-time charge (backup for confirm)
//   subscription.create     → Subscription started (saves sub code)
//   subscription.disable    → Cancelled
//   invoice.payment_success → Renewal succeeded
//   invoice.payment_failed  → Renewal failed → mark past_due
//
// Security: HMAC-SHA512 signature verified on every request.
// ================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import crypto from 'crypto'

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!

// ── Signature verification ────────────────────────────────────────────────────
function verifySignature(rawBody: string, sig: string): boolean {
  const expected = crypto.createHmac('sha512', PAYSTACK_SECRET).update(rawBody).digest('hex')
  return expected === sig
}

// ── Profile lookup ────────────────────────────────────────────────────────────
// Prefer user_id from metadata (most reliable).
// Fall back to email lookup for events where metadata may be missing.
async function getProfileByEmail(email: string) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, subscription_plan, subscription_status, subscription_end')
    .eq('email', email)
    .maybeSingle()

  if (!data) {
    console.warn(`[pay/webhook] No profile for email: ${email}`)
  }
  return data ?? null
}

async function getProfileById(userId: string) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, subscription_plan, subscription_status, subscription_end')
    .eq('id', userId)
    .maybeSingle()
  return data ?? null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function nextPeriodEnd(currentEnd: string | null, billing: string): string {
  const base = currentEnd ? new Date(currentEnd) : new Date()
  if (billing === 'annual') {
    base.setFullYear(base.getFullYear() + 1)
  } else {
    base.setMonth(base.getMonth() + 1)
  }
  return base.toISOString()
}

async function notify(
  userId: string,
  type: string,
  title: string,
  message: string,
  link = '/account'
) {
  try {
    await supabaseAdmin.from('notifications').insert({ user_id: userId, type, title, message, link })
  } catch (_) {}
}

async function auditLog(userId: string, action: string, details: object) {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id:     userId,
      action,
      entity_type: 'payment',
      entity_id:   action,
      details,
    })
  } catch (_) {}
}

// ── EVENT HANDLERS ────────────────────────────────────────────────────────────

/**
 * charge.success
 * Fires for every successful charge including first-time and renewals.
 * Acts as a backup for /api/pay/confirm — if the user's browser closed
 * before confirm ran, this still activates their account.
 */
async function handleChargeSuccess(data: any) {
  const metadata = data.metadata ?? {}
  const userId   = metadata.user_id
  const planId   = metadata.plan_id
  const billing  = metadata.billing ?? 'monthly'
  const email    = data.customer?.email

  // Prefer userId from metadata; fall back to email lookup
  const profile = userId
    ? await getProfileById(userId)
    : email
    ? await getProfileByEmail(email)
    : null

  if (!profile) {
    console.warn('[pay/webhook] charge.success — could not find profile', { userId, email })
    return
  }

  // Only activate if not already active — avoid overwriting a working subscription
  if (profile.subscription_status === 'active') {
    console.log(`[pay/webhook] charge.success — profile already active, skipping (${profile.id})`)
    return
  }

  const now             = new Date()
  const subscriptionEnd = new Date(now)
  subscriptionEnd.setDate(subscriptionEnd.getDate() + 7) // trial
  if (billing === 'annual') {
    subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1)
  } else {
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1)
  }

  await supabaseAdmin.from('profiles').update({
    subscription_plan:    planId ?? profile.subscription_plan ?? 'explorer',
    subscription_status:  'trialing',
    subscription_start:   now.toISOString(),
    subscription_end:     subscriptionEnd.toISOString(),
    payment_method:       'paystack',
    onboarding_completed: true,
    updated_at:           now.toISOString(),
  }).eq('id', profile.id)

  await auditLog(profile.id, 'webhook_charge_success', {
    reference: data.reference,
    amount:    data.amount,
    planId,
    billing,
  })

  console.log(`[pay/webhook] ✅ charge.success → activated ${profile.id} on ${planId}`)
}

/**
 * subscription.create
 * Fires when Paystack creates the recurring subscription object.
 * We store the subscription_code — needed to cancel later.
 */
async function handleSubscriptionCreate(data: any) {
  const email = data.customer?.email
  if (!email) return

  const profile = await getProfileByEmail(email)
  if (!profile) return

  await supabaseAdmin.from('profiles').update({
    subscription_status:  'active',
    paystack_sub_code:    data.subscription_code,
    updated_at:           new Date().toISOString(),
  }).eq('id', profile.id)

  console.log(`[pay/webhook] ✅ subscription.create → sub code saved for ${email}`)
}

/**
 * subscription.disable
 * User cancelled or card expired — access continues until period end.
 */
async function handleSubscriptionDisable(data: any) {
  const email = data.customer?.email
  if (!email) return

  const profile = await getProfileByEmail(email)
  if (!profile) return

  await supabaseAdmin.from('profiles').update({
    subscription_status: 'cancelled',
    updated_at:          new Date().toISOString(),
  }).eq('id', profile.id)

  await notify(
    profile.id,
    'warning',
    'Subscription Cancelled',
    'Your subscription was cancelled. You keep access until your current period ends.',
    '/account'
  )

  console.log(`[pay/webhook] ⚠️  subscription.disable → ${email} cancelled`)
}

/**
 * invoice.payment_success
 * Recurring renewal succeeded — extend subscription period.
 */
async function handleRenewalSuccess(data: any) {
  const email = data.customer?.email
  if (!email) return

  const profile = await getProfileByEmail(email)
  if (!profile) return

  const billing  = data.subscription?.metadata?.billing ?? data.metadata?.billing ?? 'monthly'
  const newEnd   = nextPeriodEnd(profile.subscription_end, billing)

  await supabaseAdmin.from('profiles').update({
    subscription_status: 'active',
    subscription_end:    newEnd,
    updated_at:          new Date().toISOString(),
  }).eq('id', profile.id)

  // Record renewal payment
  try {
    await supabaseAdmin.from('payments').insert({
      user_id:    profile.id,
      reference:  data.transaction?.reference ?? `renewal-${Date.now()}`,
      plan_id:    profile.subscription_plan,
      amount:     data.amount ? data.amount / 100 : 0,
      currency:   data.currency ?? 'NGN',
      provider:   'paystack',
      status:     'success',
      created_at: new Date().toISOString(),
    })
  } catch (_) {}

  await notify(
    profile.id,
    'payment',
    'Subscription Renewed',
    `Your subscription has been renewed. Access extended to ${new Date(newEnd).toLocaleDateString()}.`,
    '/account'
  )

  console.log(`[pay/webhook] 🔄 invoice.payment_success → ${email} renewed until ${newEnd}`)
}

/**
 * invoice.payment_failed
 * Renewal failed — mark past_due, notify user to update payment.
 */
async function handleRenewalFailed(data: any) {
  const email = data.customer?.email
  if (!email) return

  const profile = await getProfileByEmail(email)
  if (!profile) return

  await supabaseAdmin.from('profiles').update({
    subscription_status: 'past_due',
    updated_at:          new Date().toISOString(),
  }).eq('id', profile.id)

  await notify(
    profile.id,
    'error',
    'Payment Failed',
    'Your renewal payment failed. Update your payment method to keep your access.',
    '/account'
  )

  console.log(`[pay/webhook] ❌ invoice.payment_failed → ${email} marked past_due`)
}

// ── Main Route ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let rawBody = ''
  try {
    rawBody = await req.text()
    const sig = req.headers.get('x-paystack-signature') ?? ''

    if (!verifySignature(rawBody, sig)) {
      console.error('[pay/webhook] Invalid HMAC signature — rejected')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const { event, data } = JSON.parse(rawBody)
    console.log(`[pay/webhook] 📥 ${event}`)

    switch (event) {
      case 'charge.success':
        await handleChargeSuccess(data)
        break
      case 'subscription.create':
        await handleSubscriptionCreate(data)
        break
      case 'subscription.disable':
        await handleSubscriptionDisable(data)
        break
      case 'invoice.payment_success':
        await handleRenewalSuccess(data)
        break
      case 'invoice.payment_failed':
        await handleRenewalFailed(data)
        break
      default:
        console.log(`[pay/webhook] Unhandled event: ${event}`)
    }

    // Always 200 — Paystack retries on non-2xx
    return NextResponse.json({ received: true })

  } catch (err: any) {
    console.error('[pay/webhook] Fatal error:', err)
    // Still return 200 so Paystack doesn't retry endlessly on a parse error
    return NextResponse.json({ received: true, warning: 'Processing error logged' })
  }
}

// Health check — useful to confirm the route is reachable
export async function GET() {
  return NextResponse.json({ status: 'Ascentor pay/webhook active ✅' })
}
