// src/trigger/knowledge-batch-ingester.ts
// ═══════════════════════════════════════════════════════════════
// knowledge-batch-ingester
//
// Processes a batch of knowledge sources (URLs, YouTube videos,
// or PDFs already uploaded to Supabase Storage) and ingests them
// into the knowledge_chunks table via Cohere embeddings.
//
// Triggered by: POST /api/admin/knowledge/batch-ingest
//
// Payload:
//   type: 'urls' | 'pdfs'
//   items: BatchURLItem[] | BatchPDFItem[]
//   triggeredBy: string (user id, for logging)
//
// Each item is processed sequentially to avoid Cohere rate limits.
// Failed items are logged and skipped — they do not abort the batch.
// ═══════════════════════════════════════════════════════════════

import { task, logger } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';
import { fetchTranscript } from 'youtube-transcript';
import { addChunks, getMentorBySlug, embedDocuments } from '../../lib/rag';
import type { KnowledgeChunk } from '../../lib/rag';

// ── Types ──────────────────────────────────────────────────────

export interface BatchURLItem {
  url: string;
  mentorSlug: string;
  namespace: string;
  sourceTitle: string;
  tags?: string[];
}

export interface BatchPDFItem {
  storagePath: string;
  fileName: string;
  mentorSlug: string;
  namespace: string;
  sourceTitle: string;
  tags?: string[];
}

type BatchPayload =
  | { type: 'urls'; items: BatchURLItem[]; triggeredBy?: string }
  | { type: 'pdfs'; items: BatchPDFItem[]; triggeredBy?: string };

// ── Config ─────────────────────────────────────────────────────

const CHUNK_SIZE    = 400;
const CHUNK_OVERLAP = 50;
const BUCKET        = 'knowledge-pdfs';
const FETCH_TIMEOUT = 20_000;

// ── Helpers ────────────────────────────────────────────────────

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
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

function extractVideoId(input: string): string {
  const urlMatch = input.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return urlMatch ? urlMatch[1] : input.trim();
}

function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/.test(url);
}

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

// ── Item processors ────────────────────────────────────────────

async function processYouTube(item: BatchURLItem): Promise<{
  chunks: KnowledgeChunk[];
  wordCount: number;
}> {
  const videoId = extractVideoId(item.url);
  const segments = await fetchTranscript(videoId);
  const transcript = segments.map(s => s.text).join(' ');

  if (!transcript.trim()) {
    throw new Error('Transcript is empty');
  }

  const textChunks = chunkText(transcript, CHUNK_SIZE, CHUNK_OVERLAP);
  const chunks: KnowledgeChunk[] = textChunks.map((text, i) => ({
    id: `yt-${videoId}-${i}`,
    text,
    metadata: {
      category:    item.namespace,
      source:      item.sourceTitle,
      source_type: 'youtube',
      video_id:    videoId,
      video_url:   `https://www.youtube.com/watch?v=${videoId}`,
      mentor_slug: '',   // filled by caller
      mentor_name: '',   // filled by caller
      tags:        ['youtube', ...(item.tags ?? [])],
    },
  }));

  return { chunks, wordCount: transcript.split(/\s+/).length };
}

