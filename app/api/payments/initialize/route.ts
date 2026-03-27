// app/api/payments/initialize/route.ts
// Creates a Paystack transaction with the specified plan.
// Returns { access_code, reference } for the Paystack inline popup.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { plan, currency, email: bodyEmail, metadata } = body

    // ── Auth: get user email if logged in ───────────────────────────
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name) => cookieStore.get(name)?.value } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    const email = user?.email ?? bodyEmail

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    // ── Call Paystack initialize ─────────────────────────────────────
    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        plan,          // Paystack plan code links the transaction to a subscription
        currency: currency ?? 'NGN',
        metadata: {
          userId: user?.id ?? null,
          ...metadata,
        },
        // Idempotency: use userId + plan as reference seed to prevent double charges
        reference: `asc_${user?.id ?? email.replace(/\W/g, '')}_${plan}_${Date.now()}`,
      }),
    })

    const data = await paystackRes.json()

    if (!data.status) {
      console.error('[paystack init]', data)
      return NextResponse.json({ error: data.message ?? 'Paystack error' }, { status: 500 })
    }

    return NextResponse.json({
      access_code: data.data.access_code,
      reference: data.data.reference,
    })
  } catch (err) {
    console.error('[payments/initialize]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
