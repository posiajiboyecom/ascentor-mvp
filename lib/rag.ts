// lib/rag.ts
// ─────────────────────────────────────────────────────────────────────────────
// Ascentor RAG layer — Supabase pgvector + Cohere
//
// Replaces the previous Pinecone implementation. All vector storage now lives
// in the `knowledge_chunks` table in Supabase. Similarity search uses the
// pgvector `<=>` cosine-distance operator via a Postgres RPC function.
//
// Required Supabase migration (run once in the SQL editor):
// ─────────────────────────────────────────────────────────
//   CREATE EXTENSION IF NOT EXISTS vector;
//
//   CREATE TABLE IF NOT EXISTS knowledge_chunks (
//     id          text PRIMARY KEY,
//     namespace   text NOT NULL,
//     text        text NOT NULL,
//     embedding   vector(1024),          -- Cohere embed-english-v3.0 = 1024 dims
//     metadata    jsonb DEFAULT '{}'::jsonb,
//     created_at  timestamptz DEFAULT now()
//   );
//
//   CREATE INDEX ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops)
//     WITH (lists = 100);
//
//   CREATE INDEX ON knowledge_chunks (namespace);
//
//   -- RPC used by searchKnowledge()
//   CREATE OR REPLACE FUNCTION match_knowledge_chunks(
//     query_embedding vector(1024),
//     match_count     int,
//     filter_namespace text DEFAULT NULL,
//     filter_metadata  jsonb DEFAULT NULL
//   )
//   RETURNS TABLE (
//     id        text,
//     namespace text,
//     text      text,
//     metadata  jsonb,
//     similarity float
//   )
//   LANGUAGE plpgsql
//   AS $$
//   BEGIN
//     RETURN QUERY
//     SELECT
//       kc.id,
//       kc.namespace,
//       kc.text,
//       kc.metadata,
//       1 - (kc.embedding <=> query_embedding) AS similarity
//     FROM knowledge_chunks kc
//     WHERE
//       (filter_namespace IS NULL OR kc.namespace = filter_namespace)
//       AND kc.embedding IS NOT NULL
//     ORDER BY kc.embedding <=> query_embedding
//     LIMIT match_count;
//   END;
//   $$;
//
//   -- RLS: service role can do everything; no public access
//   ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "service role full access" ON knowledge_chunks
//     USING (true) WITH CHECK (true);
// ─────────────────────────────────────────────────────────────────────────────

import { createClient as createServiceClient } from '@supabase/supabase-js';
import { CohereClient } from 'cohere-ai';

// ── Clients (module-level singletons — safe in Node.js API routes) ────────────

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY! });

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ── Prompt injection sanitisation (H-04) ──────────────────────────────────────
// Applied at WRITE TIME (addChunks) so poisoned content never reaches the DB.
// Also applied at READ TIME (retrieveContext) as defence-in-depth.
//
// What it strips:
//   1. XML/HTML-like tags — the contextBlock wraps chunks in <knowledge_N> tags.
//      Injected </knowledge_1> tags would break out of the data context and could
//      be followed by forged system instructions.
//   2. Common prompt injection trigger phrases ("ignore previous", "system:",
//      "assistant:", "[INST]", "OVERRIDE", etc.). These are neutralised by
//      inserting a zero-width space, making them invisible to models but
//      breaking the pattern.
//   3. Null bytes and other control characters that confuse tokenisers.
//
// What it preserves:
//   All natural language content, including angle-bracket-less text, quotes,
//   numbers, punctuation, and unicode. The goal is to strip structure that
//   could be interpreted as instructions, not to sanitise prose.
export function sanitiseChunkText(raw: string): string {
  return raw
    // 1. Strip XML/HTML tags — prevents </knowledge_N> breakout
    .replace(/<[^>]{0,200}>/g, '')
    // 2. Neutralise common prompt injection trigger phrases
    //    Insert zero-width space (U+200B) after the first word so the
    //    pattern no longer matches model attention but text stays readable.
    .replace(/\b(ignore|disregard|forget|override|bypass)\b(\s+(previous|prior|above|all|instructions?|rules?|constraints?))/gi,
      (_, verb, rest) => `${verb}\u200B${rest}`)
    .replace(/\b(system|assistant|user|human|instruction|prompt)\s*:/gi,
      (m) => m.replace(':', ':\u200B'))
    .replace(/\[INST\]|\[\/INST\]|<<SYS>>|<\/SYS>|\[SYSTEM\]/gi,
      (m) => m.replace(/[[\]<>]/g, '\u200B'))
    // 3. Strip null bytes and ASCII control characters (except newline/tab)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // 4. Collapse runs of more than 3 consecutive newlines (often used for
    //    visual separator tricks in injected payloads)
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KnowledgeChunk {
  id: string;
  text: string;
  metadata: {
    category: string;
    source?: string;
    tags?: string[];
    difficulty?: string;
    [key: string]: unknown;
  };
}

export interface RetrievedChunk {
  id: string;
  text: string;
  score: number;
  category: string;
  metadata?: Record<string, unknown>;
}

export interface MentorProfile {
  slug: string;
  name: string;
  dimension: string | null;
  category: string | null;
}

// ── Cohere embedding ──────────────────────────────────────────────────────────

/** Embed a single query string (for search). */
export async function embedText(text: string): Promise<number[]> {
  const response = await cohere.embed({
    texts: [text],
    model: 'embed-english-v3.0',
    inputType: 'search_query',
    embeddingTypes: ['float'],
  });

  const embeddings = response.embeddings;
  if (Array.isArray(embeddings) && Array.isArray(embeddings[0])) {
    return embeddings[0] as number[];
  }
  // Cohere v7+ wraps in { float: number[][] }
  const floats = (embeddings as unknown as { float?: number[][] }).float;
  if (floats && Array.isArray(floats[0])) return floats[0];

  throw new Error('[rag] Unexpected embedText response format');
}

/** Embed multiple document strings (for ingestion). */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  // Cohere max batch size is 96
  const BATCH = 96;
  const all: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH) {
    const response = await cohere.embed({
      texts: texts.slice(i, i + BATCH),
      model: 'embed-english-v3.0',
      inputType: 'search_document',
      embeddingTypes: ['float'],
    });

    const embeddings = response.embeddings;
    if (Array.isArray(embeddings) && Array.isArray(embeddings[0])) {
      all.push(...(embeddings as number[][]));
      continue;
    }
    const floats = (embeddings as unknown as { float?: number[][] }).float;
    if (floats) { all.push(...floats); continue; }

    throw new Error('[rag] Unexpected embedDocuments response format');
  }

  return all;
}

