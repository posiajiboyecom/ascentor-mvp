// GET /api/cron/keepalive
// Lightweight "is the database awake" ping. Authenticates with the CRON_SECRET bearer token like the
// other cron routes. The daily job (/api/cron/daily) already calls it; point an external scheduler here
// (for example cron-job.org every 6 hours) if you want more than one touch per day.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { pingDatabase } from '@/lib/keepalive';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(req.headers.get('authorization') ?? '');
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 });
  }
  if (!isAuthorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await pingDatabase();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
