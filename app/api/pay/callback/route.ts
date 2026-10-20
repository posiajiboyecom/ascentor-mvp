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

  const resultUrl = (status: string, extra: Record<string, string | null | undefined> = {}) => {
    const q = new URLSearchParams({ status, kind: 'plan' })
    for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v)
    return `${APP_URL}/payment/result?${q.toString()}`
  }

  if (!reference) {
    return NextResponse.redirect(resultUrl('failed'))
  }

  try {
    const result = await settleReference(reference)
    const att = result.attempt
    // Subscriptions land on the payment result screen; other kinds keep their previous destinations.
    const isSub = !att || att.kind === 'subscription'
    const extra = { plan: att?.plan_id, billing: att?.billing }

    switch (result.state) {
      case 'settled':
        return NextResponse.redirect(isSub ? resultUrl('success', extra) : `${APP_URL}/dashboard?welcome=1`)

      case 'pending':
        // Paystack is still confirming (e.g. bank transfer/USSD). The webhook or
        // the reconciliation job completes it - do not tell the user it failed.
        return NextResponse.redirect(isSub ? resultUrl('processing', extra) : `${APP_URL}/dashboard?payment=processing`)

      case 'failed':
      case 'notfound':
        return NextResponse.redirect(isSub ? resultUrl('failed', extra) : `${APP_URL}/checkout?error=payment_failed`)

      case 'rejected':
        console.error(`[pay/callback] rejected ${reference}: ${result.reason}`)
        return NextResponse.redirect(isSub ? resultUrl('failed', extra) : `${APP_URL}/checkout?error=payment_failed`)
    }
  } catch (err) {
    // Transient (Paystack/DB unavailable). If they were charged, the webhook
    // (which Paystack retries) or the reconciliation job will activate them.
    console.error('[pay/callback] Unexpected error:', err)
    return NextResponse.redirect(resultUrl('processing'))
  }
}
