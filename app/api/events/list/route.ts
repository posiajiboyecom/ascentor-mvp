// app/api/events/list/route.ts
// Public endpoint — returns all published events for the nav dropdown.
// Cached at the edge for 60s so the nav doesn't hit the DB on every request.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 60;

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('public_events')
    .select('slug, title, tagline, event_date, location, is_featured')
    .eq('is_published', true)
    .order('is_featured', { ascending: false })
    .order('event_date_iso', { ascending: true });

  if (error) {
    return NextResponse.json({ events: [] });
  }
  return NextResponse.json({ events: data ?? [] });
}
