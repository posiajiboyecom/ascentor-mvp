// ================================================================
// POST /api/pay/webhook  — NEW PAYMENT SYSTEM v2
// ================================================================
// Paystack calls this server-to-server for subscription lifecycle.
// This is your safety net — handles renewals, cancellations, failures.
//
// ⚠️ IMPORTANT: Add '/api/pay/webhook' to PUBLIC_API_ROUTES in proxy.ts
// Paystack has no session cookie — the route must be publicly reachable.
//
// Events handled:
//   subscription.create       → Subscription started
//   subscription.disable      → Cancelled
//   invoice.payment_success   → Renewal succeeded
//   invoice.payment_failed    → Renewal failed
// ================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import crypto from 'crypto'

const SECRET = process.env.PAYSTACK_SECRET_KEY!

function verifySignature(raw: string, sig: string): boolean {
  const expected = crypto.createHmac('sha512', SECRET).update(raw).digest('hex')
  return expected === sig
}

async function getProfile(email: string) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, subscription_plan, subscription_status, subscription_end')
    .eq('email', email)
    .maybeSingle()
  return data
}

export async function POST(req: NextRequest) {
  let raw = ''
  try {
    raw = await req.text()
    const sig = req.headers.get('x-paystack-signature') ?? ''

    if (!verifySignature(raw, sig)) {
      console.error('[pay/webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const { event, data } = JSON.parse(raw)
    console.log(`[pay/webhook] 📥 ${event}`)

    switch (event) {

      case 'subscription.create': {
        const email = data.customer?.email
        if (!email) break
        const profile = await getProfile(email)
        if (!profile) { console.warn(`[pay/webhook] No profile: ${email}`); break }

        const billing = data.metadata?.billing ?? 'monthly'
        const end     = new Date()
        if (billing === 'annual') end.setFullYear(end.getFullYear() + 1)
        else end.setMonth(end.getMonth() + 1)

        await supabaseAdmin.from('profiles').update({
          subscription_status: 'active',
          subscription_end:    end.toISOString(),
          updated_at:          new Date().toISOString(),
        }).eq('id', profile.id)

        console.log(`[pay/webhook] ✅ subscription.create — ${email}`)
        break
      }

      case 'subscription.disable': {
        const email = data.customer?.email
        if (!email) break
        const profile = await getProfile(email)
        if (!profile) break

        await supabaseAdmin.from('profiles').update({
          subscription_status: 'cancelled',
          updated_at:          new Date().toISOString(),
        }).eq('id', profile.id)

        await supabaseAdmin.from('notifications').insert({
          user_id: profile.id,
          type:    'warning',
          title:   'Subscription Cancelled',
          message: 'Your subscription was cancelled. Access continues until the end of your billing period.',
          link:    '/account',
        }).catch(() => {})

        console.log(`[pay/webhook] ⚠️ subscription.disable — ${email}`)
        break
      }

      case 'invoice.payment_success': {
        const email = data.customer?.email
        if (!email) break
        const profile = await getProfile(email)
        if (!profile) break

        const billing    = data.subscription?.metadata?.billing ?? 'monthly'
        const currentEnd = profile.subscription_end
          ? new Date(profile.subscription_end)
          : new Date()

        if (billing === 'annual') currentEnd.setFullYear(currentEnd.getFullYear() + 1)
        else currentEnd.setMonth(currentEnd.getMonth() + 1)

        await supabaseAdmin.from('profiles').update({
          subscription_status: 'active',
          subscription_end:    currentEnd.toISOString(),
          updated_at:          new Date().toISOString(),
        }).eq('id', profile.id)

        await supabaseAdmin.from('payments').insert({
          user_id:    profile.id,
          reference:  data.transaction?.reference ?? `renewal-${Date.now()}`,
          amount:     data.amount ? data.amount / 100 : 0,
          currency:   data.currency ?? 'NGN',
          provider:   'paystack',
          status:     'success',
          created_at: new Date().toISOString(),
        }).catch(() => {})

        console.log(`[pay/webhook] 🔄 invoice.payment_success — ${email} renewed`)
        break
      }

      case 'invoice.payment_failed': {
        const email = data.customer?.email
        if (!email) break
        const profile = await getProfile(email)
        if (!profile) break

        await supabaseAdmin.from('profiles').update({
          subscription_status: 'past_due',
          updated_at:          new Date().toISOString(),
        }).eq('id', profile.id)

        await supabaseAdmin.from('notifications').insert({
          user_id: profile.id,
          type:    'error',
          title:   '⚠️ Payment Failed',
          message: 'Your renewal payment failed. Update your payment method to keep your access.',
          link:    '/account',
        }).catch(() => {})

        console.log(`[pay/webhook] ❌ invoice.payment_failed — ${email}`)
        break
      }

      default:
        console.log(`[pay/webhook] Unhandled: ${event}`)
    }

    // Always 200 — Paystack retries on non-2xx
    return NextResponse.json({ received: true })

  } catch (err: any) {
    console.error('[pay/webhook] Fatal:', err)
    return NextResponse.json({ received: true, warning: 'Processing error logged' })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Ascentor payment webhook active ✅' })
}
