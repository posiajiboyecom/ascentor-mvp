// GET /api/summit/verify?r=<registration id>&t=<token>
// The link in the confirmation email. It proves the address is real: the registrant's own email is stamped as confirmed and, if they
// came through someone's referral link, that referral now counts and the referrer is told. Safe to click twice.
import { NextRequest, NextResponse } from 'next/server';
import { confirmEmail, tokenOk } from '@/lib/summitReferral';

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(req: NextRequest) {
  const r = req.nextUrl.searchParams.get('r') ?? '';
  const t = req.nextUrl.searchParams.get('t') ?? '';
  const back = (state: string) => NextResponse.redirect(new URL(`/elevation-summit/confirmed?email=${state}`, req.nextUrl.origin), 303);
  if (!UUID.test(r) || !tokenOk(r, t)) return back('invalid');
  try { await confirmEmail(r); } catch (e) { console.error('[summit/verify] failed:', (e as Error).message); return back('error'); }
  return back('confirmed');
}
