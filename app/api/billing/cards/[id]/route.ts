// DELETE /api/billing/cards/:id
// Removes one of the member's own cards (soft delete; the stored authorization is wiped). The last card cannot be removed
// while the subscription is on a trial, active or in grace, unless it is cancelled. Returns { cards } (the fresh list).
import { NextRequest, NextResponse } from 'next/server';
import { requireBillingMember } from '@/lib/billing/api';
import { removeCard, listCards } from '@/lib/billing/cards';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireBillingMember();
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Card not found.' }, { status: 404 });
  const r = await removeCard(g.userId, id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ cards: await listCards(g.userId) });
}
