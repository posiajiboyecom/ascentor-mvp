'use client'

// components/useCheckout.ts — REDIRECTOR (legacy compatibility shim)
// ─────────────────────────────────────────────────────────────────────────────
// This file previously called /api/payments/initialize which no longer exists.
// All checkout now goes through /api/pay/start (Payment System v3).
//
// This shim re-exports useCheckout from the canonical location so any
// remaining imports of this file don't break, without duplicating logic.
// ─────────────────────────────────────────────────────────────────────────────

export { useCheckout } from '@/app/pricing/components/useCheckout'
export type { CheckoutOptions } from '@/app/pricing/components/useCheckout'
