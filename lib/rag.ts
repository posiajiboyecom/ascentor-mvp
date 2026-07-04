import { createClient } from '@supabase/supabase-js';
import { CohereClient } from 'cohere-ai';

// ── Clients ──
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const cohere = new CohereClient({ token: process.env.COHERE_API_KEY! });

// ── Types ──
export interface KnowledgeChunk {
  id: string;
  text: string;
  metadata: {
    category: string;
    source?: string;       // book title, speech name, article title
    source_type?: string;  // 'book' | 'speech' | 'article' | 'youtube' | 'pdf'
    tags?: string[];
    difficulty?: string;
    mentor_slug?: string;  // links chunk to a mentor profile
    mentor_name?: string;  // denormalized for fast prompt injection
    [key: string]: any;
  };
}

export interface RetrievedChunk {
  id: string;
  text: string;
  score: number;
  category: string;
  mentor_slug?: string;
  mentor_name?: string;
  source?: string;
}

export interface MentorProfile {
  id: string;
  slug: string;
  name: string;
  title: string;
  bio: string;
  background: 'christian' | 'secular' | 'african-christian' | 'african-secular';
  dimensions: string[];
  active: boolean;
}

// ── Embed a query string using Cohere ──
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

// ── Embed documents for ingestion (internal use only) ──
async function embedDocuments(texts: string[]): Promise<number[][]> {
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
export async function searchKnowledge(
  query: string,
  options: {
    topK?: number;
    namespace?: string;
    filter?: Record<string, any>;
    mentorSlug?: string;
  } = {}
): Promise<RetrievedChunk[]> {
  const { topK = 10, namespace, filter, mentorSlug } = options;

  const queryVector = await embedText(query);

  const { data, error } = await supabase.rpc('match_knowledge_chunks', {
    query_embedding: queryVector,
    match_count: topK,
    filter_namespace: namespace ?? null,
    filter_metadata: filter ?? {},
    filter_mentor: mentorSlug ?? null,
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
    mentor_slug: string | null;
    similarity: number;
  }) => ({
    id: row.chunk_id,
    text: row.content,
    score: row.similarity,
    category: (row.metadata?.category as string) || 'general',
    mentor_slug: row.mentor_slug ?? row.metadata?.mentor_slug ?? undefined,
    mentor_name: row.metadata?.mentor_name ?? undefined,
    source: row.metadata?.source ?? undefined,
  }));
}

// ── Rerank with Cohere ──
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

// ── Build attribution context block for Sage's system prompt ──
function buildContextBlock(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => {
      const mentorLine = c.mentor_name
        ? `mentor="${c.mentor_name}"${c.source ? ` source="${c.source}"` : ''}`
        : '';
      const attrs = [
        `category="${c.category}"`,
        `relevance="${c.score.toFixed(2)}"`,
        mentorLine,
      ]
        .filter(Boolean)
        .join(' ');

      return `<knowledge_${i + 1} ${attrs}>\n${c.text}\n</knowledge_${i + 1}>`;
    })
    .join('\n\n');
}

// ── Full RAG pipeline: embed → search → rerank → format for Claude ──
export async function retrieveContext(
  userMessage: string,
  options: {
    namespace?: string;
    topK?: number;
    topN?: number;
    filter?: Record<string, any>;
    mentorSlug?: string;
  } = {}
): Promise<{ chunks: RetrievedChunk[]; contextBlock: string }> {
  const { namespace, topK = 10, topN = 3, filter, mentorSlug } = options;

  try {
    const rawChunks = await searchKnowledge(userMessage, {
      topK,
      namespace,
      filter,
      mentorSlug,
    });

    if (rawChunks.length === 0) {
      return { chunks: [], contextBlock: '' };
    }

    const reranked = await rerankResults(userMessage, rawChunks, topN);
    const contextBlock = buildContextBlock(reranked);

    return { chunks: reranked, contextBlock };
  } catch (error) {
    console.error('RAG retrieval error:', error);
    return { chunks: [], contextBlock: '' };
  }
}

// ── Add chunks to pgvector ──
export async function addChunks(
  namespace: string,
  chunks: KnowledgeChunk[]
): Promise<void> {
  if (chunks.length === 0) return;

  const texts = chunks.map((c) => c.text);
  const vectors = await embedDocuments(texts);

  const BATCH_SIZE = 100;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE).map((chunk, j) => ({
      chunk_id:    chunk.id,
      content:     chunk.text,
      embedding:   vectors[i + j],
      namespace,
      mentor_slug: chunk.metadata?.mentor_slug ?? null,
      metadata:    chunk.metadata,
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

// ── Mentor profile helpers ──

export async function getMentors(): Promise<MentorProfile[]> {
  const { data, error } = await supabase
    .from('mentor_profiles')
    .select('*')
    .eq('active', true)
    .order('name');

  if (error) {
    console.error('Failed to fetch mentors:', error);
    return [];
  }

  return data as MentorProfile[];
}

export async function getMentorBySlug(slug: string): Promise<MentorProfile | null> {
  const { data, error } = await supabase
    .from('mentor_profiles')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) return null;
  return data as MentorProfile;
}
