// app/api/admin/knowledge/ingest-youtube/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/admin/knowledge/ingest-youtube
// Fetches a YouTube transcript, chunks it, embeds it via Cohere,
// and upserts it into knowledge_chunks with full mentor attribution.
//
// Body:
//   {
//     videoUrl:    string   — full YouTube URL or video ID
//     mentorSlug:  string   — must match a slug in mentor_profiles
//     namespace:   string   — e.g. 'vocation', 'character'
//     sourceTitle: string   — e.g. "The Power of Discipline (2019)"
//     tags?:       string[]
//   }
//
// Install: npm install youtube-transcript
// ─────────────────────────────────────────────────────────────

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { addChunks, getMentorBySlug } from '@/lib/rag';
import type { KnowledgeChunk } from '@/lib/rag';
// youtube-transcript v1.3+ exports both a class and a standalone function.
// Use the standalone fetchTranscript — it's simpler and avoids class instantiation.
import { fetchTranscript } from 'youtube-transcript';

// ── Config ──
const CHUNK_SIZE    = 400;
const CHUNK_OVERLAP = 50;

// ── Helpers ──

function extractVideoId(input: string): string {
  // Handles:
  //   https://www.youtube.com/watch?v=VIDEO_ID
  //   https://youtu.be/VIDEO_ID
  //   VIDEO_ID (plain 11-char string)
  const urlMatch = input.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return urlMatch ? urlMatch[1] : input.trim();
}

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
    videoUrl: string;
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

  const { videoUrl, mentorSlug, namespace, sourceTitle, tags = [] } = body;

  if (!videoUrl || !mentorSlug || !namespace || !sourceTitle) {
    return NextResponse.json(
      { error: 'videoUrl, mentorSlug, namespace, and sourceTitle are required' },
      { status: 400 }
    );
  }

  const VALID_NAMESPACES = ['framework','vocation','character','mind',
    'relationships','community','legacy','finance','leadership','career','coaching'];
  if (!VALID_NAMESPACES.includes(namespace)) {
    return NextResponse.json({ error: `Invalid namespace. Valid values: ${VALID_NAMESPACES.join(', ')}` }, { status: 400 });
  }

  // Validate mentor exists
  const mentor = await getMentorBySlug(mentorSlug);
  if (!mentor) {
    return NextResponse.json(
      { error: `Mentor "${mentorSlug}" not found in mentor_profiles` },
      { status: 404 }
    );
  }

  const videoId = extractVideoId(videoUrl);

  // Fetch transcript using the standalone fetchTranscript function
  let transcript: string;
  try {
    const segments = await fetchTranscript(videoId);
    // TranscriptResponse[].text — join all segments into one string
    transcript = segments.map(s => s.text).join(' ');
  } catch (err) {
    console.error('[ingest-youtube] Transcript fetch failed:', err);
    return NextResponse.json(
      {
        error: 'Could not fetch transcript. The video may have captions disabled, be private, or the ID may be incorrect.',
        videoId,
      },
      { status: 422 }
    );
  }

  if (!transcript.trim()) {
    return NextResponse.json(
      { error: 'Transcript is empty. Nothing to ingest.' },
      { status: 422 }
    );
  }

  // Chunk the transcript
  const textChunks = chunkText(transcript, CHUNK_SIZE, CHUNK_OVERLAP);

  // Build KnowledgeChunk array with full mentor attribution
  const chunks: KnowledgeChunk[] = textChunks.map((text, i) => ({
    id: `yt-${videoId}-${i}`,
    text,
    metadata: {
      category:    namespace,
      source:      sourceTitle,
      source_type: 'youtube',
      video_id:    videoId,
      video_url:   `https://www.youtube.com/watch?v=${videoId}`,
      mentor_slug: mentor.slug,
      mentor_name: mentor.name,
      tags:        ['youtube', ...tags],
    },
  }));

  // Embed + upsert
  try {
    await addChunks(namespace, chunks);
  } catch (err) {
    console.error('[ingest-youtube] addChunks failed:', err);
    return NextResponse.json(
      { error: 'Failed to embed and store chunks. Check server logs.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    mentor:  mentor.name,
    videoId,
    source:  sourceTitle,
    chunks:  chunks.length,
    words:   transcript.split(/\s+/).length,
    message: `Successfully ingested ${chunks.length} chunks from "${sourceTitle}" by ${mentor.name}`,
  });
}
