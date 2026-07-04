'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

const brand = {
  fontDisplay: "'Cormorant Garamond', 'Georgia', serif",
  fontUI:      "'Syne', 'system-ui', sans-serif",
  fontMono:    "'DM Mono', 'Courier New', monospace",
  gold:        '#E8A020',
  goldMuted:   'rgba(232,160,32,0.10)',
  goldBorder:  'rgba(232,160,32,0.25)',
  dark50:      'var(--admin-text-heading)',
  dark200:     'var(--admin-text)',
  dark400:     'var(--admin-text-muted)',
  dark500:     'var(--admin-text-faint)',
  card:        'var(--admin-bg-deep)',
  dark700:     'var(--admin-bg-card)',
  border:      'var(--admin-border)',
};

type IngestTab = 'youtube' | 'url' | 'pdf' | 'text';
type StatusType = 'idle' | 'loading' | 'success' | 'error';

interface MentorProfile {
  id: string;
  slug: string;
  name: string;
  title: string;
  background: string;
  dimensions: string[];
}

interface ChunkStat {
  mentor_slug: string;
  count: number;
}

const NAMESPACES = [
  { value: 'framework',     label: 'Framework / Methodology' },
  { value: 'vocation',      label: 'Vocation / Work' },
  { value: 'character',     label: 'Character / Integrity' },
  { value: 'mind',          label: 'Mind / Mental Health' },
  { value: 'relationships', label: 'Relationships' },
  { value: 'community',     label: 'Community' },
  { value: 'legacy',        label: 'Legacy' },
  { value: 'finance',       label: 'Finance / Stewardship' },
  { value: 'leadership',    label: 'Leadership' },
  { value: 'career',        label: 'Career Navigation' },
  { value: 'coaching',      label: 'Coaching Approaches' },
];

const BACKGROUND_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  'african-christian': { bg: 'rgba(20,184,166,0.09)',  color: '#14B8A6', border: 'rgba(20,184,166,0.25)' },
  'christian':         { bg: 'rgba(139,92,246,0.09)',  color: '#8B5CF6', border: 'rgba(139,92,246,0.25)' },
  'secular':           { bg: 'rgba(232,160,32,0.09)',  color: '#E8A020', border: 'rgba(232,160,32,0.25)' },
  'african-secular':   { bg: 'rgba(239,68,68,0.08)',   color: '#EF4444', border: 'rgba(239,68,68,0.22)'  },
};

// ── Shared UI primitives ──────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: brand.fontMono, fontSize: '10px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: brand.dark500 }}>
      {children}
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontFamily: brand.fontMono, fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: brand.dark400, display: 'block', marginBottom: '6px' }}>
      {children}
    </label>
  );
}

