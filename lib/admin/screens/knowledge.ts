// lib/admin/screens/knowledge.ts
// Spec copied from the admin prototype (Learn · Sage knowledge base). A source is the set of knowledge_chunks sharing metadata.source (or, for older seed rows, a namespace).
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "knowledge",
  group: "Learn",
  title: "Sage knowledge base",
  sub: "Sources Sage can draw on. Add PDFs, links, YouTube talks or text.",
  cols: [
    "Source",
    "Type",
    "Topic",
    "Chunks",
    "Added",
    "Status"
  ],
  statusCol: 5,
  actions: [
    {
      id: "re-index",
      label: "Re-index",
      col: 5,
      to: "Processing"
    },
    {
      id: "remove",
      label: "Remove",
      col: 5,
      to: "Removed by admin",
      confirm: "Sage stops using this source straight away."
    }
  ],
  buttons: [
    { id: "upload-pdf", label: "Upload PDF", href: "/admin/knowledge" },
    { id: "add-link", label: "Add link", href: "/admin/knowledge" },
    { id: "add-youtube", label: "Add YouTube", href: "/admin/knowledge" },
    { id: "add-text", label: "Add text", href: "/admin/knowledge" }
  ]
};

type Chunk = { id: string; namespace: string | null; metadata: Record<string, unknown> | null; created_at: string | null };

const TYPES: Record<string, string> = { pdf: 'PDF', youtube: 'YouTube', article: 'URL', url: 'URL', text: 'Text' };
const keyOf = (c: Chunk) => {
  const s = c.metadata?.source;
  return typeof s === 'string' && s ? `s:${s}` : `n:${c.namespace ?? ''}`;
};
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' }) : '-';

async function chunksFor(rowId: string): Promise<Chunk[]> {
  const kind = rowId.slice(0, 1);
  const val = rowId.slice(2);
  let q = supabaseAdmin.from('knowledge_chunks').select('id, namespace, metadata, created_at');
  q = kind === 's' ? q.eq('metadata->>source', val) : q.eq('namespace', val).is('metadata->>source', null);
  const { data } = await q.limit(5000);
  return (data ?? []) as Chunk[];
}

async function load() {
  const db = supabaseAdmin;
  const [{ data, error }, { data: noVec }] = await Promise.all([
    db.from('knowledge_chunks').select('id, namespace, metadata, created_at').limit(5000),
    db.from('knowledge_chunks').select('id').is('embedding', null).limit(5000),
  ]);
  if (error) return { rows: [], note: 'Could not read the knowledge base right now.' };
  const bad = new Set((noVec ?? []).map((r: { id: string }) => r.id));
  const groups = new Map<string, { chunks: Chunk[]; failed: number }>();
  for (const c of (data ?? []) as Chunk[]) {
    const k = keyOf(c);
    const g = groups.get(k) ?? { chunks: [], failed: 0 };
    g.chunks.push(c);
    if (bad.has(c.id)) g.failed++;
    groups.set(k, g);
  }
  const rows = [...groups.entries()].map(([k, g]) => {
    const first = g.chunks[0];
    const t = String(first.metadata?.source_type ?? '');
    const removed = g.chunks.every((c) => c.metadata?.removed === true);
    const added = g.chunks.map((c) => c.created_at ?? '').sort()[0] || null;
    const name = k.startsWith('s:') ? k.slice(2) : `${first.namespace ?? 'General'} (starter notes)`;
    return {
      id: k,
      cells: [name, TYPES[t] ?? 'Text', first.namespace ?? '-', g.chunks.length.toLocaleString('en-GB'), fmtDate(added), removed ? 'Removed by admin' : g.failed > 0 ? 'Failed' : 'Indexed'],
    };
  });
  return { rows, note: 'Sources are grouped from the stored chunks. Add new ones on the knowledge page.' };
}

const screen: ScreenModule = {
  spec,
  load,
  async act(_ctx, actionId, rowId) {
    const db = supabaseAdmin;
    const chunks = await chunksFor(rowId);
    if (chunks.length === 0) return { ok: false, error: 'We could not find that source.' };
    const allRemoved = chunks.every((c) => c.metadata?.removed === true);
    if (actionId === 'remove') {
      if (allRemoved) return { ok: false, error: 'Already removed.' };
      for (const c of chunks) {
        const { error } = await db.from('knowledge_chunks').update({ metadata: { ...(c.metadata ?? {}), removed: true } }).eq('id', c.id);
        if (error) return { ok: false, error: 'Could not remove all of it. Try again.' };
      }
      return { ok: true, message: 'Removed. Sage no longer uses this source.' };
    }
    if (actionId === 're-index') {
      if (allRemoved) return { ok: false, error: 'This source was removed, so it cannot be re-indexed.' };
      const { data } = await db.from('knowledge_chunks').select('id, content').in('id', chunks.map((c) => c.id));
      const texts = ((data ?? []) as { id: string; content: string | null }[]).filter((r) => r.content) as { id: string; content: string }[];
      if (texts.length === 0) return { ok: false, error: 'The original text is not stored for this source. Add it again from the knowledge page.' };
      try {
        const { embedDocuments } = await import('@/lib/rag');
        for (let i = 0; i < texts.length; i += 50) {
          const batch = texts.slice(i, i + 50);
          const vecs = await embedDocuments(batch.map((b) => b.content));
          for (let j = 0; j < batch.length; j++) {
            const { error } = await db.from('knowledge_chunks').update({ embedding: vecs[j] as unknown as string }).eq('id', batch[j].id);
            if (error) throw new Error(error.message);
          }
        }
      } catch {
        return { ok: false, error: 'Re-indexing did not finish. Try again in a moment.' };
      }
      return { ok: true, message: `Re-indexed ${texts.length} chunks.` };
    }
    return { ok: false, error: 'That action is not available here.' };
  },
};

export default screen;
