'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─────────────────────────────────────────────────────────────────
// /admin/content — Content Pipeline
// Central hub for all AI agent output:
//   - Research briefs (from content-researcher-agent)
//   - Content calendar items (from content-writer-agent)
//     • Blog posts (1-click publish to blog_posts)
//     • LinkedIn posts
//     • Twitter/X threads
//     • Email newsletters
//   - Social queue (from social-scheduler-agent)
// ─────────────────────────────────────────────────────────────────

const supabase = createClient();

type Tab = 'briefs' | 'content' | 'queue';
type ContentFilter = 'all' | 'Blog Post' | 'LinkedIn Post' | 'Twitter Thread' | 'Email Newsletter';
type StatusFilter = 'all' | 'draft' | 'approved' | 'published';

const TYPE_META: Record<string, { icon: string; color: string; bg: string }> = {
  'Blog Post':       { icon: '📝', color: '#E8A020', bg: 'rgba(232,160,32,0.10)' },
  'LinkedIn Post':   { icon: '💼', color: '#0A66C2', bg: 'rgba(10,102,194,0.10)' },
  'Twitter Thread':  { icon: '𝕏',  color: 'var(--admin-text)', bg: 'var(--admin-border)' },
  'Email Newsletter':{ icon: '✉️', color: '#14B8A6', bg: 'rgba(20,184,166,0.10)' },
};

const PILLAR_COLORS: Record<string, string> = {
  leadership: '#E8A020',
  career:     '#14B8A6',
  ai:         '#8B5CF6',
  coaching:   '#3B82F6',
  community:  '#EF4444',
};

