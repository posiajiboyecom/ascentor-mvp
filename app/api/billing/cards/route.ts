// GET /api/billing/cards
// The signed-in member's saved cards. SAFE fields only: id, brand, last4, expMonth, expYear, bank, isDefault.
// 404 when BILLING_V2 is off, 401 when not signed in.
import { NextResponse } from 'next/server';
import { requireBillingMember } from '@/lib/billing/api';
import { listCards } from '@/lib/billing/cards';

export const dynamic = 'force-dynamic';

export async function GET() {
  const g = await requireBillingMember();
  if (!g.ok) return g.response;
  return NextResponse.json({ cards: await listCards(g.userId) });
}
