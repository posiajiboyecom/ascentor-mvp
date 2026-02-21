// ============================================================
// FEATURE #5: Usage Check API — /api/usage/check
// GET /api/usage/check?feature=coachingSessions
// Returns: { allowed, used, limit, remaining, message? }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkUsage } from '@/lib/session-limits';

export async function GET(req: NextRequest) {
  try {
    const feature = req.nextUrl.searchParams.get('feature');
    if (!feature) {
      return NextResponse.json({ error: 'Missing feature parameter' }, { status: 400 });
    }

    // Get authenticated user from Supabase auth header
    const authHeader = req.headers.get('authorization');
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader || '' } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await checkUsage(
      user.id,
      feature as any,
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Usage check error:', err);
    return NextResponse.json({ error: 'Failed to check usage' }, { status: 500 });
  }
}
