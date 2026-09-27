// app/(marketing)/donate/page.tsx
// Server component wrapper, same split pattern as the Elevation Summit page:
// metadata here, form state in the client component.
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo';
import DonateClient from './DonateClient';
import PublicShell from '@/components/layout/PublicShell';

export const metadata: Metadata = {
  title: 'Donate',
  description:
    'Support Ascentor and The Elevation Summit. Choose a suggested amount or give a custom amount, paid securely online.',
  alternates: { canonical: `${SITE_URL}/donate` },
  openGraph: {
    title: 'Donate | Ascentor',
    description: 'Support Ascentor and The Elevation Summit with a secure online donation.',
    url: `${SITE_URL}/donate`,
    siteName: 'Ascentor',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Donate | Ascentor',
    description: 'Support Ascentor and The Elevation Summit with a secure online donation.',
  },
};

export default function DonatePage() {
  return (
    <PublicShell>
      <DonateClient />
    </PublicShell>
  );
}
