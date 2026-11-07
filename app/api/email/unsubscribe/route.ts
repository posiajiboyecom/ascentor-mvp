// One-click unsubscribe (RFC 8058). Mail apps POST here from the List-Unsubscribe header: ?t=<token>.
// A GET (someone opening the header link in a browser) goes to the unsubscribe page, which asks before acting.
import { NextResponse } from 'next/server';
import { emailDb, SITE_URL } from '@/lib/email/system';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const t = new URL(req.url).searchParams.get('t') ?? '';
  if (!UUID.test(t)) return NextResponse.json({ ok: false }, { status: 400 });
  const { error } = await emailDb().rpc('email_unsubscribe', { t, src: 'one_click' });
  return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
}

export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get('t') ?? '';
  return NextResponse.redirect(`${SITE_URL}/unsubscribe/${UUID.test(t) ? t : 'preview'}`, 302);
}
