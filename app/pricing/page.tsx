// app/pricing/page.tsx — v3
// Reads x-currency and x-country set by the proxy (localeDetection.ts).
// Non-NG visitors automatically get USD pricing shown; all payments via Paystack.

import type { Metadata } from 'next'
import { headers } from 'next/headers'
import type { Currency } from './data'
import PricingClient from './PricingClient'

export const metadata: Metadata = {
  title: 'Pricing — Ascentor',
  description: 'AI-powered leadership coaching for African professionals. Free to start, upgrade when ready.',
  openGraph: {
    title: 'Pricing — Ascentor',
    description: 'Invest in your career. Free forever plan available.',
    url: 'https://ascentorbi.com/pricing',
  },
}

export default async function PricingPage() {
  const headersList = await headers()
  // Set by proxy (localeDetection.ts) — falls back to ngn / NG if not present
  const currency = (headersList.get('x-currency') as Currency | null) ?? 'ngn'
  const country  = headersList.get('x-country') ?? 'NG'

  return <PricingClient defaultCurrency={currency} defaultCountry={country} />
}
