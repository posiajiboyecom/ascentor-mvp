// app/pricing/page.tsx
// Public pricing: Seeker, Builder, Pinnacle and Ascentor for Teams (coming soon), in the visitor's currency
// (naira in Nigeria, US dollars elsewhere, decided on the server from where they are).
import type { Metadata } from 'next';
import '@/styles/marketing.css';
import PublicShell from '@/components/layout/PublicShell';
import PricingSection from '@/components/marketing/PricingSection';
import { visitorCurrency } from '@/lib/geo';
import { publicPricing } from '@/lib/pricing-public';
import { generatePageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = generatePageMetadata({
  title: 'Pricing',
  description: 'Seeker, Builder and Pinnacle. Every plan starts with 7 days free. Naira in Nigeria, US dollars everywhere else.',
  path: '/pricing',
});

export default async function PricingPage() {
  const pricing = publicPricing(await visitorCurrency());
  return (
    <PublicShell>
      <PricingSection pricing={pricing} headingLevel={1} />
    </PublicShell>
  );
}
