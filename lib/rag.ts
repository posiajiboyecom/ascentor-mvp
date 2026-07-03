import { createClient } from '@supabase/supabase-js';
import { CohereClient } from 'cohere-ai';

// ── Clients ──
// Uses service role key — this file only runs server-side (API routes, Trigger.dev jobs)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const cohere = new CohereClient({ token: process.env.COHERE_API_KEY! });

// ── Types ──
// Identical to before — no callers need to change
export interface KnowledgeChunk {
  id: string;
  text: string;
  metadata: {
    category: string;
    source?: string;
    tags?: string[];
    difficulty?: string;
    [key: string]: any;
  };
}

export interface RetrievedChunk {
  id: string;
  text: string;
  score: number;
  category: string;
}

// ── Embed a query string using Cohere ──
// inputType: 'search_query' — correct for retrieval-time embedding
export async function embedText(text: string): Promise<number[]> {
  const response = await cohere.embed({
    texts: [text],
    model: 'embed-english-v3.0',
    inputType: 'search_query',
  });

  const embeddings = response.embeddings;
  if (Array.isArray(embeddings) && Array.isArray(embeddings[0])) {
    return embeddings[0] as number[];
  }
  throw new Error('Unexpected embedding response format from Cohere');
}

// ── Embed documents for ingestion ──
// inputType: 'search_document' — correct for index-time embedding
// Not exported — only used internally by addChunks
async function embedDocuments(texts: string[]): Promise<number[][]> {
  // Cohere embed accepts max 96 texts per call
  const COHERE_BATCH_SIZE = 96;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += COHERE_BATCH_SIZE) {
    const batch = texts.slice(i, i + COHERE_BATCH_SIZE);
    const response = await cohere.embed({
      texts: batch,
      model: 'embed-english-v3.0',
      inputType: 'search_document',
    });

    const embeddings = response.embeddings;
    if (Array.isArray(embeddings) && Array.isArray(embeddings[0])) {
      allEmbeddings.push(...(embeddings as number[][]));
    } else {
      throw new Error('Unexpected embedding response format from Cohere');
    }
  }

  return allEmbeddings;
}

// ── Search knowledge base via pgvector ──
// Replaces: Pinecone index.query()
// Namespace maps to the knowledge_chunks.namespace column
export async function searchKnowledge(
  query: string,
  options: {
    topK?: number;
    namespace?: string;
    filter?: Record<string, any>;
  } = {}
): Promise<RetrievedChunk[]> {
  const { topK = 10, namespace, filter } = options;

  // 1. Embed the query
  const queryVector = await embedText(query);

  // 2. Call the pgvector RPC function
  const { data, error } = await supabase.rpc('match_knowledge_chunks', {
    query_embedding: queryVector,
    match_count: topK,
    filter_namespace: namespace ?? null,
    filter_metadata: filter ?? {},
  });

  if (error) {
    console.error('pgvector search error:', error);
    return [];
  }

  if (!data || data.length === 0) return [];

  return data.map((row: {
    chunk_id: string;
    content: string;
    metadata: Record<string, any>;
    similarity: number;
  }) => ({
    id: row.chunk_id,
    text: row.content,
    score: row.similarity,
    category: (row.metadata?.category as string) || 'general',
  }));
}

// ── Rerank with Cohere ──
// Unchanged — Cohere reranking is independent of the vector store
export async function rerankResults(
  query: string,
  chunks: RetrievedChunk[],
  topN: number = 3
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

// ── Full RAG pipeline: embed → search → rerank → format for Claude ──
// Identical signature and return shape to before
export async function retrieveContext(
  userMessage: string,
  options: {
    namespace?: string;
    topK?: number;
    topN?: number;
    filter?: Record<string, any>;
  } = {}
): Promise<{ chunks: RetrievedChunk[]; contextBlock: string }> {
  const { namespace, topK = 10, topN = 3, filter } = options;

  try {
    const rawChunks = await searchKnowledge(userMessage, { topK, namespace, filter });

    if (rawChunks.length === 0) {
      return { chunks: [], contextBlock: '' };
    }

    const reranked = await rerankResults(userMessage, rawChunks, topN);

    const contextBlock = reranked
      .map(
        (c, i) =>
          `<knowledge_${i + 1} category="${c.category}" relevance="${c.score.toFixed(2)}">\n${c.text}\n</knowledge_${i + 1}>`
      )
      .join('\n\n');

    return { chunks: reranked, contextBlock };
  } catch (error) {
    console.error('RAG retrieval error:', error);
    return { chunks: [], contextBlock: '' };
  }
}

// ── Add chunks to pgvector (for ingestion) ──
// Replaces: Pinecone index.namespace().upsert()
// namespace arg preserved — stored as a column, used for filtering
export async function addChunks(
  namespace: string,
  chunks: KnowledgeChunk[]
): Promise<void> {
  if (chunks.length === 0) return;

  const texts = chunks.map((c) => c.text);
  const vectors = await embedDocuments(texts);

  // Supabase upsert in batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE).map((chunk, j) => ({
      chunk_id:  chunk.id,
      content:   chunk.text,
      embedding: vectors[i + j],
      namespace,
      metadata:  chunk.metadata,
    }));

    const { error } = await supabase
      .from('knowledge_chunks')
      .upsert(batch, { onConflict: 'chunk_id' });

    if (error) {
      console.error(`Batch upsert error (batch starting at ${i}):`, error);
      throw new Error(`Failed to upsert knowledge chunks: ${error.message}`);
    }
  }

  console.log(`✓ Upserted ${chunks.length} chunks to namespace "${namespace}"`);
}
