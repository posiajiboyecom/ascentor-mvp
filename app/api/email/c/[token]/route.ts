// GET /api/email/c/<token>?u=<url>&s=<sig>: a tracked link in a campaign email. Records the click, then redirects.
// The signature ties the URL to the email it was in, so this can never be used to send people somewhere else.
import { NextResponse } from 'next/server';
import { emailDb, SITE_URL, verifyLink } from '@/lib/email/system';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const q = new URL(req.url).searchParams;
  const url = q.get('u') ?? '';
  const sig = q.get('s') ?? '';
  let ok = false;
  try { ok = UUID.test(token) && /^https?:\/\//i.test(url) && !!new URL(url) && verifyLink(token, url, sig); } catch { ok = false; }
  if (!ok) return NextResponse.redirect(SITE_URL, 302);
  try { await emailDb().rpc('email_track', { t: token, kind: 'click' }); } catch { /* still redirect */ }
  return NextResponse.redirect(url, 302);
}
