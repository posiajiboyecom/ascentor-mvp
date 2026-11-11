// app/(marketing)/events/[slug]/page.tsx
// Server component - fetches event data and renders the registration page.
// Route: /events/[slug]  e.g. /events/elevation-summit-2026

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase/admin';
import EventPageClient from './EventPageClient';
import PublicShell from '@/components/layout/PublicShell';
import { SITE_URL, generatePageMetadata, getPublicEventSchema, getBreadcrumbSchema, jsonLdString } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await supabaseAdmin
    .from('public_events')
    .select('title, tagline, description')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!data) return { title: 'Event not found', robots: { index: false } };
  return generatePageMetadata({
    title: data.title,
    description: data.tagline || data.description?.slice(0, 160) || `${data.title}, an Ascentor event.`,
    path: `/events/${slug}`,
  });
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;

  const { data: event } = await supabaseAdmin
    .from('public_events')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!event) notFound();

  const eventLd = getPublicEventSchema(event);
  const crumbs = getBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: event.title, url: `${SITE_URL}/events/${slug}` },
  ]);

  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(eventLd ? [eventLd, crumbs] : crumbs) }} />
      <EventPageClient event={event} />
    </PublicShell>
  );
}
