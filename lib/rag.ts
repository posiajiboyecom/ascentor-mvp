import { Pinecone } from '@pinecone-database/pinecone';
import { CohereClient } from 'cohere-ai';

// ── Clients ──
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const cohere = new CohereClient({ token: process.env.COHERE_API_KEY! });
const INDEX_NAME = process.env.PINECONE_INDEX || 'ascentor-knowledge';

// ── Types ──
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

// ── Embed text using Cohere ──
export async function embedText(text: string): Promise<number[]> {
  const response = await cohere.embed({
    texts: [text],
    model: 'embed-english-v3.0',
    inputType: 'search_query',
  });

  // Cohere returns embeddings as float[][] 
  const embeddings = response.embeddings;
  if (Array.isArray(embeddings) && Array.isArray(embeddings[0])) {
    return embeddings[0] as number[];
  }
  throw new Error('Unexpected embedding response format');
}

// ── Embed documents (for ingestion) ──
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const response = await cohere.embed({
    texts,
    model: 'embed-english-v3.0',
    inputType: 'search_document',
  });

  const embeddings = response.embeddings;
  if (Array.isArray(embeddings) && Array.isArray(embeddings[0])) {
    return embeddings as number[][];
  }
  throw new Error('Unexpected embedding response format');
}

// ── Search Pinecone ──
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

  // 2. Query Pinecone
  const index = pinecone.Index(INDEX_NAME);
  const target = namespace ? index.namespace(namespace) : index;

  const results = await target.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
    filter,
  });

  if (!results.matches || results.matches.length === 0) {
    return [];
  }

  return results.matches.map((match) => ({
    id: match.id,
    text: (match.metadata?.text as string) || '',
    score: match.score || 0,
    category: (match.metadata?.category as string) || 'general',
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

// ── Full RAG pipeline: search → rerank → format for Claude ──
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
    // Search across all namespaces if none specified
    const rawChunks = await searchKnowledge(userMessage, { topK, namespace, filter });

    if (rawChunks.length === 0) {
      return { chunks: [], contextBlock: '' };
    }

    // Rerank for relevance
    const reranked = await rerankResults(userMessage, rawChunks, topN);

    // Format for Claude injection
    const contextBlock = reranked
      .map((c, i) => `<knowledge_${i + 1} category="${c.category}" relevance="${c.score.toFixed(2)}">\n${c.text}\n</knowledge_${i + 1}>`)
      .join('\n\n');

    return { chunks: reranked, contextBlock };
  } catch (error) {
    console.error('RAG retrieval error:', error);
    return { chunks: [], contextBlock: '' };
  }
}

// ── Add chunks to Pinecone (for ingestion) ──
export async function addChunks(
  namespace: string,
  chunks: KnowledgeChunk[]
): Promise<void> {
  const texts = chunks.map((c) => c.text);
  const vectors = await embedDocuments(texts);

  const index = pinecone.Index(INDEX_NAME);
  const target = index.namespace(namespace);

  // Batch upsert (Pinecone max 100 per batch)
  const batchSize = 100;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize).map((chunk, j) => ({
      id: chunk.id,
      values: vectors[i + j],
      metadata: {
        text: chunk.text,
        ...chunk.metadata,
      },
    }));
    await target.upsert(batch);
  }

  console.log(`✓ Upserted ${chunks.length} chunks to namespace "${namespace}"`);
}
