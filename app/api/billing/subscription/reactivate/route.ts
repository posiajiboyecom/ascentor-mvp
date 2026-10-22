// POST /api/billing/subscription/reactivate   (no body)
// A lapsed or ended member pays again now: charges their default card. Access returns the moment the charge clears.
// Returns { charged }. The engine honours BILLING_V2_CHARGING; with charging off nothing is taken and the error says so.
import { NextResponse } from 'next/server';
import { requireBillingMember } from '@/lib/billing/api';
import { reactivate } from '@/lib/billing/subscriptions';

export const dynamic = 'force-dynamic';

export async function POST() {
  const g = await requireBillingMember();
  if (!g.ok) return g.response;
  const r = await reactivate(g.userId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ charged: r.charged });
}
