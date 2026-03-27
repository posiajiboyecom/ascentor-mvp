// app/api/payments/webhook/route.ts
// Receives Paystack webhooks and keeps the subscriptions table in Supabase
// in sync. This is the authoritative source for subscription state.
//
// Events handled:
//   charge.success          → activate / confirm subscription
//   subscription.create     → store subscription_code + next billing date
//   subscription.disable    → mark subscription inactive
//   invoice.payment_failed  → flag dunning

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Supabase admin client (service role — bypasses RLS)
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function verifySignature(body: string, signature: string | null): boolean {
  if (!signature) return false
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(body)
    .digest('hex')
  return hash === signature
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-paystack-signature')

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(rawBody)
  const supabase = getAdminClient()

  try {
    switch (event.event) {
      // ── Subscription created ───────────────────────────────────────
      case 'subscription.create': {
        const { customer, plan, subscription_code, next_payment_date, status } = event.data
        const email = customer?.email

        if (!email) break

        // Find user by email
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .single()

        if (!profile) break

        await supabase.from('subscriptions').upsert({
          user_id: profile.id,
          paystack_subscription_code: subscription_code,
          paystack_plan_code: plan?.plan_code,
          plan_name: plan?.name,
          status: status === 'active' ? 'active' : 'pending',
          current_period_end: next_payment_date,
          currency: plan?.currency,
          amount: plan?.amount,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        break
      }

      // ── Charge successful (renewal or one-off) ───────────────────
      case 'charge.success': {
        const { customer, plan, paid_at } = event.data
        if (!plan?.plan_code) break // not a subscription charge

        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', customer?.email)
          .single()

        if (!profile) break

        await supabase.from('subscriptions').upsert({
          user_id: profile.id,
          status: 'active',
          last_payment_at: paid_at,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        break
      }

      // ── Subscription disabled / cancelled ────────────────────────
      case 'subscription.disable': {
        const { customer } = event.data

        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', customer?.email)
          .single()

        if (!profile) break

        await supabase.from('subscriptions')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('user_id', profile.id)
        break
      }

      // ── Payment failed (dunning) ──────────────────────────────────
      case 'invoice.payment_failed': {
        const { customer } = event.data

        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', customer?.email)
          .single()

        if (!profile) break

        await supabase.from('subscriptions')
          .update({ status: 'past_due', updated_at: new Date().toISOString() })
          .eq('user_id', profile.id)
        break
      }

      default:
        // Unhandled event type — log and acknowledge
        console.log('[webhook] unhandled event:', event.event)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[webhook] error:', err)
    // Return 200 to prevent Paystack from retrying on a logic error
    return NextResponse.json({ received: true, error: 'Processing error' })
  }
}
