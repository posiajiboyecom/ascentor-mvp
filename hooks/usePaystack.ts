'use client'

// hooks/usePaystack.ts — PAYMENT SYSTEM v3
// ─────────────────────────────────────────────────────────────────────────────
// Used by: app/pricing/components/B2CPlanCard.tsx
//
// Calls /api/pay/start (NOT the deleted /api/payments/initialize).
// CRITICAL: Never sends `amount` or `currency` to Paystack when using a plan
// code — Paystack will reject with "Invalid Amount Sent". The plan code already
// encodes currency and amount on the Paystack side.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface PaystackOptions {
  planCode:  string            // Paystack plan code e.g. PLN_xxx
  planId:    string            // Supabase plan id: 'builder' | 'pro' | 'elite'
  planName:  string            // display name e.g. 'Explorer'
  billing:   'monthly' | 'annual'
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
    script.src     = 'https://js.paystack.co/v1/inline.js'
    script.async   = true
    script.onload  = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Paystack'))
    document.head.appendChild(script)
  })
}

export function usePaystack() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const supabase = createClient()

  // Preload Paystack script so it's ready when user clicks
  useEffect(() => {
    loadPaystackScript().catch(() => {
      console.warn('[usePaystack] Paystack preload failed — will retry on click')
    })
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const pay = useCallback(async (opts: PaystackOptions) => {
    setLoading(true)
    setError(null)

    try {
      // ── 1. Auth check ──────────────────────────────────────────────────────
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        window.location.href = '/login?redirect=/pricing'
        return
      }

      // ── 2. Guard — plan code must be set ───────────────────────────────────
      if (!opts.planCode) {
        setError('This plan is not yet available. Please contact support.')
        setLoading(false)
        return
      }

      // ── 3. Initialize transaction via /api/pay/start ───────────────────────
      // IMPORTANT: We only send planId + billing. The server resolves the
      // Paystack plan code from env vars and never passes amount/currency to
      // Paystack — that's what was causing "Invalid Amount Sent".
      const startRes = await fetch('/api/pay/start', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          planId:  opts.planId,
          billing: opts.billing,
        }),
      })

      if (!startRes.ok) {
        const body = await startRes.json().catch(() => ({}))
        throw new Error(body.error || `Payment setup failed (${startRes.status})`)
      }

      const { accessCode, reference, error: startError } = await startRes.json()
      if (startError) throw new Error(startError)
      if (!accessCode || !reference) {
        throw new Error('Payment initialization returned no access code. Please try again.')
      }

      // ── 4. Ensure Paystack script is ready ────────────────────────────────
      await loadPaystackScript()
      if (!window.PaystackPop) {
        throw new Error('Payment system failed to load. Please refresh and try again.')
      }

      // ── 5. Open Paystack inline popup ─────────────────────────────────────
      const handler = window.PaystackPop.setup({
        key:         process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
        access_code: accessCode,
        ref:         reference,

        onClose: () => {
          setLoading(false)
        },

        callback: async (response: { reference: string }) => {
          try {
            // Confirm payment on server
            const confirmRes = await fetch('/api/pay/confirm', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({ reference: response.reference }),
            })
            const confirmData = await confirmRes.json()

            if (confirmRes.ok && confirmData.success) {
              window.location.href = '/dashboard?welcome=1'
            } else {
              // Payment went through but confirm had an issue.
              // Webhook will reconcile — don't leave user stranded.
              window.location.href = '/dashboard?payment=processing'
            }
          } catch {
            window.location.href = '/dashboard?payment=processing'
          } finally {
            setLoading(false)
          }
        },
      })

      handler.openIframe()

    } catch (err: any) {
      console.error('[usePaystack]', err)
      setError(err.message || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }, [supabase])

  return { pay, loading, error, clearError }
}
