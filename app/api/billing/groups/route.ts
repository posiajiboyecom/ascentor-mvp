// GET  /api/billing/groups   The signed-in member's group: { inGroup, group:{code,link}, activeCount, needed, status, underReview, statusText, canSwitchAt }.
//                            ACTIVE COUNT ONLY. Never who failed to pay, never payment details, never other members.
// POST /api/billing/groups   Starts a group for the member (or returns the one they are already in). Returns { group, existing }.
// 404 when BILLING_V2 is off, 401 when not signed in.
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireBillingMember } from '@/lib/billing/api';
import { createGroup, deviceHintFrom, getGroupStatus } from '@/lib/billing/groups';

export const dynamic = 'force-dynamic';

export async function GET() {
  const g = await requireBillingMember();
  if (!g.ok) return g.response;
  return NextResponse.json(await getGroupStatus(g.userId));
}

export async function POST() {
  const g = await requireBillingMember();
  if (!g.ok) return g.response;
  const r = await createGroup(g.userId, { device: deviceHintFrom(await headers()) });
  if (!r.ok) return NextResponse.json({ error: r.error, canSwitchAt: r.canSwitchAt ?? null }, { status: 400 });
  return NextResponse.json({ group: r.group, existing: r.existing });
}
