// POST /api/billing/cards/start   body (optional): { returnTo: 'settings' | 'checkout' }
// Starts the card check (₦50 in Nigeria, $1 elsewhere, refunded) on Paystack's hosted page (card channel only).
// The currency is decided here, never by the client: the member's subscription currency, else where they are now.
// Returns { authorizationUrl, reference }. After paying, Paystack sends the member back to
// /settings/billing?card=verify&reference=... (or /checkout?card=verify&reference=... from the v2 checkout)
// and the page calls POST /api/billing/cards/verify.
import { NextRequest, NextResponse } from 'next/server';
import { requireBillingMember } from '@/lib/billing/api';
import { startCardVerification } from '@/lib/billing/cards';
import { billingCardStart } from '@/lib/validation/schemas/billing';
import { requestCurrency } from '@/lib/geo';
import { billingCurrencyFor } from '@/lib/billing/currency';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const g = await requireBillingMember();
  if (!g.ok) return g.response;
  if (!g.email) return NextResponse.json({ error: 'Your account has no email address.' }, { status: 400 });
  let body: unknown = {};
  try { const t = await req.text(); body = t.trim() ? JSON.parse(t) : {}; } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  const parsed = billingCardStart.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const currency = await billingCurrencyFor(g.userId, requestCurrency(req));
  const r = await startCardVerification(g.userId, g.email, parsed.data.returnTo ?? 'settings', currency);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
  return NextResponse.json({ authorizationUrl: r.authorizationUrl, reference: r.reference });
}
