'use client'

// components/useCheckout.ts
// Wraps the Paystack inline popup.
// Loads the Paystack script lazily on first call.
//
// H-1 fix: was pointing at /api/payments/ (plural — the new scaffolded dir).
// Canonical payment routes with HMAC verification, audit logs, and referral
// rewards live in /api/payment/ (singular). Consolidated here.

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CheckoutOptions {
  planCode: string
  planName: string
  currency: 'ngn' | 'usd'
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
    if (!opts.planCode) {
      window.location.href = `/signup?plan=${opts.planName.toLowerCase()}`
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // H-1 fix: /api/payment/initialize (singular) — has rate limiting, audit logs
      const res = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: opts.planCode,
          currency: opts.currency.toUpperCase(),
          email: user?.email ?? '',
          metadata: { planName: opts.planName },
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Initialization failed')

      const { access_code, reference } = json

      await loadPaystackScript()

      const handler = window.PaystackPop!.setup({
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
