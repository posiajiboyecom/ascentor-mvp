// app/(marketing)/elevation-summit/page.tsx
// Server component wrapper — fetches CMS content and passes it to the
// client component (ElevationSummitClient.tsx) which owns the
// registration form state. Same split pattern as app/page.tsx →
// app/LandingPageClient.tsx.
import type { Metadata } from 'next';
import { getPublishedPage } from '@/lib/supabase/queries/marketing';
import ElevationSummitClient from './ElevationSummitClient';

export const metadata: Metadata = {
  title: 'The Elevation Summit',
  description: 'One gathering. One decision. The rest of your life. The Elevation Summit — February 2027, Lagos.',
};

export default async function ElevationSummitPage() {
  const cms = await getPublishedPage('elevation-summit');
  return <ElevationSummitClient cms={cms} />;
}
