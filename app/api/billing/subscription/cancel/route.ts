// POST /api/billing/subscription/cancel   (no body)
// Trial: cancelled at once and never charged. Paid: stays active until the end of the paid period, then stops.
// Returns { state, accessUntil }.
import { NextResponse } from 'next/server';
import { requireBillingMember } from '@/lib/billing/api';
import { cancel } from '@/lib/billing/subscriptions';

export const dynamic = 'force-dynamic';

export async function POST() {
  const g = await requireBillingMember();
  if (!g.ok) return g.response;
  const r = await cancel(g.userId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ state: r.state, accessUntil: r.accessUntil ? r.accessUntil.toISOString() : null });
}
