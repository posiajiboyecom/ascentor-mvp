'use client'

// app/pricing/components/useCheckout.tsx — v7
// FIXED: Was sending { plan, currency } to /api/payments/initialize (deleted route).
// Paystack rejects "Invalid Amount Sent" when you pass currency alongside a plan code.
//
// NOW: delegates to /api/pay/start which sends ONLY { email, plan } to Paystack.
// The plan code encodes amount + currency on the Paystack side — never send them separately.
//
// API routes used:
//   POST /api/pay/start   — creates Paystack transaction (plan code only, no amount/currency)
//   POST /api/pay/confirm — verifies and activates subscription

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface CheckoutOptions {
  planName: string           // display name e.g. 'Explorer', 'Builder', 'Climber'
  planId:   string           // Supabase plan ID: 'builder' | 'pro' | 'elite' | 'explorer' | 'climber'
  billing:  'monthly' | 'annual'
  // currency intentionally removed — Paystack derives it from the plan code
  // paystackPlanCode intentionally removed — server resolves it from env vars
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
    script.src    = 'https://js.paystack.co/v1/inline.js'
    script.async  = true
    script.onload  = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Paystack'))
    document.head.appendChild(script)
  })
}

// Map old data.ts plan IDs to new /api/pay/start IDs (no DB migration needed)
const PLAN_ID_MAP: Record<string, string> = {
  builder:  'explorer',
  pro:      'builder',
  elite:    'climber',
  explorer: 'explorer',
  climber:  'climber',
}

export function useCheckout() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadPaystackScript().catch(() => {
      console.warn('[checkout] Paystack preload failed — will retry on click')
    })
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const initiateCheckout = useCallback(async (opts: CheckoutOptions) => {
    setLoading(true)
    setError(null)

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        window.location.href = '/login?redirect=/pricing'
        return
      }

      const resolvedPlanId = PLAN_ID_MAP[opts.planId] ?? opts.planId

      // CRITICAL: Only planId + billing sent to server.
      // Server sends ONLY { email, plan } to Paystack — no amount, no currency.
      // Sending currency alongside a plan code causes "Invalid Amount Sent".
      const initRes = await fetch('/api/pay/start', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId:  resolvedPlanId,
          billing: opts.billing,
        }),
      })

      if (!initRes.ok) {
        const body = await initRes.json().catch(() => ({}))
        throw new Error(body.error || `Server error ${initRes.status}`)
      }

      const { accessCode, reference, error: initError } = await initRes.json()
      if (initError) throw new Error(initError)
      if (!accessCode || !reference) {
        throw new Error('Payment initialization returned no access code. Please try again.')
      }

      await loadPaystackScript()
      if (!window.PaystackPop) {
        throw new Error('Payment system failed to load. Please refresh and try again.')
      }

      const handler = window.PaystackPop.setup({
        key:         process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
        access_code: accessCode,
        ref:         reference,

        onClose: () => {
          setLoading(false)
        },

        callback: async (response: { reference: string }) => {
          try {
            const confirmRes = await fetch('/api/pay/confirm', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reference: response.reference }),
            })
            const confirmData = await confirmRes.json()
            if (confirmRes.ok && confirmData.success) {
              window.location.href = '/dashboard?welcome=1'
            } else {
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
      console.error('[checkout]', err)
      setError(err.message || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }, [supabase])

  return { initiateCheckout, loading, error, clearError }
}
