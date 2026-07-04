// app/api/admin/knowledge/ingest-pdf/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/admin/knowledge/ingest-pdf
// Accepts a multipart form upload of a PDF, extracts text
// via pdf-parse, chunks it, embeds via Cohere, and upserts
// into knowledge_chunks with full mentor attribution.
//
// Form fields:
//   file        — the PDF file (multipart/form-data)
//   mentorSlug  — string
//   namespace   — string
//   sourceTitle — string (e.g. "Atomic Habits — Chapter 3")
//   tags        — optional comma-separated string
//
// Install: npm install pdf-parse
// ─────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { addChunks, getMentorBySlug } from '@/lib/rag';
import type { KnowledgeChunk } from '@/lib/rag';
import { createRequire } from 'module';
const pdfParse = createRequire(import.meta.url)('pdf-parse') as (buffer: Buffer, options?: Record<string, unknown>) => Promise<{ text: string; numpages: number; info: Record<string, unknown> }>;

// ── Config ──
const CHUNK_SIZE    = 400;
const CHUNK_OVERLAP = 50;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// ── Chunker ──
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

  // Parse multipart form
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const file        = formData.get('file') as File | null;
  const mentorSlug  = formData.get('mentorSlug') as string | null;
  const namespace   = formData.get('namespace') as string | null;
  const sourceTitle = formData.get('sourceTitle') as string | null;
  const tagsRaw     = formData.get('tags') as string | null;
  const tags        = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  if (!file || !mentorSlug || !namespace || !sourceTitle) {
    return NextResponse.json(
      { error: 'file, mentorSlug, namespace, and sourceTitle are required' },
      { status: 400 }
    );
  }

  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
      { status: 413 }
    );
  }

  // Validate mentor
  const mentor = await getMentorBySlug(mentorSlug);
  if (!mentor) {
    return NextResponse.json(
      { error: `Mentor "${mentorSlug}" not found in mentor_profiles` },
      { status: 404 }
    );
  }

  // Extract text from PDF
  let text: string;
  try {
    const buffer  = Buffer.from(await file.arrayBuffer());
    const parsed  = await pdfParse(buffer);
    text          = parsed.text;
  } catch (err) {
    console.error('[ingest-pdf] pdf-parse failed:', err);
    return NextResponse.json(
      { error: 'Failed to extract text from PDF. The file may be scanned/image-only or corrupted.' },
      { status: 422 }
    );
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (wordCount < 50) {
    return NextResponse.json(
      { error: 'Extracted text is too short (< 50 words). The PDF may be image-based (scanned) with no embedded text.' },
      { status: 422 }
    );
  }

  // Chunk
  const textChunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);

  // Stable IDs based on file name + index
  const fileSlug = file.name.replace(/[^A-Za-z0-9]/g, '-').slice(0, 20);

  const chunks: KnowledgeChunk[] = textChunks.map((chunkText, i) => ({
    id: `pdf-${fileSlug}-${i}`,
    text: chunkText,
    metadata: {
      category:    namespace,
      source:      sourceTitle,
      source_type: 'pdf',
      file_name:   file.name,
      mentor_slug: mentor.slug,
      mentor_name: mentor.name,
      tags:        ['pdf', ...tags],
    },
  }));

  // Embed + upsert
  try {
    await addChunks(namespace, chunks);
  } catch (err) {
    console.error('[ingest-pdf] addChunks failed:', err);
    return NextResponse.json(
      { error: 'Failed to embed and store chunks. Check server logs.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success:  true,
    mentor:   mentor.name,
    fileName: file.name,
    source:   sourceTitle,
    chunks:   chunks.length,
    words:    wordCount,
    message:  `Successfully ingested ${chunks.length} chunks from "${sourceTitle}" by ${mentor.name}`,
  });
}
