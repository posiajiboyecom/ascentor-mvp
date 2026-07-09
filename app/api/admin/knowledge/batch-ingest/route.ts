// app/api/admin/knowledge/batch-ingest/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/admin/knowledge/batch-ingest
//
// Kicks off the knowledge-batch-ingester Trigger.dev task.
// Accepts a list of URL/YouTube sources or a list of already-
// uploaded PDF storage paths.
//
// Body:
//   {
//     type: 'urls' | 'pdfs'
//     items: BatchURLItem[] | BatchPDFItem[]
//   }
//
// BatchURLItem:
//   { url, mentorSlug, namespace, sourceTitle, tags? }
//
// BatchPDFItem:
//   { storagePath, fileName, mentorSlug, namespace, sourceTitle, tags? }
// ─────────────────────────────────────────────────────────────

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tasks } from '@trigger.dev/sdk/v3';

export async function POST(req: Request) {
  // ── Auth + admin gate ──────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'moderator'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Parse body ─────────────────────────────────────────────
  let body: { type: 'urls' | 'pdfs'; items: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { type, items } = body;

  if (!type || !['urls', 'pdfs'].includes(type)) {
    return NextResponse.json({ error: 'type must be "urls" or "pdfs"' }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items array is required and must not be empty' }, { status: 400 });
  }
  if (items.length > 50) {
    return NextResponse.json({ error: 'Maximum 50 items per batch' }, { status: 400 });
  }

  // ── Fire Trigger.dev task ──────────────────────────────────
  try {
    const handle = await tasks.trigger('knowledge-batch-ingester', {
      type,
      items,
      triggeredBy: user.id,
    });

    return NextResponse.json({
      success:  true,
      runId:    handle.id,
      itemCount: items.length,
      message:  `Batch ingestion queued — ${items.length} ${type === 'pdfs' ? 'PDFs' : 'URLs'} being processed in the background.`,
    });
  } catch (err: any) {
    console.error('[batch-ingest] tasks.trigger failed:', err);
    return NextResponse.json(
      { error: 'Failed to queue batch task. Check Trigger.dev configuration.' },
      { status: 500 }
    );
  }
}
