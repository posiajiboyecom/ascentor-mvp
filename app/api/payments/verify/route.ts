// app/api/payments/verify/route.ts
// Called by Paystack popup callback. Verifies the transaction and
// redirects the user. The webhook does the actual subscription activation.

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const reference = searchParams.get('reference')
  const redirect = searchParams.get('redirect') ?? '/dashboard'

  if (!reference) {
    return NextResponse.redirect(new URL('/pricing?error=missing_ref', req.url))
  }

  try {
    const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    })
    const data = await res.json()

    if (!data.status || data.data?.status !== 'success') {
      return NextResponse.redirect(new URL(`/pricing?error=payment_failed`, req.url))
    }

    // Redirect to dashboard — webhook will have already fired and
    // activated the subscription via /api/payments/webhook
    return NextResponse.redirect(new URL(`${redirect}?subscribed=1`, req.url))
  } catch (err) {
    console.error('[payments/verify]', err)
    return NextResponse.redirect(new URL('/pricing?error=server_error', req.url))
  }
}
