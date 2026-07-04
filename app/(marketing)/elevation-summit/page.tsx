// app/(marketing)/elevation-summit/page.tsx
// Server component wrapper — fetches CMS content and passes it to the
// client component (ElevationSummitClient.tsx) which owns the
// registration form state. Same split pattern as app/page.tsx →
// app/LandingPageClient.tsx.
//
// SEO: full metadata + Event JSON-LD (hybrid: physical Lagos venue +
// virtual access). Event constants live in lib/seo.ts (SUMMIT) — update
// the exact date/venue/prices there, not here.
import type { Metadata } from 'next';
import { getPublishedPage } from '@/lib/supabase/queries/marketing';
import { SITE_URL, SUMMIT, getSummitEventSchema, getBreadcrumbSchema } from '@/lib/seo';
import ElevationSummitClient from './ElevationSummitClient';

export const metadata: Metadata = {
  title: 'The Elevation Summit 2026 — Lagos | Physical & Virtual',
  description:
    'One gathering. One decision. The rest of your life. The inaugural Elevation Summit — December 2026 at the Femi Gbajabiamila Conference Centre, LASU, Lagos, with global virtual access. Register now.',
  alternates: { canonical: `${SITE_URL}/elevation-summit` },
  openGraph: {
    title: 'The Elevation Summit 2026 — Lagos',
    description:
      'A movement for purposeful living, leadership, and legacy. December 2026, Lagos — attend in person or join virtually from anywhere in the world.',
    url: `${SITE_URL}/elevation-summit`,
    siteName: 'Ascentor',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Elevation Summit 2026 — Lagos',
    description:
      'One gathering. One decision. The rest of your life. December 2026 · Lagos · Physical & Virtual.',
  },
  keywords: [
    'The Elevation Summit',
    'Elevation Summit Lagos',
    'Elevation Summit 2026',
    'leadership conference Lagos 2026',
    'personal development events Nigeria',
    'purposeful living conference',
  ],
};

export default async function ElevationSummitPage() {
  const cms = await getPublishedPage('elevation-summit');
  const jsonLd = [
    getSummitEventSchema(),
    getBreadcrumbSchema([
      { name: 'Home', url: SITE_URL },
      { name: SUMMIT.name, url: `${SITE_URL}/elevation-summit` },
    ]),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ElevationSummitClient cms={cms} />
    </>
  );
}
