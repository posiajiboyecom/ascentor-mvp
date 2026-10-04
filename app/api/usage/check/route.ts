// app/api/usage/check/route.ts
// GET  /api/usage/check?feature=coachingSessions
// POST /api/usage/check  { feature: 'coachingSessions' }
// Returns: { allowed, used, limit, remaining, message? }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkUsage } from '@/lib/session-limits';
import { parseJson, parseQuery } from '@/lib/validation/http';
import * as memberSchemas from '@/lib/validation/schemas/member';

async function handleCheck(feature: string | null) {
  if (!feature) {
    return NextResponse.json({ error: 'Missing feature parameter' }, { status: 400 });
  }

  // Use server-side Supabase client - reads session from cookies automatically
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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
}

export async function GET(req: NextRequest) {
  try {
    const parsed = parseQuery(req, memberSchemas.usageFeature);
    if (!parsed.ok) return parsed.response;
    return await handleCheck(parsed.data.feature);
  } catch (err: any) {
    console.error('Usage check (GET) error:', err);
    return NextResponse.json({ error: 'Failed to check usage' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJson(req, memberSchemas.usageFeature);
    if (!parsed.ok) return parsed.response;
    return await handleCheck(parsed.data.feature);
  } catch (err: any) {
    console.error('Usage check (POST) error:', err);
    return NextResponse.json({ error: 'Failed to check usage' }, { status: 500 });
  }
}
