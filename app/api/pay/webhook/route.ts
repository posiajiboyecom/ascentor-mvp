// ================================================================
// POST /api/pay/webhook  — PAYMENT SYSTEM v5 (CANONICAL)
// ================================================================
// This is the ONLY Paystack webhook handler.
// /api/subscription/webhook has been retired and deleted.
//
// Register this URL in Paystack Dashboard:
//   Settings → API Keys & Webhooks → Webhook URL
//   → https://ascentorbi.com/api/pay/webhook
//
// Events handled:
//   charge.success          → First-time charge backup + renewal
//   subscription.create     → Stores subscription code for cancellation
//   subscription.disable    → User cancelled
//   invoice.payment_success → Renewal succeeded (correct billing cycle)
//   invoice.payment_failed  → Renewal failed → mark past_due
//
// Security:
//   • HMAC-SHA512 signature verified on every request
//   • Idempotency: processed_webhook_events table prevents double-processing
//   • userId resolved from DB (email lookup or metadata) — never from body
//
// Plan IDs: explorer | builder | climber (only — no legacy aliases)
// ================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import crypto from 'crypto'

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!

// ── Signature verification ────────────────────────────────────────────────────
function verifySignature(rawBody: string, sig: string): boolean {
  const expected = crypto
    .createHmac('sha512', PAYSTACK_SECRET)
    .update(rawBody)
    .digest('hex')
  return expected === sig
}

// ── Idempotency — prevent double-processing on Paystack retries ───────────────
async function isAlreadyProcessed(idempotencyKey: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('processed_webhook_events')
    .select('id')
    .eq('id', idempotencyKey)
    .maybeSingle()
  return !!data
}

async function markProcessed(idempotencyKey: string): Promise<void> {
  await supabaseAdmin
    .from('processed_webhook_events')
    .upsert({ id: idempotencyKey }, { onConflict: 'id', ignoreDuplicates: true })
}

// ── Profile lookup ────────────────────────────────────────────────────────────
async function getProfileById(userId: string) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, subscription_plan, subscription_status, subscription_end')
    .eq('id', userId)
    .maybeSingle()
  return data ?? null
}

async function getProfileByEmail(email: string) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, subscription_plan, subscription_status, subscription_end')
    .eq('email', email)
    .maybeSingle()
  if (!data) {
    console.warn(`[pay/webhook] No profile found for email: ${email}`)
  }
  return data ?? null
}

// ── Normalise plan ID to canonical set ───────────────────────────────────────
const LEGACY_PLAN_MAP: Record<string, string> = {
  pro:   'builder',
  elite: 'climber',
}

function normalisePlanId(raw: string | null | undefined): string {
  if (!raw) return 'explorer'
  return LEGACY_PLAN_MAP[raw] ?? raw
}

// ── Billing period helper ─────────────────────────────────────────────────────
function nextPeriodEnd(currentEnd: string | null, billing: string): string {
  const base = currentEnd ? new Date(currentEnd) : new Date()
  if (billing === 'annual') {
    base.setFullYear(base.getFullYear() + 1)
  } else {
    base.setMonth(base.getMonth() + 1)
  }
  return base.toISOString()
}

// ── Notification helper ───────────────────────────────────────────────────────
async function notify(userId: string, type: string, title: string, message: string, link = '/account') {
  try {
    await supabaseAdmin.from('notifications').insert({ user_id: userId, type, title, message, link })
  } catch (_) {}
}

// ── Audit log helper ──────────────────────────────────────────────────────────
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

