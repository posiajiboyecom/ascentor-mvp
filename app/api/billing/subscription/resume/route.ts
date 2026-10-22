// POST /api/billing/subscription/resume   (no body)
// Undoes a pending cancel, or restores a cancelled trial or paid period that has not ended. Returns { state }.
import { NextResponse } from 'next/server';
import { requireBillingMember } from '@/lib/billing/api';
import { resume } from '@/lib/billing/subscriptions';

export const dynamic = 'force-dynamic';

export async function POST() {
  const g = await requireBillingMember();
  if (!g.ok) return g.response;
  const r = await resume(g.userId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ state: r.state });
}
