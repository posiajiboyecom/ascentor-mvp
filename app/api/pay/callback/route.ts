// ================================================================
// GET /api/pay/callback  - PAYMENT SYSTEM v6
// ================================================================
// Paystack redirects here after the user pays on the hosted page.
// Settlement (verification, amount/currency/owner checks, activation)
// is shared with the webhook and the reconciliation job in
// lib/paymentSettlement.ts, so nothing here trusts the URL or the
// transaction metadata to decide what a customer gets.
// ================================================================

import { NextRequest, NextResponse } from 'next/server'
import { settleReference } from '@/lib/paymentSettlement'

const APP_URL = process.env.NEXT_PUBLIC_URL || 'https://joinascentor.com'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const reference = searchParams.get('reference') || searchParams.get('trxref')

  if (!reference) {
    return NextResponse.redirect(`${APP_URL}/checkout?error=missing_reference`)
  }

  try {
    const result = await settleReference(reference)

    switch (result.state) {
      case 'settled':
        return NextResponse.redirect(`${APP_URL}/dashboard?welcome=1`)

      case 'pending':
        // Paystack is still confirming (e.g. bank transfer/USSD). The webhook or
        // the reconciliation job completes it - do not tell the user it failed.
        return NextResponse.redirect(`${APP_URL}/dashboard?payment=processing`)

      case 'failed':
        return NextResponse.redirect(`${APP_URL}/checkout?error=payment_failed`)

      case 'notfound':
        return NextResponse.redirect(`${APP_URL}/checkout?error=payment_failed`)

      case 'rejected':
        console.error(`[pay/callback] rejected ${reference}: ${result.reason}`)
        return NextResponse.redirect(`${APP_URL}/checkout?error=payment_failed`)
    }
  } catch (err) {
    // Transient (Paystack/DB unavailable). If they were charged, the webhook
    // (which Paystack retries) or the reconciliation job will activate them.
    console.error('[pay/callback] Unexpected error:', err)
    return NextResponse.redirect(`${APP_URL}/dashboard?payment=processing`)
  }
}
