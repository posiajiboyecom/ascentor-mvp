'use client'

// app/pricing/components/useCheckout.tsx
// Routes NGN checkout → Paystack inline popup
// Routes USD checkout → Lemonsqueezy checkout URL (redirect)

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Currency, getProvider } from '../data'

interface CheckoutOptions {
  planName: string
  currency: Currency
  billing: 'monthly' | 'annual'
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
    // Check if script already exists in DOM
    const existing = document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]')
    if (existing) {
      // Script tag exists but PaystackPop not ready yet — wait for it
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Paystack script failed')))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://js.paystack.co/v1/inline.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Paystack'))
    document.head.appendChild(script)
  })
}

export function useCheckout() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  // Preload Paystack script as soon as the hook mounts
  // so it's ready by the time the user clicks
  useEffect(() => {
    loadPaystackScript().catch(() => {
      console.warn('[checkout] Paystack script preload failed — will retry on click')
    })
  }, [])

  const initiateCheckout = useCallback(async (opts: CheckoutOptions) => {
    const provider = getProvider(opts.currency)
    setLoading(true)
    setError(null)

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        window.location.href = '/login?redirect=/pricing'
        return
      }

      // ── Lemonsqueezy (USD) ──────────────────────────────────────
      if (provider === 'lemonsqueezy') {
        if (!opts.lemonVariantId) {
          window.location.href = `/signup?plan=${opts.planName.toLowerCase()}&currency=usd`
          return
        }

        const res = await fetch('/api/payment/lemon/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            variantId: opts.lemonVariantId,
            email: user.email ?? '',
            userId: user.id ?? '',
            planName: opts.planName,
          }),
        })
        const { checkoutUrl, error } = await res.json()
        if (error) throw new Error(error)
        window.location.href = checkoutUrl
        return
      }

      // ── Paystack (NGN) ──────────────────────────────────────────
      if (!opts.paystackPlanCode) {
        // Plan codes not configured — fail gracefully with message
        throw new Error('This plan is not yet available for NGN payment. Please contact support.')
      }

      // Load Paystack script (already preloaded, this is near-instant)
      await loadPaystackScript()

      if (!window.PaystackPop) {
        throw new Error('Payment system failed to load. Please refresh and try again.')
      }

      // Initialize transaction on server
      const res = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: opts.paystackPlanCode,
          currency: 'NGN',
          email: user.email ?? '',
          metadata: { planName: opts.planName, userId: user.id },
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Server error ${res.status}`)
      }

      const { access_code, reference, error: apiError } = await res.json()
      if (apiError) throw new Error(apiError)
      if (!access_code || !reference) {
        throw new Error('Invalid response from payment server. Please try again.')
      }

      const handler = window.PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
        access_code,
        ref: reference,
        onClose: () => {
          setLoading(false)
        },
        // FIX: callback must POST to verify, not navigate via GET
        callback: async (response: { reference: string }) => {
          try {
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                reference: response.reference,
                plan: opts.planName.toLowerCase(),
                billing: opts.billing,
              }),
            })

            const verifyData = await verifyRes.json()

            if (verifyRes.ok && verifyData.success) {
              window.location.href = '/dashboard?welcome=1'
            } else {
              throw new Error(verifyData.error || 'Verification failed')
            }
          } catch (verifyErr: any) {
            console.error('[checkout] verification error:', verifyErr)
            // Payment went through but verify failed — don't leave user stranded
            // Webhook will catch it, but show them a safe message
            window.location.href = '/dashboard?payment=pending'
          } finally {
            setLoading(false)
          }
        },
      })

      handler.openIframe()

    } catch (err: any) {
      console.error('[checkout]', err)
      setError(err.message || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }, [supabase])

  return { initiateCheckout, loading, error }
}
