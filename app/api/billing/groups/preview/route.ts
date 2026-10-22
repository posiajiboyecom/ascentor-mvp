// GET /api/billing/groups/preview?code=ASC-7K2Q  (or ?token=...)
// Whether a code or link works. Signed-in members only. Returns { found, joinable, message, code } and no member data at all.
import { NextRequest, NextResponse } from 'next/server';
import { requireBillingMember } from '@/lib/billing/api';
import { previewGroup } from '@/lib/billing/groups';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const g = await requireBillingMember();
  if (!g.ok) return g.response;
  const code = req.nextUrl.searchParams.get('code') ?? undefined;
  const token = req.nextUrl.searchParams.get('token') ?? undefined;
  if (!code && !token) return NextResponse.json({ error: 'Send a code or a token.' }, { status: 400 });
  return NextResponse.json(await previewGroup({ code, token }));
}