async function processURL(item: BatchURLItem): Promise<{
  chunks: KnowledgeChunk[];
  wordCount: number;
}> {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  let html: string;
  try {
    const response = await fetch(item.url, {
      signal:  controller.signal,
      headers: {
        'User-Agent': 'Ascentor-KnowledgeBot/1.0 (content ingestion for AI coaching)',
        'Accept':     'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    html = await response.text();
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('Fetch timed out after 20s');
    throw err;
  }

  const text      = htmlToText(html);
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (wordCount < 50) {
    throw new Error('Extracted text too short (< 50 words) — page may be paywalled or JS-rendered');
  }

  const urlHash   = Buffer.from(item.url).toString('base64').slice(0, 12).replace(/[^A-Za-z0-9]/g, '');
  const textChunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);

  const chunks: KnowledgeChunk[] = textChunks.map((t, i) => ({
    id: `url-${urlHash}-${i}`,
    text: t,
    metadata: {
      category:    item.namespace,
      source:      item.sourceTitle,
      source_type: 'article',
      source_url:  item.url,
      mentor_slug: '',
      mentor_name: '',
      tags:        ['article', ...(item.tags ?? [])],
    },
  }));

  return { chunks, wordCount };
}

async function processPDF(item: BatchPDFItem): Promise<{
  chunks: KnowledgeChunk[];
  wordCount: number;
}> {
  const supabase = getServiceClient();

  // Download PDF from storage
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(item.storagePath);

  if (error || !data) {
    throw new Error(`Failed to download PDF from storage: ${error?.message ?? 'no data'}`);
  }

  // Extract text using pdf-parse
  const { PDFParse } = await import('pdf-parse');
  const arrayBuffer  = await data.arrayBuffer();
  const parser       = new PDFParse({ data: new Uint8Array(arrayBuffer) });
  const result       = await parser.getText();
  const text         = result.text;
  const wordCount    = text.split(/\s+/).filter(Boolean).length;

  if (wordCount < 50) {
    throw new Error('Extracted text too short (< 50 words) — PDF may be scanned/image-only');
  }

  const fileSlug   = item.fileName.replace(/[^A-Za-z0-9]/g, '-').slice(0, 20);
  const textChunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);

  const chunks: KnowledgeChunk[] = textChunks.map((t, i) => ({
    id: `pdf-${fileSlug}-${i}`,
    text: t,
    metadata: {
      category:    item.namespace,
      source:      item.sourceTitle,
      source_type: 'pdf',
      file_name:   item.fileName,
      mentor_slug: '',
      mentor_name: '',
      tags:        ['pdf', ...(item.tags ?? [])],
    },
  }));

  return { chunks, wordCount };
}

// ── Task ───────────────────────────────────────────────────────

export const knowledgeBatchIngester = task({
  id:          'knowledge-batch-ingester',
  maxDuration: 600, // 10 minutes — large batches can take a while

  run: async (payload: BatchPayload) => {
    const { type, items, triggeredBy } = payload;

    logger.info(`[BatchIngester] Starting — type: ${type}, items: ${items.length}, by: ${triggeredBy ?? 'unknown'}`);

    const results: {
      index:      number;
      identifier: string;
      success:    boolean;
      chunks?:    number;
      words?:     number;
      error?:     string;
    }[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i] as BatchURLItem & BatchPDFItem;
      const identifier = type === 'pdfs' ? item.fileName : item.url;

      logger.info(`[BatchIngester] Processing ${i + 1}/${items.length}: ${identifier}`);

      try {
        // Validate mentor exists
        const mentor = await getMentorBySlug(item.mentorSlug);
        if (!mentor) {
          throw new Error(`Mentor "${item.mentorSlug}" not found in mentor_profiles`);
        }

        // Extract text and build chunks
        let rawChunks: KnowledgeChunk[];
        let wordCount: number;

        if (type === 'pdfs') {
          const result = await processPDF(item as BatchPDFItem);
          rawChunks    = result.chunks;
          wordCount    = result.wordCount;
        } else if (isYouTubeUrl((item as BatchURLItem).url)) {
          const result = await processYouTube(item as BatchURLItem);
          rawChunks    = result.chunks;
          wordCount    = result.wordCount;
        } else {
          const result = await processURL(item as BatchURLItem);
          rawChunks    = result.chunks;
          wordCount    = result.wordCount;
        }

        // Stamp mentor onto all chunks
        const chunks: KnowledgeChunk[] = rawChunks.map(c => ({
          ...c,
          metadata: {
            ...c.metadata,
            mentor_slug: mentor.slug,
            mentor_name: mentor.name,
          },
        }));

        // Embed + upsert
        await addChunks(item.namespace, chunks);

        // If PDF: clean up the storage file after successful ingestion
        if (type === 'pdfs') {
          const supabase = getServiceClient();
          const { error: delErr } = await supabase.storage
            .from(BUCKET)
            .remove([(item as BatchPDFItem).storagePath]);
          if (delErr) {
            logger.warn(`[BatchIngester] Could not delete storage file (non-fatal): ${delErr.message}`);
          }
        }

        results.push({
          index:      i,
          identifier,
          success:    true,
          chunks:     chunks.length,
          words:      wordCount,
        });

        logger.info(`[BatchIngester] ✓ ${identifier} — ${chunks.length} chunks`);

      } catch (err: any) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`[BatchIngester] ✗ ${identifier} — ${message}`);
        results.push({ index: i, identifier, success: false, error: message });
      }

      // Brief pause between items to respect Cohere rate limits
      if (i < items.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    const succeeded = results.filter(r => r.success).length;
    const failed    = results.filter(r => !r.success).length;
    const totalChunks = results.reduce((s, r) => s + (r.chunks ?? 0), 0);

    logger.info(`[BatchIngester] Done — ${succeeded} succeeded, ${failed} failed, ${totalChunks} total chunks`);

    return {
      type,
      succeeded,
      failed,
      totalChunks,
      results,
    };
  },
});