// ── Supabase pgvector search ──────────────────────────────────────────────────

export async function searchKnowledge(
  query: string,
  options: {
    topK?: number;
    namespace?: string;
    filter?: Record<string, unknown>;
  } = {},
): Promise<RetrievedChunk[]> {
  const { topK = 10, namespace } = options;

  const queryVector = await embedText(query);
  const supabase    = getServiceClient();

  const { data, error } = await supabase.rpc('match_knowledge_chunks', {
    query_embedding:  queryVector,
    match_count:      topK,
    filter_namespace: namespace ?? null,
    filter_metadata:  null,
  });

  if (error) {
    console.error('[rag] searchKnowledge RPC error:', error.message);
    return [];
  }

  return (data ?? []).map((row: {
    id: string;
    text: string;
    similarity: number;
    metadata: Record<string, unknown>;
  }) => ({
    id:       row.id,
    text:     row.text,
    score:    row.similarity,
    category: (row.metadata?.category as string) || 'general',
    metadata: row.metadata,
  }));
}

// ── Cohere rerank ─────────────────────────────────────────────────────────────

export async function rerankResults(
  query: string,
  chunks: RetrievedChunk[],
  topN: number = 3,
): Promise<RetrievedChunk[]> {
  if (chunks.length === 0) return [];
  if (chunks.length <= topN) return chunks;

  const response = await cohere.rerank({
    query,
    documents: chunks.map((c) => ({ text: c.text })),
    model: 'rerank-english-v3.0',
    topN,
  });

  return response.results.map((r) => ({
    ...chunks[r.index],
    score: r.relevanceScore,
  }));
}

// ── Full RAG pipeline ─────────────────────────────────────────────────────────

export async function retrieveContext(
  userMessage: string,
  options: {
    namespace?: string;
    topK?: number;
    topN?: number;
    filter?: Record<string, unknown>;
  } = {},
): Promise<{ chunks: RetrievedChunk[]; contextBlock: string }> {
  const { namespace, topK = 10, topN = 3 } = options;

  try {
    const rawChunks = await searchKnowledge(userMessage, { topK, namespace });

    if (rawChunks.length === 0) return { chunks: [], contextBlock: '' };

    const reranked = await rerankResults(userMessage, rawChunks, topN);

    // H-04: Defence-in-depth — sanitise text at read time too, in case any
    // pre-migration chunks in the DB escaped write-time sanitisation.
    // Also wraps contextBlock in a hard delimiter Claude is instructed to
    // treat as data-only (see system prompt in coach/session/route.ts).
    const contextBlock = reranked
      .map((c, i) => {
        const safeText = sanitiseChunkText(c.text);
        return `<knowledge_${i + 1} category="${c.category}" relevance="${c.score.toFixed(2)}">\n${safeText}\n</knowledge_${i + 1}>`;
      })
      .join('\n\n');

    return { chunks: reranked, contextBlock };
  } catch (error) {
    console.error('[rag] retrieveContext error:', error);
    return { chunks: [], contextBlock: '' };
  }
}

// ── Mentor lookup ─────────────────────────────────────────────────────────────

export async function getMentorBySlug(slug: string): Promise<MentorProfile | null> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('mentor_profiles')
    .select('slug, name, dimension, category')
    .eq('slug', slug)
    .single();

  if (error || !data) return null;
  return data as MentorProfile;
}

// ── Chunk ingestion ───────────────────────────────────────────────────────────

/**
 * Embed and upsert chunks into `knowledge_chunks`.
 * Uses ON CONFLICT (id) DO UPDATE so re-running is idempotent.
 */
export async function addChunks(
  namespace: string,
  chunks: KnowledgeChunk[],
): Promise<void> {
  if (chunks.length === 0) return;

  const supabase = getServiceClient();

  // Embed all texts — sanitise first to prevent prompt injection payloads
  // reaching the DB (H-04: write-time sanitisation)
  const sanitisedChunks = chunks.map((c) => ({
    ...c,
    text: sanitiseChunkText(c.text),
  }));
  const vectors = await embedDocuments(sanitisedChunks.map((c) => c.text));

  // Upsert in batches of 100 (Supabase bulk upsert sweet spot)
  const BATCH = 100;

  for (let i = 0; i < sanitisedChunks.length; i += BATCH) {
    const batchVectors = vectors.slice(i, i + BATCH);

    const rows = sanitisedChunks.slice(i, i + BATCH).map((chunk, j) => ({
      id:        chunk.id,
      namespace,
      text:      chunk.text,
      embedding: batchVectors[j],
      metadata:  chunk.metadata,
    }));

    const { error } = await supabase
      .from('knowledge_chunks')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      throw new Error(`[rag] addChunks upsert failed (batch ${i}): ${error.message}`);
    }
  }

  console.log(`[rag] ✓ Upserted ${chunks.length} chunks → namespace "${namespace}"`);
}
