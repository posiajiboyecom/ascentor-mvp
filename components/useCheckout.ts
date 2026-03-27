'use client'

// components/pricing/useCheckout.ts
// Wraps the Paystack inline popup.
// Loads the Paystack script lazily on first call.

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
      // Plan code not yet configured — redirect to signup with intent
      window.location.href = `/signup?plan=${opts.planName.toLowerCase()}`
      return
    }

    setLoading(true)
    try {
      // 1. Get current user email for pre-fill
      const { data: { user } } = await supabase.auth.getUser()

      // 2. Fetch a Paystack initialisation from our backend
      const res = await fetch('/api/payments/initialize', {
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

      // 3. Load Paystack and open popup
      await loadPaystackScript()

      const handler = window.PaystackPop!.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
        access_code,
        ref: reference,
        onClose: () => setLoading(false),
        callback: (response: { reference: string }) => {
          // Redirect to verify endpoint; Paystack webhook handles subscription activation
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