function Input({ value, onChange, placeholder, type = 'text', disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
      style={{ fontFamily: brand.fontUI, fontSize: '13px', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${brand.border}`, background: brand.dark700, color: brand.dark50, width: '100%', outline: 'none', boxSizing: 'border-box' as const, opacity: disabled ? 0.5 : 1 }}
    />
  );
}

function Select({ value, onChange, options, disabled }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      style={{ fontFamily: brand.fontUI, fontSize: '13px', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${brand.border}`, background: brand.dark700, color: value ? brand.dark50 : brand.dark500, width: '100%', outline: 'none', cursor: 'pointer', opacity: disabled ? 0.5 : 1 }}
    >
      <option value="">Select…</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Textarea({ value, onChange, placeholder, rows = 6, disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; disabled?: boolean;
}) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} disabled={disabled}
      style={{ fontFamily: brand.fontUI, fontSize: '13px', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${brand.border}`, background: brand.dark700, color: brand.dark50, width: '100%', outline: 'none', resize: 'vertical' as const, boxSizing: 'border-box' as const, opacity: disabled ? 0.5 : 1 }}
    />
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button type="submit" disabled={loading}
      style={{ fontFamily: brand.fontUI, fontSize: '13px', fontWeight: 600, padding: '11px 24px', borderRadius: '9px', border: `1px solid ${brand.goldBorder}`, background: loading ? brand.goldMuted : brand.gold, color: loading ? brand.gold : '#0C0B08', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
    >
      {loading ? 'Processing…' : label}
    </button>
  );
}

function StatusBanner({ status, message }: { status: StatusType; message: string }) {
  if (status === 'idle') return null;
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    loading: { bg: brand.goldMuted, color: brand.gold, border: brand.goldBorder },
    success: { bg: 'rgba(20,184,166,0.09)', color: '#14B8A6', border: 'rgba(20,184,166,0.25)' },
    error:   { bg: 'rgba(239,68,68,0.08)', color: '#EF4444', border: 'rgba(239,68,68,0.22)' },
  };
  const s = styles[status];
  return (
    <div style={{ marginTop: '14px', padding: '12px 16px', borderRadius: '8px', background: s.bg, border: `1px solid ${s.border}`, fontFamily: brand.fontUI, fontSize: '13px', color: s.color, lineHeight: 1.5 }}>
      {message}
    </div>
  );
}

function SharedFields({ mentors, mentorSlug, setMentorSlug, namespace, setNamespace, sourceTitle, setSourceTitle, tags, setTags, disabled }: {
  mentors: MentorProfile[]; mentorSlug: string; setMentorSlug: (v: string) => void;
  namespace: string; setNamespace: (v: string) => void; sourceTitle: string; setSourceTitle: (v: string) => void;
  tags: string; setTags: (v: string) => void; disabled: boolean;
}) {
  return (
    <>
      <div>
        <FieldLabel>Mentor *</FieldLabel>
        <Select value={mentorSlug} onChange={setMentorSlug} options={mentors.map(m => ({ value: m.slug, label: m.name }))} disabled={disabled} />
      </div>
      <div>
        <FieldLabel>Dimension / Namespace *</FieldLabel>
        <Select value={namespace} onChange={setNamespace} options={NAMESPACES} disabled={disabled} />
      </div>
      <div>
        <FieldLabel>Source Title *</FieldLabel>
        <Input value={sourceTitle} onChange={setSourceTitle} placeholder="e.g. The 7 Habits — Chapter 2" disabled={disabled} />
      </div>
      <div>
        <FieldLabel>Tags (comma-separated, optional)</FieldLabel>
        <Input value={tags} onChange={setTags} placeholder="e.g. habits, discipline, character" disabled={disabled} />
      </div>
    </>
  );
}

// ── Ingestion tabs ────────────────────────────────────────────────────────

function YoutubeTab({ mentors }: { mentors: MentorProfile[] }) {
  const [videoUrl, setVideoUrl] = useState('');
  const [mentorSlug, setMentorSlug] = useState('');
  const [namespace, setNamespace] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState<StatusType>('idle');
  const [message, setMessage] = useState('');

  // Auto-dismiss status banner after 8 seconds
  useEffect(() => {
    if (status === 'idle') return;
    const t = setTimeout(() => setStatus('idle'), 8000);
    return () => clearTimeout(t);
  }, [status]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!videoUrl || !mentorSlug || !namespace || !sourceTitle) {
      setStatus('error'); setMessage('All fields marked * are required.'); return;
    }
    setStatus('loading'); setMessage('Fetching transcript and generating embeddings…');
    try {
      const res = await fetch('/api/admin/knowledge/ingest-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl, mentorSlug, namespace, sourceTitle, tags: tags.split(',').map(t => t.trim()).filter(Boolean) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unknown error');
      setStatus('success'); setMessage(`✓ ${data.message}`);
      setVideoUrl(''); setSourceTitle(''); setTags('');
    } catch (err: any) {
      setStatus('error'); setMessage(err.message || 'Ingestion failed');
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <FieldLabel>YouTube URL or Video ID *</FieldLabel>
        <Input value={videoUrl} onChange={setVideoUrl} placeholder="https://www.youtube.com/watch?v=..." disabled={status === 'loading'} />
        <p style={{ fontFamily: brand.fontMono, fontSize: '10px', color: brand.dark500, marginTop: '5px', letterSpacing: '0.03em' }}>
          Works with any video that has auto-generated or manual captions enabled.
        </p>
      </div>
      <SharedFields mentors={mentors} mentorSlug={mentorSlug} setMentorSlug={setMentorSlug} namespace={namespace} setNamespace={setNamespace} sourceTitle={sourceTitle} setSourceTitle={setSourceTitle} tags={tags} setTags={setTags} disabled={status === 'loading'} />
      <div><SubmitButton loading={status === 'loading'} label="Ingest YouTube Video" /></div>
      <StatusBanner status={status} message={message} />
    </form>
  );
}

function UrlTab({ mentors }: { mentors: MentorProfile[] }) {
  const [url, setUrl] = useState('');
  const [mentorSlug, setMentorSlug] = useState('');
  const [namespace, setNamespace] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState<StatusType>('idle');
  const [message, setMessage] = useState('');

  // Auto-dismiss status banner after 8 seconds
  useEffect(() => {
    if (status === 'idle') return;
    const t = setTimeout(() => setStatus('idle'), 8000);
    return () => clearTimeout(t);
  }, [status]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url || !mentorSlug || !namespace || !sourceTitle) {
      setStatus('error'); setMessage('All fields marked * are required.'); return;
    }
    setStatus('loading'); setMessage('Fetching page and generating embeddings…');
    try {
      const res = await fetch('/api/admin/knowledge/ingest-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, mentorSlug, namespace, sourceTitle, tags: tags.split(',').map(t => t.trim()).filter(Boolean) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unknown error');
      setStatus('success'); setMessage(`✓ ${data.message}`);
      setUrl(''); setSourceTitle(''); setTags('');
    } catch (err: any) {
      setStatus('error'); setMessage(err.message || 'Ingestion failed');
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <FieldLabel>Article / Page URL *</FieldLabel>
        <Input value={url} onChange={setUrl} placeholder="https://..." type="url" disabled={status === 'loading'} />
        <p style={{ fontFamily: brand.fontMono, fontSize: '10px', color: brand.dark500, marginTop: '5px', letterSpacing: '0.03em' }}>
          Works best with text-heavy pages. Paywalled or JS-rendered pages may not extract well.
        </p>
      </div>
      <SharedFields mentors={mentors} mentorSlug={mentorSlug} setMentorSlug={setMentorSlug} namespace={namespace} setNamespace={setNamespace} sourceTitle={sourceTitle} setSourceTitle={setSourceTitle} tags={tags} setTags={setTags} disabled={status === 'loading'} />
      <div><SubmitButton loading={status === 'loading'} label="Scrape & Ingest URL" /></div>
      <StatusBanner status={status} message={message} />
    </form>
  );
}

function PdfTab({ mentors }: { mentors: MentorProfile[] }) {
  const [mentorSlug, setMentorSlug] = useState('');
  const [namespace, setNamespace] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<StatusType>('idle');
  const [message, setMessage] = useState('');

  // Auto-dismiss status banner after 8 seconds
  useEffect(() => {
    if (status === 'idle') return;
    const t = setTimeout(() => setStatus('idle'), 8000);
    return () => clearTimeout(t);
  }, [status]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !mentorSlug || !namespace || !sourceTitle) {
      setStatus('error'); setMessage('All fields marked * are required, including a PDF file.'); return;
    }
    setStatus('loading'); setMessage('Extracting text from PDF and generating embeddings…');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mentorSlug', mentorSlug);
      formData.append('namespace', namespace);
      formData.append('sourceTitle', sourceTitle);
      formData.append('tags', tags);
      const res = await fetch('/api/admin/knowledge/ingest-pdf', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unknown error');
      setStatus('success'); setMessage(`✓ ${data.message}`);
      setFile(null); setSourceTitle(''); setTags('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      setStatus('error'); setMessage(err.message || 'Ingestion failed');
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <FieldLabel>PDF File *</FieldLabel>
        <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${file ? brand.goldBorder : brand.border}`, borderRadius: '10px', padding: '24px', textAlign: 'center', cursor: 'pointer', background: file ? brand.goldMuted : brand.dark700 }}>
          {file ? (
            <>
              <p style={{ fontFamily: brand.fontUI, fontSize: '13px', fontWeight: 600, color: brand.gold, margin: 0 }}>{file.name}</p>
              <p style={{ fontFamily: brand.fontMono, fontSize: '10px', color: brand.dark400, margin: '4px 0 0', letterSpacing: '0.04em' }}>{(file.size / 1024 / 1024).toFixed(2)} MB — click to change</p>
            </>
          ) : (
            <>
              <p style={{ fontFamily: brand.fontUI, fontSize: '13px', color: brand.dark400, margin: 0 }}>Click to select a PDF</p>
              <p style={{ fontFamily: brand.fontMono, fontSize: '10px', color: brand.dark500, margin: '4px 0 0', letterSpacing: '0.04em' }}>Max 20MB — text-based PDFs only</p>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
      </div>
      <SharedFields mentors={mentors} mentorSlug={mentorSlug} setMentorSlug={setMentorSlug} namespace={namespace} setNamespace={setNamespace} sourceTitle={sourceTitle} setSourceTitle={setSourceTitle} tags={tags} setTags={setTags} disabled={status === 'loading'} />
      <div><SubmitButton loading={status === 'loading'} label="Upload & Ingest PDF" /></div>
      <StatusBanner status={status} message={message} />
    </form>
  );
}

function TextTab({ mentors }: { mentors: MentorProfile[] }) {
  const [text, setText] = useState('');
  const [mentorSlug, setMentorSlug] = useState('');
  const [namespace, setNamespace] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState<StatusType>('idle');
  const [message, setMessage] = useState('');

  // Auto-dismiss status banner after 8 seconds
  useEffect(() => {
    if (status === 'idle') return;
    const t = setTimeout(() => setStatus('idle'), 8000);
    return () => clearTimeout(t);
  }, [status]);
  const wordCount = text.trim() ? text.split(/\s+/).filter(Boolean).length : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !mentorSlug || !namespace || !sourceTitle) {
      setStatus('error'); setMessage('All fields marked * are required.'); return;
    }
    setStatus('loading'); setMessage('Generating embeddings…');
    try {
      const res = await fetch('/api/admin/knowledge/ingest-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mentorSlug, namespace, sourceTitle, tags: tags.split(',').map(t => t.trim()).filter(Boolean) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unknown error');
      setStatus('success'); setMessage(`✓ ${data.message}`);
      setText(''); setSourceTitle(''); setTags('');
    } catch (err: any) {
      setStatus('error'); setMessage(err.message || 'Ingestion failed');
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <FieldLabel>Text Content *</FieldLabel>
        <Textarea value={text} onChange={setText} placeholder="Paste sermon excerpt, book quote, article text, or typed notes here…" rows={10} disabled={status === 'loading'} />
        <p style={{ fontFamily: brand.fontMono, fontSize: '10px', color: brand.dark500, marginTop: '5px', letterSpacing: '0.03em' }}>
          {wordCount > 0 ? `${wordCount.toLocaleString()} words` : 'Minimum 50 words recommended'}
        </p>
      </div>
      <SharedFields mentors={mentors} mentorSlug={mentorSlug} setMentorSlug={setMentorSlug} namespace={namespace} setNamespace={setNamespace} sourceTitle={sourceTitle} setSourceTitle={setSourceTitle} tags={tags} setTags={setTags} disabled={status === 'loading'} />
      <div><SubmitButton loading={status === 'loading'} label="Ingest Text" /></div>
      <StatusBanner status={status} message={message} />
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function AdminKnowledgePage() {
  const [tab, setTab] = useState<IngestTab>('youtube');
  const [mentors, setMentors] = useState<MentorProfile[]>([]);
  const [stats, setStats] = useState<ChunkStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalChunks, setTotalChunks] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setLoadError(null);

    try {
      // Create client inside the async function — avoids SSR/hydration issues
      const supabase = createClient();

      const mentorRes = await supabase
        .from('mentor_profiles')
        .select('id, slug, name, title, background, dimensions')
        .eq('active', true)
        .order('name');

      if (mentorRes.error) throw new Error(`mentor_profiles: ${mentorRes.error.message}`);

      const mentorList = (mentorRes.data || []) as MentorProfile[];
      setMentors(mentorList);

      // Fetch chunk counts per mentor — only if mentor_profiles loaded
      // Count chunks per mentor via RPC (avoids O(N) full table scan).
      // Requires the DB function below — falls back gracefully if not yet created.
      //
      // CREATE OR REPLACE FUNCTION count_knowledge_chunks_by_mentor()
      // RETURNS TABLE(mentor_slug text, chunk_count bigint)
      // LANGUAGE sql STABLE AS $$
      //   SELECT metadata->>'mentor_slug' AS mentor_slug, COUNT(*) AS chunk_count
      //   FROM knowledge_chunks
      //   WHERE metadata->>'mentor_slug' IS NOT NULL
      //   GROUP BY metadata->>'mentor_slug';
      // $$;
      const rpcRes = await supabase.rpc('count_knowledge_chunks_by_mentor');

      if (!rpcRes.error && rpcRes.data) {
        const rows = rpcRes.data as Array<{ mentor_slug: string; chunk_count: number }>;
        const total = rows.reduce((s: number, r) => s + Number(r.chunk_count), 0);
        setTotalChunks(total);
        setStats(rows.map(r => ({ mentor_slug: r.mentor_slug, count: Number(r.chunk_count) })));
      } else {
        // RPC not yet created — fall back to a capped row fetch (max 5000)
        // mentor_slug lives inside the metadata jsonb column, not as a top-level column
        const chunkRes = await supabase
          .from('knowledge_chunks')
          .select('metadata')
          .limit(5000);
        if (!chunkRes.error) {
          const chunks = chunkRes.data || [];
          setTotalChunks(chunks.length);
          const countMap: Record<string, number> = {};
          for (const c of chunks) {
            const slug = (c.metadata as Record<string, unknown>)?.mentor_slug as string | undefined;
            if (slug) countMap[slug] = (countMap[slug] || 0) + 1;
          }
          setStats(Object.entries(countMap).map(([mentor_slug, count]) => ({ mentor_slug, count })));
        }
      }
    } catch (err: any) {
      console.error('[AdminKnowledge] loadData error:', err);
      setLoadError(err.message || 'Failed to load data. Check that the mentor migration SQL has been run.');
    } finally {
      setLoading(false);
    }
  }

  const tabs: { id: IngestTab; label: string; icon: string }[] = [
    { id: 'youtube', label: 'YouTube',      icon: '▶' },
    { id: 'url',     label: 'URL / Article', icon: '🔗' },
    { id: 'pdf',     label: 'PDF Upload',   icon: '📄' },
    { id: 'text',    label: 'Manual Text',  icon: '✏️' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Syne:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: var(--admin-text-faint) !important; }
        select option { background: var(--admin-bg-card); color: var(--admin-text); }
      `}</style>

      <div style={{ fontFamily: brand.fontUI, maxWidth: '1100px' }}>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '6px' }}>
            <div>
              <h1 style={{ fontFamily: brand.fontDisplay, fontWeight: 700, fontSize: 'clamp(22px, 3vw, 30px)', color: brand.dark50, margin: 0, lineHeight: 1.15 }}>
                Sage Knowledge Base
              </h1>
              <p style={{ fontFamily: brand.fontMono, fontSize: '11px', color: brand.dark400, marginTop: '6px', letterSpacing: '0.04em' }}>
                {loading ? 'LOADING…' : loadError ? 'ERROR LOADING DATA' : `${mentors.length} MENTORS · ${totalChunks.toLocaleString()} CHUNKS INDEXED`}
              </p>
            </div>
            <span style={{ fontFamily: brand.fontMono, fontSize: '10px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '6px 14px', borderRadius: '999px', background: brand.goldMuted, color: brand.gold, border: `1px solid ${brand.goldBorder}`, whiteSpace: 'nowrap' as const }}>
              Mentor Council · {mentors.length} Active
            </span>
          </div>
          <div style={{ height: '1px', background: `linear-gradient(90deg, ${brand.gold} 0%, transparent 60%)`, marginTop: '16px' }} />
        </div>

        {/* Load error banner */}
        {loadError && (
          <div style={{ marginBottom: '20px', padding: '14px 18px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', fontFamily: brand.fontUI, fontSize: '13px', color: '#EF4444', lineHeight: 1.6 }}>
            <strong>Setup required:</strong> {loadError}
            <br />
            <span style={{ fontFamily: brand.fontMono, fontSize: '11px', opacity: 0.8 }}>
              Run migration_mentors.sql in Supabase → SQL Editor, then refresh this page.
            </span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* Left: ingestion panel */}
          <div style={{ flex: '1 1 520px', minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '2px', padding: '4px', borderRadius: '12px', background: brand.dark700, marginBottom: '20px', overflowX: 'auto' as const }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{ flex: '1 1 0', minWidth: '60px', padding: '8px 4px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontFamily: brand.fontUI, fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' as const, background: tab === t.id ? brand.card : 'transparent', color: tab === t.id ? brand.gold : brand.dark400 }}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            <div style={{ borderRadius: '14px', background: brand.card, border: `1px solid ${brand.border}`, padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <SectionLabel>
                  {tab === 'youtube' && 'Ingest from YouTube'}
                  {tab === 'url'     && 'Ingest from URL / Article'}
                  {tab === 'pdf'     && 'Upload PDF'}
                  {tab === 'text'    && 'Paste Manual Text'}
                </SectionLabel>
                <p style={{ fontFamily: brand.fontUI, fontSize: '12px', color: brand.dark400, margin: '6px 0 0', lineHeight: 1.5 }}>
                  {tab === 'youtube' && 'Paste a YouTube URL. Transcript is fetched automatically — no API key needed.'}
                  {tab === 'url'     && 'Paste an article or transcript URL. Text is extracted and embedded.'}
                  {tab === 'pdf'     && 'Upload a PDF book chapter or sermon. Text-based PDFs only (not scanned).'}
                  {tab === 'text'    && 'Paste any text directly — sermon excerpts, quotes, typed notes.'}
                </p>
              </div>

              {loading ? (
                <div style={{ padding: '40px 0', textAlign: 'center' }}><SectionLabel>Loading…</SectionLabel></div>
              ) : loadError ? (
                <div style={{ padding: '40px 0', textAlign: 'center' }}><SectionLabel>Run the SQL migration to enable ingestion</SectionLabel></div>
              ) : (
                <>
                  {tab === 'youtube' && <YoutubeTab mentors={mentors} />}
                  {tab === 'url'     && <UrlTab     mentors={mentors} />}
                  {tab === 'pdf'     && <PdfTab     mentors={mentors} />}
                  {tab === 'text'    && <TextTab    mentors={mentors} />}
                </>
              )}
            </div>
          </div>

          {/* Right: mentor council stats */}
          <div style={{ flex: '1 1 280px', maxWidth: '340px', minWidth: 0 }}>
            <div style={{ borderRadius: '14px', background: brand.card, border: `1px solid ${brand.border}`, overflow: 'hidden', marginBottom: '16px' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${brand.border}`, background: brand.dark700 }}>
                <SectionLabel>Mentor Council</SectionLabel>
              </div>
              <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
                {mentors.length === 0 && !loading && (
                  <div style={{ padding: '24px 20px', fontFamily: brand.fontUI, fontSize: '12px', color: brand.dark500 }}>
                    No mentors found. Run migration_mentors.sql first.
                  </div>
                )}
                {mentors.map(mentor => {
                  const stat    = stats.find(s => s.mentor_slug === mentor.slug);
                  const chunks  = stat?.count ?? 0;
                  const bgStyle = BACKGROUND_COLORS[mentor.background] || BACKGROUND_COLORS.secular;
                  return (
                    <div key={mentor.slug} style={{ padding: '12px 20px', borderBottom: `1px solid ${brand.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: brand.fontUI, fontSize: '12px', fontWeight: 600, color: brand.dark50, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{mentor.name}</p>
                        <span style={{ fontFamily: brand.fontMono, fontSize: '9px', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' as const, padding: '1px 6px', borderRadius: '999px', background: bgStyle.bg, color: bgStyle.color, border: `1px solid ${bgStyle.border}`, display: 'inline-block', marginTop: '3px' }}>
                          {mentor.background.replace('african-', 'AF/')}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontFamily: brand.fontDisplay, fontWeight: 700, fontSize: '18px', color: chunks > 0 ? brand.gold : brand.dark500, margin: 0, lineHeight: 1 }}>{chunks}</p>
                        <span style={{ fontFamily: brand.fontMono, fontSize: '9px', color: brand.dark500, letterSpacing: '0.05em' }}>chunks</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ borderRadius: '12px', background: brand.goldMuted, border: `1px solid ${brand.goldBorder}`, padding: '16px 18px' }}>
              <SectionLabel>Ingestion tips</SectionLabel>
              <ul style={{ fontFamily: brand.fontUI, fontSize: '12px', color: brand.dark200, lineHeight: 1.7, margin: '10px 0 0', paddingLeft: '16px' }}>
                <li>YouTube works best for long-form talks and sermons</li>
                <li>URL ingestion skips paywalled or JS-heavy pages</li>
                <li>PDFs must have embedded text (not scanned images)</li>
                <li>Each source is chunked into ~400-word segments</li>
                <li>Re-ingesting the same source safely overwrites previous chunks</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
