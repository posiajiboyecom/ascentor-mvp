import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// ============================================================
// API — /api/careers
// GET  → public, returns all active job listings
// POST / PATCH / DELETE → protected, admin only (handled by
//   the admin page via direct Supabase client with RLS)
// ============================================================

export async function GET() {
  const supabase = await createClient();

  const { data: jobs, error } = await supabase
    .from('job_listings')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ jobs: jobs || [] });
}