function slugify(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AdminContentPage() {
  const [tab, setTab] = useState<Tab>('content');
  const [briefs, setBriefs] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('draft');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const [runModal, setRunModal] = useState(false);
  const [runTopic, setRunTopic] = useState('');
  const [runPillar, setRunPillar] = useState('');
  const [runAudience, setRunAudience] = useState('young_professional');
  const [running, setRunning] = useState(false);

  async function triggerResearcher() {
    setRunning(true);
    try {
      const payload: any = { audience: runAudience };
      if (runTopic.trim()) payload.topic = runTopic.trim();
      if (runPillar) payload.pillar = runPillar;
      const res = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: '1', payload }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✓ Researcher running — run ID: ${data.runId.slice(0, 8)}…`);
        setRunModal(false);
        setRunTopic('');
        setRunPillar('');
        setRunAudience('young_professional');
      } else {
        showToast(`Error: ${data.error}`);
      }
    } catch (e: any) {
      showToast(`Error: ${e.message}`);
    }
    setRunning(false);
  }

  useEffect(() => { loadAll(); }, []);
    setLoading(true);
    const [b, i, q] = await Promise.all([
      supabase.from('research_briefs').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('content_calendar').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('social_queue').select('*').order('scheduled_for', { ascending: true }).limit(50),
    ]);
    setBriefs(b.data || []);
    setItems(i.data || []);
    setQueue(q.data || []);
    setLoading(false);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('content_calendar').update({ status }).eq('id', id);
    setItems(prev => prev.map(it => it.id === id ? { ...it, status } : it));
    if (selectedItem?.id === id) setSelectedItem((p: any) => ({ ...p, status }));
    showToast(`Marked as ${status}`);
  }

  async function publishToBlog(item: any) {
    if (item.type !== 'Blog Post') return;
    setPublishing(item.id);
    const d = item.content_data || {};
    const { error } = await supabase.from('blog_posts').insert({
      title:              d.title || item.title,
      slug:               slugify(d.title || item.title),
      excerpt:            d.meta_description || '',
      content:            d.content || '',
      category:           item.pillar ? item.pillar.charAt(0).toUpperCase() + item.pillar.slice(1) : 'General',
      author_name:        'Ascentor AI',
      read_time_minutes:  5,
      is_published:       false, // goes to blog as draft — admin publishes from /admin/blog
      published_at:       null,
    });
    if (error) {
      showToast(`Error: ${error.message}`);
    } else {
      await updateStatus(item.id, 'published');
      showToast('✓ Sent to Blog drafts — publish from /admin/blog');
    }
    setPublishing(null);
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    showToast('✓ Copied to clipboard');
  }

  const filteredItems = items.filter(it => {
    if (contentFilter !== 'all' && it.type !== contentFilter) return false;
    if (statusFilter !== 'all' && it.status !== statusFilter) return false;
    return true;
  });

  const counts = {
    draft:     items.filter(i => i.status === 'draft').length,
    approved:  items.filter(i => i.status === 'approved').length,
    published: items.filter(i => i.status === 'published').length,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=Cormorant+Garamond:ital,wght@0,600;1,600&display=swap');

        .cp-wrap { font-family: 'Syne', sans-serif; color: var(--admin-text); min-height: 100vh; }

        /* ── Header ── */
        .cp-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; flex-wrap: wrap; gap: 16px; }
        .cp-title { font-family: 'Cormorant Garamond', serif; font-size: 32px; font-weight: 600; color: #fff; line-height: 1; }
        .cp-title span { color: #E8A020; font-style: italic; }
        .cp-subtitle { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.1em; color: var(--admin-text-faint); margin-top: 6px; text-transform: uppercase; }
        .cp-refresh { padding: 8px 16px; border-radius: 8px; border: 1px solid var(--admin-bg-input); background: transparent; color: var(--admin-text-muted); font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.08em; cursor: pointer; transition: all 0.15s; }
        .cp-refresh:hover { color: #E8A020; border-color: rgba(232,160,32,0.3); }

        /* ── Stats row ── */
        .cp-stats { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
        .cp-stat { background: var(--admin-bg-card); border: 1px solid var(--admin-bg-input); border-radius: 12px; padding: 14px 20px; min-width: 110px; }
        .cp-stat-num { font-family: 'Cormorant Garamond', serif; font-size: 28px; font-weight: 600; line-height: 1; color: #fff; }
        .cp-stat-label { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--admin-text-faint); margin-top: 4px; }

        /* ── Tabs ── */
        .cp-tabs { display: flex; gap: 2px; background: var(--admin-bg-card); border: 1px solid var(--admin-bg-input); border-radius: 10px; padding: 3px; margin-bottom: 24px; width: fit-content; }
        .cp-tab { padding: 8px 20px; border-radius: 8px; border: none; cursor: pointer; font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; transition: all 0.15s; }
        .cp-tab.active { background: var(--admin-bg-input); color: #E8A020; }
        .cp-tab.inactive { background: transparent; color: var(--admin-text-faint); }
        .cp-tab:hover:not(.active) { color: var(--admin-text-muted); }

        /* ── Filters ── */
        .cp-filters { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
        .cp-filter-btn { padding: 5px 14px; border-radius: 6px; border: 1px solid var(--admin-bg-input); background: transparent; cursor: pointer; font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.06em; color: var(--admin-text-faint); transition: all 0.15s; }
        .cp-filter-btn.active { background: rgba(232,160,32,0.10); border-color: rgba(232,160,32,0.25); color: #E8A020; }
        .cp-filter-btn:hover:not(.active) { color: var(--admin-text); border-color: var(--admin-text-faint); }
        .cp-filter-sep { width: 1px; height: 20px; background: var(--admin-bg-input); margin: 0 4px; }

        /* ── Content grid ── */
        .cp-grid { display: grid; grid-template-columns: 1fr 380px; gap: 20px; }
        @media (max-width: 1100px) { .cp-grid { grid-template-columns: 1fr; } }

        /* ── Item list ── */
        .cp-list { display: flex; flex-direction: column; gap: 8px; }
        .cp-item { background: var(--admin-bg-card); border: 1px solid var(--admin-bg-input); border-radius: 12px; padding: 16px 18px; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
        .cp-item:hover { border-color: var(--admin-text-faint); }
        .cp-item.selected { border-color: rgba(232,160,32,0.35); background: var(--admin-bg-card-hover); }
        .cp-item-top { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .cp-type-badge { display: flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 6px; font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.08em; font-weight: 500; white-space: nowrap; }
        .cp-pillar-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .cp-item-title { font-size: 13px; font-weight: 600; color: var(--admin-text); line-height: 1.4; flex: 1; }
        .cp-item-meta { display: flex; align-items: center; gap: 12px; }
        .cp-status-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .cp-item-time { font-family: 'DM Mono', monospace; font-size: 9px; color: var(--admin-text-faint); }
        .cp-week-tag { font-family: 'DM Mono', monospace; font-size: 9px; color: var(--admin-text-faint); }

        /* ── Detail panel ── */
        .cp-detail { background: var(--admin-bg-card); border: 1px solid var(--admin-bg-input); border-radius: 12px; padding: 24px; position: sticky; top: 20px; max-height: calc(100vh - 120px); overflow-y: auto; }
        .cp-detail-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; gap: 12px; }
        .cp-detail-empty-icon { font-size: 32px; opacity: 0.3; }
        .cp-detail-empty-text { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.08em; color: var(--admin-text-faint); }
        .cp-detail-type { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
        .cp-detail-title { font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 600; color: #fff; line-height: 1.3; margin-bottom: 16px; }
        .cp-detail-content { font-size: 13px; color: var(--admin-text-dim); line-height: 1.8; white-space: pre-wrap; margin-bottom: 20px; max-height: 320px; overflow-y: auto; border: 1px solid var(--admin-bg-input); border-radius: 8px; padding: 14px; background: var(--admin-bg-deep); }
        .cp-detail-actions { display: flex; flex-direction: column; gap: 8px; }
        .cp-btn { padding: 10px 16px; border-radius: 8px; border: none; cursor: pointer; font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.03em; transition: all 0.15s; width: 100%; text-align: center; }
        .cp-btn-gold { background: #E8A020; color: var(--admin-bg); }
        .cp-btn-gold:hover { background: #F5C55A; }
        .cp-btn-gold:disabled { opacity: 0.4; cursor: not-allowed; }
        .cp-btn-outline { background: transparent; color: var(--admin-text-muted); border: 1px solid var(--admin-bg-input); }
        .cp-btn-outline:hover { color: var(--admin-text); border-color: var(--admin-text-faint); }
        .cp-btn-green { background: rgba(16,185,129,0.12); color: #10B981; border: 1px solid rgba(16,185,129,0.2); }
        .cp-btn-green:hover { background: rgba(16,185,129,0.2); }
        .cp-section-label { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--admin-text-faint); margin-bottom: 8px; margin-top: 16px; }
        .cp-sub-content { background: var(--admin-bg-deep); border: 1px solid var(--admin-bg-input); border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; }
        .cp-sub-label { font-family: 'DM Mono', monospace; font-size: 9px; color: #E8A020; letter-spacing: 0.08em; margin-bottom: 6px; }
        .cp-sub-text { font-size: 12px; color: var(--admin-text-dim); line-height: 1.7; white-space: pre-wrap; }

        /* ── Briefs ── */
        .cp-brief-card { background: var(--admin-bg-card); border: 1px solid var(--admin-bg-input); border-radius: 14px; padding: 20px 22px; margin-bottom: 12px; }
        .cp-brief-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        .cp-brief-topic { font-family: 'Cormorant Garamond', serif; font-size: 20px; font-weight: 600; color: #fff; line-height: 1.25; }
        .cp-brief-week { font-family: 'DM Mono', monospace; font-size: 9px; color: var(--admin-text-faint); letter-spacing: 0.1em; white-space: nowrap; }
        .cp-brief-angle { font-size: 13px; color: var(--admin-text-muted); line-height: 1.6; margin-bottom: 14px; }
        .cp-brief-tags { display: flex; gap: 6px; flex-wrap: wrap; }
        .cp-tag { padding: 3px 10px; border-radius: 4px; font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.06em; background: var(--admin-bg-deep); border: 1px solid var(--admin-bg-input); color: var(--admin-text-muted); }
        .cp-brief-section { margin-top: 14px; }
        .cp-brief-items { list-style: none; margin: 6px 0 0; display: flex; flex-direction: column; gap: 4px; }
        .cp-brief-items li { font-size: 12px; color: var(--admin-text-muted); padding-left: 12px; position: relative; line-height: 1.5; }
        .cp-brief-items li::before { content: '→'; position: absolute; left: 0; color: var(--admin-text-faint); font-size: 10px; }

        /* ── Queue ── */
        .cp-queue-item { background: var(--admin-bg-card); border: 1px solid var(--admin-bg-input); border-radius: 10px; padding: 14px 16px; display: flex; align-items: flex-start; gap: 14px; margin-bottom: 8px; }
        .cp-queue-time { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--admin-text-faint); white-space: nowrap; min-width: 80px; padding-top: 2px; }
        .cp-queue-content { flex: 1; font-size: 13px; color: var(--admin-text-dim); line-height: 1.6; }
        .cp-queue-status { font-family: 'DM Mono', monospace; font-size: 9px; padding: 3px 8px; border-radius: 4px; }

        /* ── Status colours ── */
        .status-draft     { color: var(--admin-text-muted); }
        .status-approved  { color: #E8A020; }
        .status-published { color: #10B981; }

        /* ── Empty state ── */
        .cp-empty { text-align: center; padding: 60px 24px; }
        .cp-empty-icon { font-size: 40px; margin-bottom: 12px; opacity: 0.3; }
        .cp-empty-text { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--admin-text-faint); letter-spacing: 0.08em; }

        /* ── Toast ── */
        .cp-toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); background: var(--admin-bg-card-hover); border: 1px solid rgba(232,160,32,0.25); color: #E8A020; font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.08em; padding: 10px 20px; border-radius: 8px; z-index: 100; white-space: nowrap; }

        .cp-run-btn { padding: 8px 18px; border-radius: 8px; border: 1px solid rgba(232,160,32,0.35); background: rgba(232,160,32,0.08); color: #E8A020; font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.03em; cursor: pointer; transition: all 0.15s; }
        .cp-run-btn:hover { background: rgba(232,160,32,0.16); border-color: rgba(232,160,32,0.6); }

        /* ── Modal ── */
        .cp-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .cp-modal { background: var(--admin-bg-card); border: 1px solid var(--admin-bg-input); border-radius: 16px; padding: 28px; width: 100%; max-width: 440px; }
        .cp-modal-title { font-family: 'Cormorant Garamond', serif; font-size: 24px; font-weight: 600; color: #fff; margin-bottom: 6px; }
        .cp-modal-sub { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--admin-text-faint); letter-spacing: 0.08em; margin-bottom: 24px; }
        .cp-field { margin-bottom: 18px; }
        .cp-label { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--admin-text-faint); margin-bottom: 7px; display: block; }
        .cp-input { width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--admin-bg-input); background: var(--admin-bg-deep); color: var(--admin-text); font-family: 'Syne', sans-serif; font-size: 13px; outline: none; box-sizing: border-box; }
        .cp-input:focus { border-color: rgba(232,160,32,0.4); }
        .cp-input::placeholder { color: var(--admin-text-faint); }
        .cp-select { width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--admin-bg-input); background: var(--admin-bg-deep); color: var(--admin-text); font-family: 'Syne', sans-serif; font-size: 13px; outline: none; cursor: pointer; }
        .cp-modal-actions { display: flex; gap: 10px; margin-top: 24px; }
        .cp-modal-cancel { flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--admin-bg-input); background: transparent; color: var(--admin-text-muted); font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 600; cursor: pointer; }
        .cp-modal-run { flex: 2; padding: 10px; border-radius: 8px; border: none; background: #E8A020; color: var(--admin-bg); font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 700; cursor: pointer; transition: background 0.15s; }
        .cp-modal-run:hover:not(:disabled) { background: #F5C55A; }
        .cp-modal-run:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <div className="cp-wrap">

        {/* Header */}
        <div className="cp-header">
          <div>
            <h1 className="cp-title">Content <span>Pipeline</span></h1>
            <p className="cp-subtitle">AI-generated content — review, approve, publish</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="cp-run-btn" onClick={() => setRunModal(true)}>▶ Run Researcher</button>
            <button className="cp-refresh" onClick={loadAll}>↻ Refresh</button>
          </div>
        </div>

        {/* Stats */}
        <div className="cp-stats">
          {[
            { num: items.length,      label: 'Total Items' },
            { num: counts.draft,      label: 'Drafts',    highlight: counts.draft > 0 },
            { num: counts.approved,   label: 'Approved' },
            { num: counts.published,  label: 'Published' },
            { num: briefs.length,     label: 'Briefs' },
            { num: queue.length,      label: 'Queued Posts' },
          ].map(s => (
            <div key={s.label} className="cp-stat">
              <div className="cp-stat-num" style={{ color: s.highlight ? '#E8A020' : 'var(--admin-text)' }}>{s.num}</div>
              <div className="cp-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="cp-tabs">
          {(['content', 'briefs', 'queue'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`cp-tab ${tab === t ? 'active' : 'inactive'}`}>
              {t === 'content' ? '✍️ Content' : t === 'briefs' ? '🔬 Research' : '📅 Queue'}
            </button>
          ))}
        </div>

        {loading && <div className="cp-loading">Loading pipeline...</div>}

        {/* ── CONTENT TAB ── */}
        {!loading && tab === 'content' && (
          <>
            <div className="cp-filters">
              {(['all', 'Blog Post', 'LinkedIn Post', 'Twitter Thread', 'Email Newsletter'] as ContentFilter[]).map(f => (
                <button key={f} onClick={() => setContentFilter(f)}
                  className={`cp-filter-btn ${contentFilter === f ? 'active' : ''}`}>
                  {f === 'all' ? 'All Types' : f}
                </button>
              ))}
              <div className="cp-filter-sep" />
              {(['all', 'draft', 'approved', 'published'] as StatusFilter[]).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`cp-filter-btn ${statusFilter === s ? 'active' : ''}`}>
                  {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
                  {s === 'draft' && counts.draft > 0 && ` (${counts.draft})`}
                </button>
              ))}
            </div>

            {filteredItems.length === 0 ? (
              <div className="cp-empty">
                <div className="cp-empty-icon">📭</div>
                <p className="cp-empty-text">No content matches these filters</p>
              </div>
            ) : (
              <div className="cp-grid">
                {/* List */}
                <div className="cp-list">
                  {filteredItems.map(item => {
                    const meta = TYPE_META[item.type] || TYPE_META['Blog Post'];
                    const pillarColor = PILLAR_COLORS[item.pillar] || 'var(--admin-text-muted)';
                    return (
                      <div key={item.id}
                        className={`cp-item ${selectedItem?.id === item.id ? 'selected' : ''}`}
                        onClick={() => setSelectedItem(item)}>
                        <div className="cp-item-top">
                          <span className="cp-type-badge" style={{ background: meta.bg, color: meta.color }}>
                            {meta.icon} {item.type}
                          </span>
                          <span className="cp-pillar-dot" style={{ background: pillarColor }} title={item.pillar} />
                        </div>
                        <div className="cp-item-title">{item.title}</div>
                        <div className="cp-item-meta" style={{ marginTop: 8 }}>
                          <span className="cp-status-dot" style={{
                            background: item.status === 'published' ? '#10B981' : item.status === 'approved' ? '#E8A020' : 'var(--admin-text-faint)'
                          }} />
                          <span className={`cp-item-time status-${item.status}`}>{item.status}</span>
                          {item.week && <span className="cp-week-tag">Week {item.week}</span>}
                          <span className="cp-item-time">{item.created_at ? timeAgo(item.created_at) : ''}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Detail panel */}
                <div className="cp-detail">
                  {!selectedItem ? (
                    <div className="cp-detail-empty">
                      <div className="cp-detail-empty-icon">👈</div>
                      <p className="cp-detail-empty-text">Select an item to preview</p>
                    </div>
                  ) : (
                    <ContentDetail
                      item={selectedItem}
                      onStatusChange={updateStatus}
                      onPublishToBlog={publishToBlog}
                      onCopy={copyToClipboard}
                      publishing={publishing === selectedItem.id}
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── BRIEFS TAB ── */}
        {!loading && tab === 'briefs' && (
          <div>
            {briefs.length === 0 ? (
              <div className="cp-empty">
                <div className="cp-empty-icon">🔬</div>
                <p className="cp-empty-text">No research briefs yet — they appear after the researcher agent runs</p>
              </div>
            ) : briefs.map(brief => (
              <BriefCard key={brief.id} brief={brief} />
            ))}
          </div>
        )}

        {/* ── QUEUE TAB ── */}
        {!loading && tab === 'queue' && (
          <div>
            {queue.length === 0 ? (
              <div className="cp-empty">
                <div className="cp-empty-icon">📅</div>
                <p className="cp-empty-text">No posts in queue yet</p>
              </div>
            ) : queue.map(post => (
              <div key={post.id} className="cp-queue-item">
                <div className="cp-queue-time">
                  {post.scheduled_for
                    ? new Date(post.scheduled_for).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : 'Unscheduled'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: 'var(--admin-text-muted)', letterSpacing: '0.08em' }}>
                      {post.platform}
                    </span>
                    <span className="cp-queue-status" style={{
                      background: post.status === 'posted' ? 'rgba(16,185,129,0.1)' : 'rgba(232,160,32,0.08)',
                      color: post.status === 'posted' ? '#10B981' : '#E8A020',
                    }}>
                      {post.status}
                    </span>
                  </div>
                  <div className="cp-queue-content">{post.content?.substring(0, 200)}{post.content?.length > 200 ? '…' : ''}</div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {runModal && (
        <div className="cp-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setRunModal(false)}>
          <div className="cp-modal">
            <div className="cp-modal-title">Run Researcher</div>
            <p className="cp-modal-sub">Triggers the content researcher + writer pipeline immediately</p>

            <div className="cp-field">
              <label className="cp-label">Audience</label>
              <select
                className="cp-select"
                value={runAudience}
                onChange={e => setRunAudience(e.target.value)}
              >
                <option value="young_professional">Young Professional (21–28) — hustle, first jobs, Gen Z</option>
                <option value="mid_career">Mid-Career (29–38) — management, promotions, pivots</option>
                <option value="executive">Executive / Senior (39–50) — strategy, legacy, leadership</option>
                <option value="general">General (all ages)</option>
              </select>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: 'var(--admin-text-faint)', marginTop: 5 }}>
                Shapes both what the researcher looks for and how the writer sounds
              </div>
            </div>

            <div className="cp-field">
              <label className="cp-label">Topic (optional)</label>
              <input
                className="cp-input"
                placeholder="e.g. Navigating salary negotiations in Lagos"
                value={runTopic}
                onChange={e => setRunTopic(e.target.value)}
              />
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: 'var(--admin-text-faint)', marginTop: 5 }}>
                Leave blank to let the AI choose based on trends
              </div>
            </div>

            <div className="cp-field">
              <label className="cp-label">Pillar (optional)</label>
              <select
                className="cp-select"
                value={runPillar}
                onChange={e => setRunPillar(e.target.value)}
              >
                <option value="">Auto (follows weekly rotation)</option>
                <option value="leadership">Leadership</option>
                <option value="career">Career</option>
                <option value="ai">AI</option>
                <option value="coaching">Coaching</option>
                <option value="community">Community</option>
              </select>
            </div>

            <div className="cp-modal-actions">
              <button className="cp-modal-cancel" onClick={() => setRunModal(false)}>Cancel</button>
              <button className="cp-modal-run" onClick={triggerResearcher} disabled={running}>
                {running ? 'Triggering…' : '▶ Run Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="cp-toast">{toast}</div>}
    </>
  );
}

// ── Content Detail Component ──────────────────────────────────
function ContentDetail({ item, onStatusChange, onPublishToBlog, onCopy, publishing }: {
  item: any;
  onStatusChange: (id: string, status: string) => void;
  onPublishToBlog: (item: any) => void;
  onCopy: (text: string) => void;
  publishing: boolean;
}) {
  const d = item.content_data || {};
  const meta = TYPE_META[item.type] || TYPE_META['Blog Post'];

  // Render content based on type
  function renderContent() {
    if (item.type === 'Blog Post') {
      return (
        <>
          <p className="cp-section-label">Title</p>
          <div className="cp-sub-content"><p className="cp-sub-text">{d.title || item.title}</p></div>
          <p className="cp-section-label">Body</p>
          <div className="cp-detail-content">{d.content || 'No content'}</div>
          {d.meta_description && (
            <>
              <p className="cp-section-label">SEO Description</p>
              <div className="cp-sub-content"><p className="cp-sub-text">{d.meta_description}</p></div>
            </>
          )}
          {d.cta && (
            <>
              <p className="cp-section-label">CTA</p>
              <div className="cp-sub-content"><p className="cp-sub-text">{d.cta}</p></div>
            </>
          )}
        </>
      );
    }

    if (item.type === 'LinkedIn Post') {
      return (
        <>
          <p className="cp-section-label">Hook</p>
          <div className="cp-sub-content"><p className="cp-sub-text">{d.hook || '—'}</p></div>
          <p className="cp-section-label">Full Post</p>
          <div className="cp-detail-content">{d.content || 'No content'}</div>
        </>
      );
    }

    if (item.type === 'Twitter Thread') {
      const tweets = d.tweets || [];
      return (
        <>
          <p className="cp-section-label">Thread Opener</p>
          <div className="cp-sub-content"><p className="cp-sub-text">{d.opener || '—'}</p></div>
          {tweets.map((tweet: string, i: number) => (
            <div key={i} className="cp-sub-content" style={{ marginBottom: 6 }}>
              <div className="cp-sub-label">{i + 2}/{tweets.length + 2}</div>
              <p className="cp-sub-text">{tweet}</p>
            </div>
          ))}
          {d.cta && (
            <>
              <p className="cp-section-label">CTA Tweet</p>
              <div className="cp-sub-content"><p className="cp-sub-text">{d.cta}</p></div>
            </>
          )}
        </>
      );
    }

    if (item.type === 'Email Newsletter') {
      return (
        <>
          <p className="cp-section-label">Subject Line</p>
          <div className="cp-sub-content"><p className="cp-sub-text">{d.subject || '—'}</p></div>
          <p className="cp-section-label">Preview Text</p>
          <div className="cp-sub-content"><p className="cp-sub-text">{d.preview_text || '—'}</p></div>
          <p className="cp-section-label">Body</p>
          <div className="cp-detail-content">{d.body || 'No content'}</div>
        </>
      );
    }

    return <div className="cp-detail-content">{JSON.stringify(d, null, 2)}</div>;
  }

  // Copy the main shareable text
  function getCopyText() {
    if (item.type === 'Blog Post') return d.content || '';
    if (item.type === 'LinkedIn Post') return d.content || '';
    if (item.type === 'Twitter Thread') return [d.opener, ...(d.tweets || []), d.cta].filter(Boolean).join('\n\n---\n\n');
    if (item.type === 'Email Newsletter') return `Subject: ${d.subject}\n\n${d.body}`;
    return JSON.stringify(d, null, 2);
  }

  return (
    <>
      <div className="cp-detail-type">
        <span style={{
          fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.1em',
          padding: '3px 10px', borderRadius: 6,
          background: meta.bg, color: meta.color,
        }}>
          {meta.icon} {item.type}
        </span>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: 'var(--admin-text-faint)' }}>
          {item.pillar && `• ${item.pillar}`} {item.week && `• Week ${item.week}`}
        </span>
      </div>

      <div className="cp-detail-title">{item.title}</div>

      {renderContent()}

      <div className="cp-detail-actions" style={{ marginTop: 20, borderTop: '1px solid var(--admin-bg-input)', paddingTop: 16 }}>
        {/* Status actions */}
        {item.status === 'draft' && (
          <button className="cp-btn cp-btn-gold" onClick={() => onStatusChange(item.id, 'approved')}>
            ✓ Approve
          </button>
        )}
        {item.status === 'approved' && (
          <button className="cp-btn cp-btn-outline" onClick={() => onStatusChange(item.id, 'draft')}>
            ← Back to Draft
          </button>
        )}

        {/* Type-specific publish action */}
        {item.type === 'Blog Post' && item.status !== 'published' && (
          <button
            className="cp-btn cp-btn-green"
            onClick={() => onPublishToBlog(item)}
            disabled={publishing}
          >
            {publishing ? 'Sending…' : '→ Send to Blog Drafts'}
          </button>
        )}

        {item.type === 'LinkedIn Post' && (
          <button className="cp-btn cp-btn-outline" onClick={() => onCopy(getCopyText())}>
            📋 Copy for LinkedIn
          </button>
        )}

        {item.type === 'Twitter Thread' && (
          <button className="cp-btn cp-btn-outline" onClick={() => onCopy(getCopyText())}>
            📋 Copy Thread
          </button>
        )}

        {item.type === 'Email Newsletter' && (
          <button className="cp-btn cp-btn-outline" onClick={() => onCopy(getCopyText())}>
            📋 Copy Newsletter
          </button>
        )}

        {/* Always available */}
        <button className="cp-btn cp-btn-outline" onClick={() => onCopy(getCopyText())}>
          📋 Copy Raw Content
        </button>
      </div>
    </>
  );
}

// ── Brief Card Component ──────────────────────────────────────
function BriefCard({ brief }: { brief: any }) {
  const [expanded, setExpanded] = useState(false);
  const d = brief.brief_data || {};
  const pillarColor = PILLAR_COLORS[brief.pillar] || 'var(--admin-text-muted)';

  return (
    <div className="cp-brief-card">
      <div className="cp-brief-top">
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{
              fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.1em',
              padding: '3px 10px', borderRadius: 6, textTransform: 'uppercase',
              background: `${pillarColor}15`, color: pillarColor, border: `1px solid ${pillarColor}25`,
            }}>
              {brief.pillar}
            </span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: 'var(--admin-text-faint)' }}>
              Week {brief.week_number}
            </span>
          </div>
          <div className="cp-brief-topic">{brief.topic}</div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{ background: 'none', border: 'none', color: 'var(--admin-text-faint)', cursor: 'pointer', fontSize: 12, padding: '4px 8px' }}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {d.angle && <p className="cp-brief-angle">{d.angle}</p>}

      <div className="cp-brief-tags">
        {(d.seoKeywords || brief.trends_raw || []).slice(0, 4).map((k: string, i: number) => (
          <span key={i} className="cp-tag">{k}</span>
        ))}
      </div>

      {expanded && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--admin-bg-input)', paddingTop: 14 }}>
          {d.targetAudience && (
            <div className="cp-brief-section">
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: 'var(--admin-text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Target Audience</p>
              <p style={{ fontSize: 13, color: 'var(--admin-text-muted)' }}>{d.targetAudience}</p>
            </div>
          )}
          {d.keyMessages?.length > 0 && (
            <div className="cp-brief-section">
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: 'var(--admin-text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Key Messages</p>
              <ul className="cp-brief-items">
                {d.keyMessages.map((m: string, i: number) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}
          {d.hooks?.length > 0 && (
            <div className="cp-brief-section">
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: 'var(--admin-text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Hooks</p>
              <ul className="cp-brief-items">
                {d.hooks.map((h: string, i: number) => <li key={i}>{h}</li>)}
              </ul>
            </div>
          )}
          {d.dataPoints?.length > 0 && (
            <div className="cp-brief-section">
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: 'var(--admin-text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Data Points</p>
              <ul className="cp-brief-items">
                {d.dataPoints.map((p: string, i: number) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
          {d.urgencyReason && (
            <div className="cp-brief-section">
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: 'var(--admin-text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Why Now</p>
              <p style={{ fontSize: 13, color: 'var(--admin-text-muted)' }}>{d.urgencyReason}</p>
            </div>
          )}
          {brief.research_raw && (
            <div className="cp-brief-section">
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: 'var(--admin-text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Raw Research</p>
              <div style={{ background: 'var(--admin-bg-deep)', border: '1px solid var(--admin-bg-input)', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: 'var(--admin-text-muted)', lineHeight: 1.7, maxHeight: 200, overflowY: 'auto' }}>
                {brief.research_raw}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
