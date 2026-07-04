// app/api/admin/knowledge/ingest-url/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/admin/knowledge/ingest-url
// Fetches an article/webpage, strips HTML to clean text,
// chunks it, embeds via Cohere, and upserts into knowledge_chunks.
//
// Body:
//   {
//     url:         string   — full URL of the article/transcript
//     mentorSlug:  string   — must match a slug in mentor_profiles
//     namespace:   string   — e.g. 'vocation', 'leadership'
//     sourceTitle: string   — e.g. "Why You Should Define Your Fears"
//     tags?:       string[]
//   }
// ─────────────────────────────────────────────────────────────

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { addChunks, getMentorBySlug } from '@/lib/rag';
import type { KnowledgeChunk } from '@/lib/rag';

// ── Config ──
const CHUNK_SIZE    = 400;
const CHUNK_OVERLAP = 50;
const FETCH_TIMEOUT = 15_000; // 15s

// ── HTML → plain text ──
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(\/?(?:p|div|li|h[1-6]|br|tr|blockquote))[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Text chunker ──
function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const words  = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const slice = words.slice(i, i + chunkSize).join(' ');
    if (slice.trim()) chunks.push(slice.trim());
    i += chunkSize - overlap;
  }
  return chunks;
}

// ── Route ──

export async function POST(req: Request) {
  // Admin gate
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

  // Parse body
  let body: {
    url: string;
    mentorSlug: string;
    namespace: string;
    sourceTitle: string;
    tags?: string[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { url, mentorSlug, namespace, sourceTitle, tags = [] } = body;

  if (!url || !mentorSlug || !namespace || !sourceTitle) {
    return NextResponse.json(
      { error: 'url, mentorSlug, namespace, and sourceTitle are required' },
      { status: 400 }
    );
  }

  // Validate URL format
  try { new URL(url); } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  // Validate mentor
  const mentor = await getMentorBySlug(mentorSlug);
  if (!mentor) {
    return NextResponse.json(
      { error: `Mentor "${mentorSlug}" not found in mentor_profiles` },
      { status: 404 }
    );
  }

  // Fetch the URL
  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Ascentor-KnowledgeBot/1.0 (content ingestion for AI coaching)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json(
        { error: `URL returned ${response.status} ${response.statusText}` },
        { status: 422 }
      );
    }

    html = await response.text();
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    const message   = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: isTimeout ? 'Request timed out after 15 seconds' : `Failed to fetch URL: ${message}` },
      { status: 422 }
    );
  }

  // Strip HTML to plain text
  const text = htmlToText(html);

  if (text.split(/\s+/).length < 50) {
    return NextResponse.json(
      { error: 'Extracted text is too short (< 50 words). The page may be paywalled, JS-rendered, or mostly images.' },
      { status: 422 }
    );
  }

  // Chunk + embed + upsert
  const textChunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);
  const urlHash    = Buffer.from(url).toString('base64').slice(0, 12).replace(/[^A-Za-z0-9]/g, '');

  const chunks: KnowledgeChunk[] = textChunks.map((chunk, i) => ({
    id: `url-${urlHash}-${i}`,
    text: chunk,
    metadata: {
      category:    namespace,
      source:      sourceTitle,
      source_type: 'article',
      source_url:  url,
      mentor_slug: mentor.slug,
      mentor_name: mentor.name,
      tags:        ['article', ...tags],
    },
  }));

  try {
    await addChunks(namespace, chunks);
  } catch (err) {
    console.error('[ingest-url] addChunks failed:', err);
    return NextResponse.json(
      { error: 'Failed to embed and store chunks. Check server logs.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    mentor:  mentor.name,
    url,
    source:  sourceTitle,
    chunks:  chunks.length,
    words:   text.split(/\s+/).length,
    message: `Successfully ingested ${chunks.length} chunks from "${sourceTitle}" by ${mentor.name}`,
  });
}
