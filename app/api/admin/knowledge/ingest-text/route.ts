// app/api/admin/knowledge/ingest-text/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/admin/knowledge/ingest-text
// Admin pastes raw text directly. Chunks, embeds, upserts.
// Used for sermon excerpts, book quotes, typed notes, etc.
//
// Body:
//   {
//     text:        string
//     mentorSlug:  string
//     namespace:   string
//     sourceTitle: string
//     tags?:       string[]
//   }
// ─────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { addChunks, getMentorBySlug } from '@/lib/rag';
import type { KnowledgeChunk } from '@/lib/rag';

const CHUNK_SIZE    = 400;
const CHUNK_OVERLAP = 50;

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

export async function POST(req: Request) {
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

  let body: {
    text: string;
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

  const { text, mentorSlug, namespace, sourceTitle, tags = [] } = body;

  if (!text?.trim() || !mentorSlug || !namespace || !sourceTitle) {
    return NextResponse.json(
      { error: 'text, mentorSlug, namespace, and sourceTitle are required' },
      { status: 400 }
    );
  }

  const mentor = await getMentorBySlug(mentorSlug);
  if (!mentor) {
    return NextResponse.json(
      { error: `Mentor "${mentorSlug}" not found` },
      { status: 404 }
    );
  }

  const textChunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);
  const textHash   = Buffer.from(text.slice(0, 40)).toString('base64').slice(0, 10).replace(/[^A-Za-z0-9]/g, '');

  const chunks: KnowledgeChunk[] = textChunks.map((chunkText, i) => ({
    id: `txt-${mentorSlug}-${textHash}-${i}`,
    text: chunkText,
    metadata: {
      category:    namespace,
      source:      sourceTitle,
      source_type: 'text',
      mentor_slug: mentor.slug,
      mentor_name: mentor.name,
      tags:        ['manual', ...tags],
    },
  }));

  try {
    await addChunks(namespace, chunks);
  } catch (err) {
    console.error('[ingest-text] addChunks failed:', err);
    return NextResponse.json({ error: 'Failed to store chunks' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    mentor:  mentor.name,
    source:  sourceTitle,
    chunks:  chunks.length,
    words:   text.split(/\s+/).length,
    message: `Ingested ${chunks.length} chunks from "${sourceTitle}" by ${mentor.name}`,
  });
}
