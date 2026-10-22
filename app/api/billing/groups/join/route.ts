// POST /api/billing/groups/join   body: { code } or { token }
// Rules: one group per person; blocked if the member joined a group in the last 90 days (the message says when they can switch);
// at most 10 members; each code has 10 uses and expires. Returns { group, already } or { error, reason, canSwitchAt }.
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { requireBillingMember } from '@/lib/billing/api';
import { deviceHintFrom, joinByCode, joinByToken } from '@/lib/billing/groups';
import { parseJson } from '@/lib/validation/http';
import { billingGroupJoin } from '@/lib/validation/schemas/billing';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const g = await requireBillingMember();
  if (!g.ok) return g.response;
  const parsed = await parseJson(req, billingGroupJoin);
  if (!parsed.ok) return parsed.response;
  const ctx = { device: deviceHintFrom(await headers()) };
  const r = parsed.data.code ? await joinByCode(g.userId, parsed.data.code, ctx) : await joinByToken(g.userId, parsed.data.token!, ctx);
  if (!r.ok) return NextResponse.json({ error: r.error, reason: r.reason, canSwitchAt: r.canSwitchAt ?? null }, { status: r.reason === 'not_found' ? 404 : 400 });
  return NextResponse.json({ group: r.group, already: r.already });
}
