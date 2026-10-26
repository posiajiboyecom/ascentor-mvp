// app/(marketing)/elevation-summit/page.tsx
// Server component wrapper - fetches CMS content and passes it to the
// client component (ElevationSummitClient.tsx) which owns the
// registration form state. Same split pattern as app/page.tsx →
// app/LandingPageClient.tsx.
//
// SEO: full metadata + Event JSON-LD (hybrid: physical Lagos venue +
// virtual access). Event constants live in lib/seo.ts (SUMMIT) - update
// the exact date/venue/prices there, not here.
import { getPublishedPage } from '@/lib/supabase/queries/marketing';
import { SITE_URL, SUMMIT, getSummitEventSchema, getBreadcrumbSchema, pageMeta } from '@/lib/seo';
import ElevationSummitClient from './ElevationSummitClient';
import PublicShell from '@/components/layout/PublicShell';

// TODO(posi): date is 19 November 2026 everywhere in metadata (the og and twitter text used to say December). Confirm.
export const metadata = pageMeta({
  title: 'The Elevation Summit 2026: 19 November, Lagos and Online',
  description:
    'Free one-day summit on 19 Nov 2026 at Lagos State University, with global virtual access. Theme: The Rise We Choose. See speakers and register.',
  path: '/elevation-summit',
  image: '/images/elevation-summit-flyer-v3.jpg',
});

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
    <PublicShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ElevationSummitClient cms={cms} />
    </PublicShell>
  );
}
