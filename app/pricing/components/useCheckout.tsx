'use client'

import { useState } from 'react'
import { Currency } from '../data'

interface CheckoutOptions {
  planCode: string
  planName: string
  currency: Currency | 'usd'
}

export function useCheckout() {
  const [loading, setLoading] = useState(false)

  async function initiateCheckout({ planCode, planName, currency }: CheckoutOptions) {
    setLoading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode, planName, currency }),
      })
      const data = await res.json()
      if (data?.authorizationUrl) {
        window.location.href = data.authorizationUrl
      }
    } catch (err) {
      console.error('Checkout error:', err)
    } finally {
      setLoading(false)
    }
  }

  return { initiateCheckout, loading }
}