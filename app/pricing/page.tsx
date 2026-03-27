// app/pricing/page.tsx — reads x-currency set by proxy locale detection

import type { Metadata } from 'next'
import { headers } from 'next/headers'
import type { Currency } from './data'
import PricingClient from './PricingClient'

export const metadata: Metadata = {
  title: 'Pricing — Ascentor',
  description: 'AI-powered leadership coaching for African professionals. Free to start, upgrade when ready.',
  openGraph: {
    title: 'Ascentor Pricing',
    description: 'Invest in your career. Free forever plan available.',
    url: 'https://ascentorbi.com/pricing',
  },
}

export default function PricingPage() {
  const headersList = headers()
  // Set by proxy via localeDetection.ts — falls back to ngn if not present
  const currency = (headersList.get('x-currency') as Currency | null) ?? 'ngn'
  const country  = headersList.get('x-country') ?? 'NG'

  return <PricingClient defaultCurrency={currency} defaultCountry={country} />
}
