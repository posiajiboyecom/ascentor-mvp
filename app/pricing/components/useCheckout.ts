'use client'

// app/pricing/components/useCheckout.ts — v3
// ALL currencies route through Paystack.
// USD users: the /api/payments/initialize endpoint converts to NGN at the live exchange rate.
// LemonSqueezy is no longer used on the B2C path.

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Currency } from '../data'

interface CheckoutOptions {
  planName: string
  currency: Currency
  billing: 'monthly' | 'annual'
  paystackPlanCode?: string
}

declare global {
  interface Window {
    PaystackPop?: {
      setup: (opts: Record<string, unknown>) => { openIframe: () => void }
    }
  }
}

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://js.paystack.co/v1/inline.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Paystack'))
    document.head.appendChild(script)
  })
}

export function useCheckout() {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const initiateCheckout = useCallback(async (opts: CheckoutOptions) => {
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!opts.paystackPlanCode) {
        // Plan codes not configured yet — send to signup with intent
        const currency = opts.currency === 'usd' ? 'usd' : 'ngn'
        window.location.href = `/signup?plan=${opts.planName.toLowerCase()}&currency=${currency}`
        return
      }

      // All checkouts go through Paystack.
      // The API endpoint detects currency and converts USD → NGN at live rate
      // before initialising the Paystack transaction.
      const res = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: opts.paystackPlanCode,
          currency: opts.currency.toUpperCase(), // 'NGN' or 'USD' — backend converts
          email: user?.email ?? '',
          metadata: {
            planName: opts.planName,
            userId: user?.id,
            billing: opts.billing,
            originalCurrency: opts.currency,
          },
        }),
      })

      const { access_code, reference, error } = await res.json()
      if (error) throw new Error(error)

      await loadPaystackScript()

      const handler = window.PaystackPop!.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
        access_code,
        ref: reference,
        onClose: () => setLoading(false),
        callback: (response: { reference: string }) => {
          window.location.href = `/api/payments/verify?reference=${response.reference}&redirect=/dashboard`
        },
      })

      handler.openIframe()
    } catch (err) {
      console.error('[checkout]', err)
      setLoading(false)
    }
  }, [supabase])

  return { initiateCheckout, loading }
}
