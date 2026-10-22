// POST /api/billing/subscription/change   body: { tier?, cycle? }
// Trial: applies now. Paid: takes effect at the next billing date (the plan already paid for stays until then).
// Returns { effective: 'now'|'next_billing_date', effectiveAt }.
import { NextRequest, NextResponse } from 'next/server';
import { requireBillingMember } from '@/lib/billing/api';
import { changePlan } from '@/lib/billing/subscriptions';
import { parseJson } from '@/lib/validation/http';
import { billingPlanChange } from '@/lib/validation/schemas/billing';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const g = await requireBillingMember();
  if (!g.ok) return g.response;
  const parsed = await parseJson(req, billingPlanChange);
  if (!parsed.ok) return parsed.response;
  const r = await changePlan(g.userId, parsed.data);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ effective: r.effective, effectiveAt: r.effectiveAt ? r.effectiveAt.toISOString() : null });
}
