'use client'

// ================================================================
// usePaystack.ts  — NEW PAYMENT SYSTEM (clean rewrite)
// ================================================================
// Logic:
//   1. Check user is logged in via Supabase session
//   2. POST to /api/pay/start  → gets Paystack access_code + reference
//   3. Open Paystack popup with access_code
//   4. On popup success → POST to /api/pay/confirm with reference
//   5. Redirect to /dashboard on success
//
// NO amount sent. NO currency sent. Plan code carries everything.
// Paystack reads amount + currency directly from the plan object.
// ================================================================

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface PayOptions {
  planCode: string   // Paystack plan code e.g. PLN_4v5qnnjk9rt6cdk
  planId:   string   // Your internal ID: 'builder' | 'pro' | 'elite'
  planName: string   // Display name e.g. 'Explorer'
  billing:  'monthly' | 'annual'
}

export interface UsePaystackReturn {
  pay:     (opts: PayOptions) => Promise<void>
  loading: boolean
  error:   string | null
  clearError: () => void
}

// Declare global PaystackPop type
declare global {
  interface Window {
    PaystackPop?: {
      setup: (config: Record<string, unknown>) => { openIframe: () => void }
    }
  }
}

// Load Paystack script once — idempotent
function ensurePaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve()
    if (document.getElementById('ps-inline-script')) {
      // Script tag exists but not yet loaded — wait for it
      const existing = document.getElementById('ps-inline-script') as HTMLScriptElement
      existing.addEventListener('load',  () => resolve())
      existing.addEventListener('error', () => reject(new Error('Paystack script failed to load')))
      return
    }
    const s    = document.createElement('script')
    s.id       = 'ps-inline-script'
    s.src      = 'https://js.paystack.co/v1/inline.js'
    s.async    = true
    s.onload   = () => resolve()
    s.onerror  = () => reject(new Error('Could not load payment system. Check your internet connection.'))
    document.head.appendChild(s)
  })
}

export function usePaystack(): UsePaystackReturn {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const supabase = createClient()

  // Pre-warm the Paystack script on mount so it's ready on first click
  useEffect(() => {
    ensurePaystackScript().catch(() => {
      // Silent — will retry on click
    })
  }, [])

  const pay = useCallback(async (opts: PayOptions) => {
    setLoading(true)
    setError(null)

    try {
      // ── Step 1: Verify user is logged in ─────────────────────────
      const { data: { user }, error: authErr } = await supabase.auth.getUser()

      if (authErr || !user?.email) {
        // Not logged in — send to login with return path
        window.location.href = '/login?redirect=/pricing'
        return
      }

      // ── Step 2: Create transaction on server ──────────────────────
      const startRes = await fetch('/api/pay/start', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planCode: opts.planCode,
          planId:   opts.planId,
          planName: opts.planName,
          billing:  opts.billing,
        }),
        // Include session cookie automatically (same-origin)
      })

      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}))
        throw new Error(err.error || `Failed to start payment (${startRes.status})`)
      }

      const { accessCode, reference } = await startRes.json()

      if (!accessCode || !reference) {
        throw new Error('Payment setup failed — no access code returned. Please try again.')
      }

      // ── Step 3: Load Paystack script ─────────────────────────────
      await ensurePaystackScript()

      if (!window.PaystackPop) {
        throw new Error('Payment system unavailable. Please refresh the page and try again.')
      }

      // ── Step 4: Open Paystack popup ───────────────────────────────
      const handler = window.PaystackPop.setup({
        key:         process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
        access_code: accessCode,
        ref:         reference,

        onClose: () => {
          // User closed popup without paying
          setLoading(false)
          setError('Payment was not completed. Try again whenever you\'re ready.')
        },

        callback: async (response: { reference: string }) => {
          // ── Step 5: Confirm payment on server ──────────────────
          try {
            const confirmRes = await fetch('/api/pay/confirm', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reference: response.reference }),
            })

            const confirmData = await confirmRes.json()

            if (confirmRes.ok && confirmData.success) {
              // ✅ Success — redirect to dashboard
              window.location.href = '/dashboard?welcome=1'
            } else {
              // Payment went through but confirmation had an issue.
              // Webhook will reconcile. Don't leave user stranded.
              console.error('[usePaystack] confirm error:', confirmData)
              window.location.href = '/dashboard?payment=processing'
            }
          } catch (confirmErr) {
            console.error('[usePaystack] confirm fetch error:', confirmErr)
            // Payment likely succeeded — webhook will reconcile
            window.location.href = '/dashboard?payment=processing'
          } finally {
            setLoading(false)
          }
        },
      })

      handler.openIframe()

    } catch (err: any) {
      console.error('[usePaystack]', err)
      setError(err.message || 'Something went wrong. Please try again or contact support.')
      setLoading(false)
    }
  }, [supabase])

  const clearError = useCallback(() => setError(null), [])

  return { pay, loading, error, clearError }
}
