// POST /api/billing/cards/verify   body: { reference }
// Verifies the card check with Paystack, saves the card in that check's currency, and refunds the check.
// Returns { card, added, refund }. Safe to call twice (the webhook may have saved the card already).
import { NextRequest, NextResponse } from 'next/server';
import { requireBillingMember } from '@/lib/billing/api';
import { completeCardVerification } from '@/lib/billing/cards';
import { parseJson } from '@/lib/validation/http';
import { billingCardVerify } from '@/lib/validation/schemas/billing';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const g = await requireBillingMember();
  if (!g.ok) return g.response;
  const parsed = await parseJson(req, billingCardVerify);
  if (!parsed.ok) return parsed.response;
  const r = await completeCardVerification(g.userId, parsed.data.reference);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ card: r.card, added: r.added, refund: r.refund });
}
