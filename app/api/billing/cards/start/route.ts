// POST /api/billing/cards/start   (no body)
// Starts the NGN 50 card check on Paystack's hosted page (card channel only).
// Returns { authorizationUrl, reference }. After paying, Paystack sends the member back to
// /settings/billing?card=verify&reference=... and the page calls POST /api/billing/cards/verify.
import { NextResponse } from 'next/server';
import { requireBillingMember } from '@/lib/billing/api';
import { startCardVerification } from '@/lib/billing/cards';

export const dynamic = 'force-dynamic';

export async function POST() {
  const g = await requireBillingMember();
  if (!g.ok) return g.response;
  if (!g.email) return NextResponse.json({ error: 'Your account has no email address.' }, { status: 400 });
  const r = await startCardVerification(g.userId, g.email);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
  return NextResponse.json({ authorizationUrl: r.authorizationUrl, reference: r.reference });
}
