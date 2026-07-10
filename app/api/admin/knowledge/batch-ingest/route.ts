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

  // ── Validate each item's structure and namespace ───────────
  const VALID_NAMESPACES = new Set(['framework','vocation','character','mind',
    'relationships','community','legacy','finance','leadership','career','coaching']);

  for (let i = 0; i < items.length; i++) {
    const item = items[i] as Record<string, unknown>;
    if (typeof item !== 'object' || !item) {
      return NextResponse.json({ error: `Item ${i}: must be an object` }, { status: 400 });
    }
    if (typeof item.mentorSlug !== 'string' || !item.mentorSlug.trim()) {
      return NextResponse.json({ error: `Item ${i}: mentorSlug is required` }, { status: 400 });
    }
    if (typeof item.namespace !== 'string' || !VALID_NAMESPACES.has(item.namespace)) {
      return NextResponse.json({ error: `Item ${i}: invalid namespace "${item.namespace}"` }, { status: 400 });
    }
    if (typeof item.sourceTitle !== 'string' || !item.sourceTitle.trim()) {
      return NextResponse.json({ error: `Item ${i}: sourceTitle is required` }, { status: 400 });
    }
    if (type === 'urls') {
      if (typeof item.url !== 'string' || !item.url.trim()) {
        return NextResponse.json({ error: `Item ${i}: url is required for url-type items` }, { status: 400 });
      }
      // SSRF check on each URL
      try {
        const parsed = new URL(item.url as string);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return NextResponse.json({ error: `Item ${i}: only http/https URLs allowed` }, { status: 400 });
        }
        const BLOCKED = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/;
        if (BLOCKED.test(parsed.hostname)) {
          return NextResponse.json({ error: `Item ${i}: URL points to a private address` }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: `Item ${i}: invalid URL` }, { status: 400 });
      }
    }
    if (type === 'pdfs' && (typeof item.storagePath !== 'string' || !item.storagePath.trim())) {
      return NextResponse.json({ error: `Item ${i}: storagePath is required for pdf-type items` }, { status: 400 });
    }
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
