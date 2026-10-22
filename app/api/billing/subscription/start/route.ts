// POST /api/billing/subscription/start   body: { tier: 'explorer'|'builder', cycle: 'monthly'|'yearly' }
// Starts the 7 day trial. Needs a default card (see /api/billing/cards/*). First charge is on day 8.
import { NextRequest, NextResponse } from 'next/server';
import { requireBillingMember } from '@/lib/billing/api';
import { startTrial } from '@/lib/billing/subscriptions';
import { parseJson } from '@/lib/validation/http';
import { billingTrialStart } from '@/lib/validation/schemas/billing';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const g = await requireBillingMember();
  if (!g.ok) return g.response;
  const parsed = await parseJson(req, billingTrialStart);
  if (!parsed.ok) return parsed.response;
  const r = await startTrial(g.userId, parsed.data);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({
    state: r.subscription.state, planCode: r.subscription.planCode,
    trialEndsAt: r.subscription.trialEndsAt?.toISOString() ?? null, nextChargeAt: r.subscription.nextChargeAt?.toISOString() ?? null,
  });
}
