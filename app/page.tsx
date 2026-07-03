// app/page.tsx
// ============================================================
// Server component wrapper for the landing page. Fetches published
// CMS content (currently: Hero section only — see
// app/LandingPageClient.tsx header comment for wiring status) via
// getPublishedPage(), then hands off to LandingPageClient for
// rendering and all interactive behavior (newsletter form, mobile
// menu, etc.).
//
// This split exists because getPublishedPage() uses the server
// Supabase client (lib/supabase/server.ts), which only works in a
// Server Component — the original single-file landing page was
// entirely 'use client', so it couldn't call it directly. Moving
// the interactive logic into LandingPageClient.tsx and keeping this
// file as a thin server wrapper is the same pattern already
// established elsewhere in this codebase (see
// app/(app)/community/page.tsx -> CommunityClient.tsx).
//
// NOTE: app/LandingClient.tsx (no "Page" in the name) is a DIFFERENT,
// pre-existing, orphaned file from an earlier landing-page iteration
// — it is not used anywhere and was not touched by this change. Do
// not confuse it with app/LandingPageClient.tsx, which is the one
// this file actually renders.
// ============================================================

import { getPublishedPage } from '@/lib/supabase/queries/marketing';
import LandingPageClient from './LandingPageClient';

export default async function LandingPage() {
  const cms = await getPublishedPage('landing');

  return <LandingPageClient cms={cms} />;
}
