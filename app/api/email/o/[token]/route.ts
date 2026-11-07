// GET /api/email/o/<token>: the open pixel in campaign emails. Records the open and returns a transparent 1×1 GIF.
import { emailDb } from '@/lib/email/system';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (UUID.test(token)) { try { await emailDb().rpc('email_track', { t: token, kind: 'open' }); } catch { /* the image still loads */ } }
  return new Response(GIF, { headers: { 'Content-Type': 'image/gif', 'Content-Length': String(GIF.length), 'Cache-Control': 'no-store, no-cache, must-revalidate, private' } });
}
