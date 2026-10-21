// GET /api/search?q=…
// Global search for the member app's command palette. Runs with the caller's own session (not the service
// role) so row-level security decides what each member can see. The query itself lives in lib/rx/search.ts,
// shared with the Search page.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runSearch } from '@/lib/rx/search';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sections = await runSearch(req.nextUrl.searchParams.get('q') ?? '', 6);
  return NextResponse.json({
    groups: sections.map((s) => ({
      label: s.label,
      items: s.items.map((i) => ({ title: i.title, subtitle: i.meta, href: i.href })),
    })),
  });
}
