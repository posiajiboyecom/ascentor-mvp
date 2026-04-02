'use client'

// app/pricing/components/useCheckout.tsx — v6
// PAYSTACK ONLY — LemonSqueezy removed entirely.
// All currencies (NGN and USD) go through Paystack.
// USD users pay in USD via Paystack's multi-currency support.
//
// API routes used:
//   POST /api/payments/initialize  — creates Paystack transaction
//   POST /api/payments/verify      — verifies and activates subscription
//
// Both routes live at /api/payments/ (plural) — the canonical path.

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface CheckoutOptions {
  planName: string          // display name e.g. 'Explorer', 'Builder', 'Climber'
  planId: string            // Supabase plan ID: 'builder' | 'pro' | 'elite'
  currency: 'ngn' | 'usd'
  billing: 'monthly' | 'annual'
  paystackPlanCode: string  // Paystack plan code — always required now
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
    const existing = document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Paystack script failed')))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://js.paystack.co/v1/inline.js'
    script.async = true
    script.onload  = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Paystack'))
    document.head.appendChild(script)
  })
}

export function useCheckout() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const supabase = createClient()

  // Preload Paystack script immediately so it's ready when user clicks
  useEffect(() => {
    loadPaystackScript().catch(() => {
      console.warn('[checkout] Paystack preload failed — will retry on click')
    })
  }, [])

  const initiateCheckout = useCallback(async (opts: CheckoutOptions) => {
    setLoading(true)
    setError(null)

    try {
      // ── 1. Auth check ─────────────────────────────────────────────────
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        window.location.href = '/login?redirect=/pricing'
        return
      }

      // ── 2. Guard — plan code must be set ─────────────────────────────
      if (!opts.paystackPlanCode) {
        setError('This plan is not yet available. Please contact support.')
        setLoading(false)
        return
      }

      // ── 3. Initialize transaction on server ───────────────────────────
      const initRes = await fetch('/api/payments/initialize', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan:     opts.paystackPlanCode,
          currency: opts.currency === 'ngn' ? 'NGN' : 'USD',
          email:    user.email ?? '',
          metadata: {
            planName: opts.planName,
            planId:   opts.planId,
            billing:  opts.billing,
            userId:   user.id,
          },
        }),
      })

      if (!initRes.ok) {
        const body = await initRes.json().catch(() => ({}))
        throw new Error(body.error || `Server error ${initRes.status}`)
      }

      const { access_code, reference, error: initError } = await initRes.json()
      if (initError) throw new Error(initError)
      if (!access_code || !reference) {
        throw new Error('Payment initialization returned no access code. Please try again.')
      }

      // ── 4. Load Paystack popup script ─────────────────────────────────
      await loadPaystackScript()
      if (!window.PaystackPop) {
        throw new Error('Payment system failed to load. Please refresh and try again.')
      }

      // ── 5. Open Paystack popup ────────────────────────────────────────
      const handler = window.PaystackPop.setup({
        key:         process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
        access_code,
        ref:         reference,
        onClose: () => {
          setLoading(false)
        },
        callback: async (response: { reference: string }) => {
          try {
            const verifyRes = await fetch('/api/payments/verify', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                reference: response.reference,
                plan:      opts.planId,
                billing:   opts.billing,
              }),
            })
            const verifyData = await verifyRes.json()
            if (verifyRes.ok && verifyData.success) {
              window.location.href = '/dashboard?welcome=1'
            } else {
              throw new Error(verifyData.error || 'Verification failed')
            }
          } catch (verifyErr: any) {
            console.error('[checkout] verify error:', verifyErr)
            // Payment went through but verify failed — webhook will reconcile.
            // Send user to dashboard rather than leaving them stranded.
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