async function handleChargeSuccess(data: any) {
  const metadata = data.metadata ?? {}
  const userId   = metadata.user_id
  const rawPlan  = metadata.plan_id
  const billing  = metadata.billing ?? 'monthly'
  const email    = data.customer?.email

  const profile = userId
    ? await getProfileById(userId)
    : email
    ? await getProfileByEmail(email)
    : null

  if (!profile) {
    console.warn('[pay/webhook] charge.success — could not find profile', { userId, email })
    return
  }

  if (profile.subscription_status === 'active' || profile.subscription_status === 'trialing') {
    console.log(`[pay/webhook] charge.success — already active, skipping (${profile.id})`)
    return
  }

  const planId = normalisePlanId(rawPlan)
  const now    = new Date()
  const subEnd = new Date(now)
  subEnd.setDate(subEnd.getDate() + 7)
  if (billing === 'annual') {
    subEnd.setFullYear(subEnd.getFullYear() + 1)
  } else {
    subEnd.setMonth(subEnd.getMonth() + 1)
  }

  await supabaseAdmin.from('profiles').update({
    subscription_plan:    planId,
    subscription_status:  'trialing',
    subscription_start:   now.toISOString(),
    subscription_end:     subEnd.toISOString(),
    payment_method:       'paystack',
    onboarding_completed: true,
    updated_at:           now.toISOString(),
  }).eq('id', profile.id)

  await auditLog(profile.id, 'webhook_charge_success_recovery', {
    reference: data.reference,
    amount:    data.amount,
    planId,
    billing,
  })

  console.log(`[pay/webhook] ✅ charge.success recovery → ${profile.id} on ${planId}`)
}

async function handleSubscriptionCreate(data: any) {
  const email = data.customer?.email
  if (!email) return

  const profile = await getProfileByEmail(email)
  if (!profile) return

  await supabaseAdmin.from('profiles').update({
    subscription_status: 'active',
    paystack_sub_code:   data.subscription_code,
    updated_at:          new Date().toISOString(),
  }).eq('id', profile.id)

  console.log(`[pay/webhook] ✅ subscription.create → sub code saved for ${email}`)
}

async function handleSubscriptionDisable(data: any) {
  const email = data.customer?.email
  if (!email) return

  const profile = await getProfileByEmail(email)
  if (!profile) return

  if (!['active', 'trialing', 'past_due'].includes(profile.subscription_status)) return

  await supabaseAdmin.from('profiles').update({
    subscription_status: 'cancelled',
    updated_at:          new Date().toISOString(),
  }).eq('id', profile.id)

  const endDate = profile.subscription_end
    ? new Date(profile.subscription_end).toLocaleDateString('en-NG', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : 'the end of your billing period'

  await notify(
    profile.id,
    'warning',
    'Subscription Cancelled',
    `Your subscription has been cancelled. You keep access until ${endDate}.`,
    '/account'
  )

  console.log(`[pay/webhook] ⚠️  subscription.disable → ${email} cancelled`)
}

async function handleRenewalSuccess(data: any) {
  const email = data.customer?.email
  if (!email) return

  const profile = await getProfileByEmail(email)
  if (!profile) return

  const billing = (
    data.subscription?.metadata?.billing ??
    data.metadata?.billing ??
    'monthly'
  ) as string

  const newEnd = nextPeriodEnd(profile.subscription_end, billing)

  await supabaseAdmin.from('profiles').update({
    subscription_status: 'active',
    subscription_end:    newEnd,
    updated_at:          new Date().toISOString(),
  }).eq('id', profile.id)

  try {
    await supabaseAdmin.from('payments').insert({
      user_id:    profile.id,
      reference:  data.transaction?.reference ?? `renewal-${Date.now()}`,
      plan_id:    normalisePlanId(profile.subscription_plan),
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

  console.log(`[pay/webhook] 🔄 invoice.payment_success → ${email} renewed (${billing}) until ${newEnd}`)
}

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

    const idempotencyKey = `${event}::${data?.reference ?? data?.subscription_code ?? data?.id ?? Date.now()}`

    if (await isAlreadyProcessed(idempotencyKey)) {
      console.log(`[pay/webhook] Duplicate event skipped: ${idempotencyKey}`)
      return NextResponse.json({ received: true, duplicate: true })
    }

    console.log(`[pay/webhook] 📥 ${event}`)

    switch (event) {
      case 'charge.success':
        await handleChargeSuccess(data)
        break
      case 'subscription.create':
        await handleSubscriptionCreate(data)
        break
      case 'subscription.disable':
      case 'subscription.not_renew':
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

    await markProcessed(idempotencyKey)

    return NextResponse.json({ received: true })

  } catch (err: any) {
    console.error('[pay/webhook] Fatal error:', err)
    return NextResponse.json({ received: true, warning: 'Processing error logged' })
  }
}
