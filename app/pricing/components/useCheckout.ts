'use client'

// app/pricing/components/useCheckout.ts
// Routes NGN checkout → Paystack inline popup
// Routes USD checkout → Lemonsqueezy checkout URL (redirect)

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Currency, getProvider } from '../data'

interface CheckoutOptions {
  planName: string
  currency: Currency
  billing: 'monthly' | 'annual'
  // exactly one of these will be set based on currency
  paystackPlanCode?: string
  lemonVariantId?: string
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
    const provider = getProvider(opts.currency)
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      // ── Lemonsqueezy (USD) ───────────────────────────────────────
      if (provider === 'lemonsqueezy') {
        if (!opts.lemonVariantId) {
          // Variant not configured yet — redirect to signup with intent
          window.location.href = `/signup?plan=${opts.planName.toLowerCase()}&currency=usd`
          return
        }

        // Call our LS checkout URL builder
        const res = await fetch('/api/payments/lemon/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            variantId: opts.lemonVariantId,
            email: user?.email ?? '',
            userId: user?.id ?? '',
            planName: opts.planName,
          }),
        })
        const { checkoutUrl, error } = await res.json()
        if (error) throw new Error(error)
        // Redirect to Lemonsqueezy hosted checkout
        window.location.href = checkoutUrl
        return
      }

      // ── Paystack (NGN) ───────────────────────────────────────────
      if (!opts.paystackPlanCode) {
        window.location.href = `/signup?plan=${opts.planName.toLowerCase()}&currency=ngn`
        return
      }

      const res = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: opts.paystackPlanCode,
          currency: 'NGN',
          email: user?.email ?? '',
          metadata: { planName: opts.planName, userId: user?.id },
        }),
      })

      const { access_code, reference, error } = await res.json()
      if (error) throw new Error(error)

      // FIX: Guard against missing access_code so loading state always resets.
      // Previously, if the API returned without access_code, setLoading(false)
      // was never called and the button stayed on "Loading payment..." forever.
      if (!access_code || !reference) {
        throw new Error('Payment initialization failed — no access code returned.')
      }

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
