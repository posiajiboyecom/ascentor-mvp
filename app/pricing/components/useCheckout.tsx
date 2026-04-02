'use client'

// app/pricing/components/useCheckout.tsx
// Routes NGN checkout → Paystack inline popup
// Routes USD checkout → Lemonsqueezy checkout URL (redirect)
//
// H-1 fix: canonical routes are /api/payment/ (singular) — has HMAC
// verification, audit logs, and rate limiting.

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Currency, getProvider } from '../data'

interface CheckoutOptions {
  planName: string
  currency: Currency
  billing: 'monthly' | 'annual'
  paystackPlanCode?: string
  lemonVariantId?: string
}

// PaystackPop accessed via (window as any).PaystackPop to avoid duplicate global declarations

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).PaystackPop) { resolve(); return }
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

        // H-1 fix: /api/payment/lemon/checkout (singular)
        const res = await fetch('/api/payment/lemon/checkout', {
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
        window.location.href = checkoutUrl
        return
      }

      // ── Paystack (NGN) ───────────────────────────────────────────
      if (!opts.paystackPlanCode) {
        window.location.href = `/signup?plan=${opts.planName.toLowerCase()}&currency=ngn`
        return
      }

      // H-1 fix: /api/payment/initialize (singular) — has rate limiting, audit logs
      const res = await fetch('/api/payment/initialize', {
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

      await loadPaystackScript()

      const handler = (window as any).PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
        access_code,
        ref: reference,
        onClose: () => setLoading(false),
        callback: (response: { reference: string }) => {
          // H-1 fix: /api/payment/verify (singular)
          window.location.href = `/api/payment/verify?reference=${response.reference}&redirect=/dashboard`
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
