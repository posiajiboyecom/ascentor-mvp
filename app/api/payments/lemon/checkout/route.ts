// app/api/payments/lemon/checkout/route.ts
// Creates a Lemonsqueezy checkout URL for USD subscribers.
// Lemonsqueezy is the Merchant of Record — they handle VAT/tax globally.
//
// Setup:
//   1. Create a free account at lemonsqueezy.com
//   2. Create a Store → Add Products (one per plan/billing)
//   3. Each product has a Variant — copy the variant ID (numeric)
//   4. Set LEMONSQUEEZY_API_KEY in your env vars
//   5. Set LEMONSQUEEZY_STORE_ID (found in Store settings)

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const LS_API = 'https://api.lemonsqueezy.com/v1'

export async function POST(req: NextRequest) {
  try {
    const { variantId, email: bodyEmail, userId, planName } = await req.json()

    if (!variantId) {
      return NextResponse.json({ error: 'variantId required' }, { status: 400 })
    }

    // Get authed user email if available
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (n) => cookieStore.get(n)?.value } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    const email = user?.email ?? bodyEmail
    const uid = user?.id ?? userId

    // Build checkout via Lemonsqueezy Checkouts API
    const res = await fetch(`${LS_API}/checkouts`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            // Pre-fill email
            checkout_data: {
              email: email || undefined,
              custom: { userId: uid, planName },
            },
            // After payment, send back to dashboard
            product_options: {
              redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?subscribed=1`,
              receipt_link_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
            },
            // 7-day free trial
            checkout_options: {
              // Lemonsqueezy supports trial days at checkout level if not set on variant
              // Set trial_ends_at if you want dynamic trial — otherwise set it on the variant
            },
          },
          relationships: {
            store: {
              data: { type: 'stores', id: process.env.LEMONSQUEEZY_STORE_ID },
            },
            variant: {
              data: { type: 'variants', id: String(variantId) },
            },
          },
        },
      }),
    })

    const json = await res.json()

    if (!res.ok) {
      console.error('[lemon/checkout]', json)
      return NextResponse.json({ error: json?.errors?.[0]?.detail ?? 'LS error' }, { status: 500 })
    }

    const checkoutUrl = json?.data?.attributes?.url
    if (!checkoutUrl) {
      return NextResponse.json({ error: 'No checkout URL returned' }, { status: 500 })
    }

    return NextResponse.json({ checkoutUrl })
  } catch (err) {
    console.error('[lemon/checkout]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
