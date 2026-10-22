// POST /api/billing/groups/leave   (no body). Takes the member out of their group. Switching to another group is then limited to once every 90 days.
import { NextResponse } from 'next/server';
import { requireBillingMember } from '@/lib/billing/api';
import { leaveGroup } from '@/lib/billing/groups';

export const dynamic = 'force-dynamic';

export async function POST() {
  const g = await requireBillingMember();
  if (!g.ok) return g.response;
  const r = await leaveGroup(g.userId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
