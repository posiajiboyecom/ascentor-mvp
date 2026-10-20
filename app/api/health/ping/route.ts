// GET /api/health/ping
// A tiny public endpoint the app uses to measure how good the connection is. No auth, no database, no body.
export const dynamic = 'force-dynamic';

export function GET() {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
export const HEAD = GET;
