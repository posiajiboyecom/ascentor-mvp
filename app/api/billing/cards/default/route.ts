// POST /api/billing/cards/default   body: { cardId }
// Makes one of the member's own cards the default. Returns { cards } (the fresh list).
import { NextRequest, NextResponse } from 'next/server';
import { requireBillingMember } from '@/lib/billing/api';
import { setDefaultCard, listCards } from '@/lib/billing/cards';
import { parseJson } from '@/lib/validation/http';
import { billingCardDefault } from '@/lib/validation/schemas/billing';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const g = await requireBillingMember();
  if (!g.ok) return g.response;
  const parsed = await parseJson(req, billingCardDefault);
  if (!parsed.ok) return parsed.response;
  const r = await setDefaultCard(g.userId, parsed.data.cardId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ cards: await listCards(g.userId) });
}
