// app/api/payments/lemon/webhook/route.ts
// Receives Lemonsqueezy webhooks for USD subscriptions.
// Mirrors the same subscriptions table used by Paystack.
//
// In LS dashboard → Settings → Webhooks:
//   URL: https://ascentorbi.com/api/payments/lemon/webhook
//   Events: subscription_created, subscription_updated, subscription_cancelled,
//           subscription_payment_success, subscription_payment_failed
//   Set a signing secret → add as LEMONSQUEEZY_WEBHOOK_SECRET

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !process.env.LEMONSQUEEZY_WEBHOOK_SECRET) return false
  const hash = crypto
    .createHmac('sha256', process.env.LEMONSQUEEZY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex')
  return hash === signature
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-signature')

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(rawBody)
  const eventName: string = event.meta?.event_name ?? ''
  const data = event.data?.attributes ?? {}
  const customData = event.meta?.custom_data ?? {}
  const supabase = getAdminClient()

  try {
    // userId is passed in checkout custom data
    const userId: string | null = customData.userId ?? null
    const planName: string | null = customData.planName ?? null

    if (!userId) {
      console.warn('[lemon webhook] no userId in custom_data — skipping DB write')
      return NextResponse.json({ received: true })
    }

    switch (eventName) {
      case 'subscription_created':
      case 'subscription_updated':
      case 'subscription_payment_success': {
        const status = data.status === 'active' ? 'active'
          : data.status === 'on_trial' ? 'active'
          : data.status === 'past_due' ? 'past_due'
          : 'pending'

        await supabase.from('subscriptions').upsert({
          user_id: userId,
          paystack_subscription_code: null,
          paystack_plan_code: null,
          lemon_subscription_id: String(event.data?.id ?? ''),
          lemon_variant_id: String(data.variant_id ?? ''),
          plan_name: planName ?? data.product_name,
          status,
          currency: 'USD',
          amount: data.unit_price ?? null,
          current_period_end: data.renews_at ?? null,
          last_payment_at: data.status === 'active' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        break
      }

      case 'subscription_cancelled':
      case 'subscription_expired': {
        await supabase.from('subscriptions')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('user_id', userId)
        break
      }

      case 'subscription_payment_failed': {
        await supabase.from('subscriptions')
          .update({ status: 'past_due', updated_at: new Date().toISOString() })
          .eq('user_id', userId)
        break
      }

      default:
        console.log('[lemon webhook] unhandled event:', eventName)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[lemon webhook] error:', err)
    return NextResponse.json({ received: true })
  }
}
