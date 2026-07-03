// app/(marketing)/events/[slug]/page.tsx
// Server component — fetches event data and renders the registration page.
// Route: /events/[slug]  e.g. /events/elevation-summit-2027

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase/admin';
import EventPageClient from './EventPageClient';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await supabaseAdmin
    .from('public_events')
    .select('title, tagline')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!data) return { title: 'Event | Ascentor' };
  return {
    title: `${data.title} | Ascentor`,
    description: data.tagline || undefined,
  };
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

  return <EventPageClient event={event} />;
}
