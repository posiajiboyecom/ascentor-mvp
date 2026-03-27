// app/pricing/page.tsx
// Server component — exports metadata, renders the client pricing shell.

import type { Metadata } from 'next'
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
  return <PricingClient />
}
