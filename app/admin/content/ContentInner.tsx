'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─────────────────────────────────────────────────────────────────
// /admin/content — Content Pipeline
//
// Flow:
//   1. Researcher agent runs Monday → saves brief → triggers Writer
//   2. Writer saves blog + social posts to content_calendar (status: draft)
//   3. Admin reviews here → clicks Approve
//      - Blog Post:        approve only (publish separately from /admin/blog)
//      - LinkedIn / Twitter / Newsletter: approve → auto-added to social_queue
//        with optimal WAT posting time (no separate scheduler agent needed)
//   4. Queue tab = copy-paste list for manual posting (Buffer API: future)
// ─────────────────────────────────────────────────────────────────

const supabase = createClient();

// Optimal WAT posting times per platform (day: 0=Sun…6=Sat)
const POSTING_SCHEDULE: Record<string, { day: number; hour: number; minute: number }[]> = {
  LinkedIn: [
    { day: 1, hour: 8,  minute: 0  },
    { day: 2, hour: 12, minute: 0  },
    { day: 3, hour: 8,  minute: 30 },
    { day: 4, hour: 17, minute: 0  },
    { day: 5, hour: 9,  minute: 0  },
  ],
  'Twitter/X': [
    { day: 1, hour: 9,  minute: 0  },
    { day: 1, hour: 19, minute: 0  },
    { day: 3, hour: 9,  minute: 0  },
    { day: 5, hour: 10, minute: 0  },
  ],
  Email:   [{ day: 5, hour: 7,  minute: 0 }],
  Website: [{ day: 1, hour: 10, minute: 0 }],
};

function nextSlot(from: Date, day: number, hour: number, minute: number): Date {
  const d = new Date(from);
  d.setHours(hour, minute, 0, 0);
  const diff = (day - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (diff === 0 && d <= from ? 7 : diff));
  return d;
}

function platformFor(item: any): string {
  if (item.type === 'LinkedIn Post')    return 'LinkedIn';
  if (item.type === 'Twitter Thread')   return 'Twitter/X';
  if (item.type === 'Email Newsletter') return 'Email';
  if (item.type === 'Blog Post')        return 'Website';
  return 'LinkedIn';
}

function postTextFor(item: any): string {
  const d = item.content_data || {};
  if (item.type === 'LinkedIn Post')    return d.content || d.hook || item.title;
  if (item.type === 'Twitter Thread')   return [d.opener, ...(d.tweets || []).slice(0, 3), d.cta].filter(Boolean).join('\n\n');
  if (item.type === 'Email Newsletter') return `Subject: ${d.subject || item.title}\n\n${d.body || ''}`;
  if (item.type === 'Blog Post')        return `${d.title || item.title}\n\n${(d.content || '').substring(0, 300)}…`;
  return item.title;
}

type Tab           = 'content' | 'briefs' | 'queue';
type ContentFilter = 'all' | 'Blog Post' | 'LinkedIn Post' | 'Twitter Thread' | 'Email Newsletter';
type StatusFilter  = 'all' | 'draft' | 'approved' | 'published';

const TYPE_META: Record<string, { icon: string; color: string; bg: string }> = {
  'Blog Post':        { icon: '📝', color: '#E8A020', bg: 'rgba(232,160,32,0.10)' },
  'LinkedIn Post':    { icon: '💼', color: '#0A66C2', bg: 'rgba(10,102,194,0.10)' },
  'Twitter Thread':   { icon: '𝕏',  color: '#D4CFC3', bg: 'rgba(212,207,195,0.10)' },
  'Email Newsletter': { icon: '✉️', color: '#14B8A6', bg: 'rgba(20,184,166,0.10)' },
};

const PILLAR_COLORS: Record<string, string> = {
  leadership: '#E8A020', career: '#14B8A6', ai: '#8B5CF6',
  coaching:   '#3B82F6', community: '#EF4444',
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
  const [tab,           setTab]           = useState<Tab>('content');
  const [briefs,        setBriefs]        = useState<any[]>([]);
  const [items,         setItems]         = useState<any[]>([]);
  const [queue,         setQueue]         = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>('draft');
  const [selectedItem,  setSelectedItem]  = useState<any>(null);
  const [publishing,    setPublishing]    = useState<string | null>(null);
  const [toast,         setToast]         = useState('');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [b, i, q] = await Promise.all([
      supabase.from('research_briefs').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('content_calendar').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('social_queue').select('*').order('scheduled_for', { ascending: true }).limit(100),
    ]);
    setBriefs(b.data || []);
    setItems(i.data || []);
    setQueue(q.data || []);
    setLoading(false);
  }

  async function refreshQueue() {
    const { data: q } = await supabase.from('social_queue').select('*').order('scheduled_for', { ascending: true }).limit(100);
    setQueue(q || []);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  async function approveItem(item: any) {
    await supabase.from('content_calendar').update({ status: 'approved' }).eq('id', item.id);
    setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'approved' } : it));
    if (selectedItem?.id === item.id) setSelectedItem((p: any) => ({ ...p, status: 'approved' }));

    if (item.type === 'Blog Post') {
      showToast('✓ Approved — publish to blog when ready');
      return;
    }

    const platform = platformFor(item);
    const slots    = POSTING_SCHEDULE[platform] || POSTING_SCHEDULE['LinkedIn'];

    const { data: existing } = await supabase
      .from('social_queue')
      .select('scheduled_for')
      .eq('platform', platform)
      .gte('scheduled_for', new Date().toISOString());

    const usedTimes = new Set((existing || []).map((r: any) => r.scheduled_for));
    const now = new Date();
    let scheduled: Date | null = null;

    for (let attempt = 0; attempt < slots.length * 3; attempt++) {
      const slot = slots[attempt % slots.length];
      const candidate = nextSlot(now, slot.day, slot.hour, slot.minute);
      const weeksOffset = Math.floor(attempt / slots.length);
      candidate.setDate(candidate.getDate() + weeksOffset * 7);
      if (!usedTimes.has(candidate.toISOString())) {
        scheduled = candidate;
        break;
      }
    }

    const { error } = await supabase.from('social_queue').insert({
      platform,
      content:             postTextFor(item),
      pillar:              item.pillar,
      scheduled_for:       scheduled?.toISOString() ?? null,
      status:              'queued',
      content_calendar_id: item.id,
      created_at:          new Date().toISOString(),
    });

    if (error) {
      showToast(`Approved, but queue failed: ${error.message}`);
    } else {
      const when = scheduled
        ? scheduled.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : 'unscheduled';
      showToast(`✓ Approved + queued for ${platform} · ${when}`);
      await refreshQueue();
    }
  }

  async function unapproveItem(id: string) {
    await supabase.from('content_calendar').update({ status: 'draft' }).eq('id', id);
    await supabase.from('social_queue').delete().eq('content_calendar_id', id);
    setItems(prev => prev.map(it => it.id === id ? { ...it, status: 'draft' } : it));
    if (selectedItem?.id === id) setSelectedItem((p: any) => ({ ...p, status: 'draft' }));
    await refreshQueue();
    showToast('↩ Returned to draft · removed from queue');
  }

  async function markPosted(queueId: string) {
    await supabase.from('social_queue').update({ status: 'posted' }).eq('id', queueId);
    setQueue(prev => prev.map(q => q.id === queueId ? { ...q, status: 'posted' } : q));
    showToast('✓ Marked as posted');
  }

  async function publishToBlog(item: any) {
    if (item.type !== 'Blog Post') return;
    setPublishing(item.id);
    const d = item.content_data || {};
    const { error } = await supabase.from('blog_posts').insert({
      title:             d.title || item.title,
      slug:              slugify(d.title || item.title),
      excerpt:           d.meta_description || d.excerpt || '',
      content:           d.content || '',
      category:          item.pillar ? item.pillar.charAt(0).toUpperCase() + item.pillar.slice(1) : 'General',
      author_name:       'Ascentor AI',
      read_time_minutes: 5,
      is_published:      false,
      published_at:      null,
    });
    if (error) {
      showToast(`Error: ${error.message}`);
    } else {
      await supabase.from('content_calendar').update({ status: 'published' }).eq('id', item.id);
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'published' } : it));
      if (selectedItem?.id === item.id) setSelectedItem((p: any) => ({ ...p, status: 'published' }));
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
    if (statusFilter  !== 'all' && it.status !== statusFilter) return false;
    return true;
  });

  const counts = {
    draft:     items.filter(i => i.status === 'draft').length,
    approved:  items.filter(i => i.status === 'approved').length,
    published: items.filter(i => i.status === 'published').length,
  };

  const queueCounts = {
    queued: queue.filter(q => q.status === 'queued').length,
    posted: queue.filter(q => q.status === 'posted').length,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=Cormorant+Garamond:ital,wght@0,600;1,600&display=swap');

        .cp-wrap { font-family: 'Syne', sans-serif; color: #D4CFC3; min-height: 100vh; }

        .cp-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; flex-wrap: wrap; gap: 16px; }
        .cp-title { font-family: 'Cormorant Garamond', serif; font-size: 32px; font-weight: 600; color: #fff; line-height: 1; }
        .cp-title span { color: #E8A020; font-style: italic; }
        .cp-subtitle { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.1em; color: #4A4438; margin-top: 6px; text-transform: uppercase; }
        .cp-refresh { padding: 8px 16px; border-radius: 8px; border: 1px solid #2E2A22; background: transparent; color: #7A7260; font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.08em; cursor: pointer; transition: all 0.15s; }
        .cp-refresh:hover { color: #E8A020; border-color: rgba(232,160,32,0.3); }

        .cp-stats { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
        .cp-stat { background: #1E1C17; border: 1px solid #2E2A22; border-radius: 12px; padding: 14px 20px; min-width: 110px; }
        .cp-stat-num { font-family: 'Cormorant Garamond', serif; font-size: 28px; font-weight: 600; line-height: 1; color: #fff; }
        .cp-stat-label { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: #4A4438; margin-top: 4px; }

        .cp-tabs { display: flex; gap: 2px; background: #1E1C17; border: 1px solid #2E2A22; border-radius: 10px; padding: 3px; margin-bottom: 24px; width: fit-content; }
        .cp-tab { padding: 8px 20px; border-radius: 8px; border: none; cursor: pointer; font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; transition: all 0.15s; }
        .cp-tab.active   { background: #2E2A22; color: #E8A020; }
        .cp-tab.inactive { background: transparent; color: #4A4438; }
        .cp-tab:hover:not(.active) { color: #7A7260; }

        .cp-filters { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
        .cp-filter-btn { padding: 5px 14px; border-radius: 6px; border: 1px solid #2E2A22; background: transparent; cursor: pointer; font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.06em; color: #4A4438; transition: all 0.15s; }
        .cp-filter-btn.active { background: rgba(232,160,32,0.10); border-color: rgba(232,160,32,0.25); color: #E8A020; }
        .cp-filter-btn:hover:not(.active) { color: #D4CFC3; border-color: #4A4438; }
        .cp-filter-sep { width: 1px; height: 20px; background: #2E2A22; margin: 0 4px; }

        .cp-grid { display: grid; grid-template-columns: 1fr 380px; gap: 20px; }
        @media (max-width: 1100px) { .cp-grid { grid-template-columns: 1fr; } }

        .cp-list { display: flex; flex-direction: column; gap: 8px; }
        .cp-item { background: #1E1C17; border: 1px solid #2E2A22; border-radius: 12px; padding: 16px 18px; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
        .cp-item:hover { border-color: #4A4438; }
        .cp-item.selected { border-color: rgba(232,160,32,0.35); background: #23201A; }
        .cp-item-top { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .cp-type-badge { display: flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 6px; font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.08em; font-weight: 500; white-space: nowrap; }
        .cp-pillar-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .cp-item-title { font-size: 13px; font-weight: 600; color: #D4CFC3; line-height: 1.4; }
        .cp-item-meta { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
        .cp-status-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .cp-item-time { font-family: 'DM Mono', monospace; font-size: 9px; color: #4A4438; }

        .cp-detail { background: #1E1C17; border: 1px solid #2E2A22; border-radius: 12px; padding: 24px; position: sticky; top: 20px; max-height: calc(100vh - 120px); overflow-y: auto; }
        .cp-detail-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; gap: 12px; }
        .cp-detail-empty-icon { font-size: 32px; opacity: 0.3; }
        .cp-detail-empty-text { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.08em; color: #4A4438; }
        .cp-detail-title { font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 600; color: #fff; line-height: 1.3; margin-bottom: 16px; }
        .cp-detail-content { font-size: 13px; color: #9A9280; line-height: 1.8; white-space: pre-wrap; margin-bottom: 20px; max-height: 320px; overflow-y: auto; border: 1px solid #2E2A22; border-radius: 8px; padding: 14px; background: #141210; }
        .cp-detail-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 20px; border-top: 1px solid #2E2A22; padding-top: 16px; }
        .cp-btn { padding: 10px 16px; border-radius: 8px; border: none; cursor: pointer; font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.03em; transition: all 0.15s; width: 100%; text-align: center; }
        .cp-btn-gold { background: #E8A020; color: #0C0B08; }
        .cp-btn-gold:hover { background: #F5C55A; }
        .cp-btn-gold:disabled { opacity: 0.4; cursor: not-allowed; }
        .cp-btn-outline { background: transparent; color: #7A7260; border: 1px solid #2E2A22; }
        .cp-btn-outline:hover { color: #D4CFC3; border-color: #4A4438; }
        .cp-btn-green { background: rgba(16,185,129,0.12); color: #10B981; border: 1px solid rgba(16,185,129,0.2); }
        .cp-btn-green:hover { background: rgba(16,185,129,0.2); }
        .cp-btn-red { background: rgba(239,68,68,0.10); color: #EF4444; border: 1px solid rgba(239,68,68,0.2); }
        .cp-btn-red:hover { background: rgba(239,68,68,0.18); }
        .cp-section-label { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: #4A4438; margin-bottom: 8px; margin-top: 16px; }
        .cp-sub-content { background: #141210; border: 1px solid #2E2A22; border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; }
        .cp-sub-label { font-family: 'DM Mono', monospace; font-size: 9px; color: #E8A020; letter-spacing: 0.08em; margin-bottom: 6px; }
        .cp-sub-text { font-size: 12px; color: #9A9280; line-height: 1.7; white-space: pre-wrap; }

        .cp-queue-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
        .cp-queue-hint { font-family: 'DM Mono', monospace; font-size: 10px; color: #4A4438; letter-spacing: 0.06em; }
        .cp-queue-counts { display: flex; gap: 16px; }
        .cp-queue-count { font-family: 'DM Mono', monospace; font-size: 10px; color: #4A4438; }
        .cp-queue-count span { color: #E8A020; font-weight: 600; }
        .cp-queue-item { background: #1E1C17; border: 1px solid #2E2A22; border-radius: 10px; padding: 14px 16px; display: flex; align-items: flex-start; gap: 14px; margin-bottom: 8px; transition: border-color 0.15s; }
        .cp-queue-item:hover { border-color: #4A4438; }
        .cp-queue-item.posted { opacity: 0.4; }
        .cp-queue-time { font-family: 'DM Mono', monospace; font-size: 10px; color: #4A4438; white-space: pre; min-width: 95px; padding-top: 2px; line-height: 1.6; }
        .cp-queue-body { flex: 1; }
        .cp-queue-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
        .cp-queue-platform { font-family: 'DM Mono', monospace; font-size: 9px; color: #7A7260; letter-spacing: 0.08em; }
        .cp-queue-status { font-family: 'DM Mono', monospace; font-size: 9px; padding: 2px 7px; border-radius: 4px; }
        .cp-queue-text { font-size: 13px; color: #9A9280; line-height: 1.6; }
        .cp-queue-actions { display: flex; flex-direction: column; gap: 6px; }
        .cp-qbtn { padding: 5px 11px; border-radius: 6px; border: none; cursor: pointer; font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.05em; transition: all 0.15s; white-space: nowrap; }
        .cp-qbtn-copy { background: #1A1814; border: 1px solid #2E2A22; color: #7A7260; }
        .cp-qbtn-copy:hover { color: #D4CFC3; border-color: #4A4438; }
        .cp-qbtn-done { background: rgba(16,185,129,0.10); border: 1px solid rgba(16,185,129,0.2); color: #10B981; }
        .cp-qbtn-done:hover { background: rgba(16,185,129,0.2); }

        .cp-brief-card { background: #1E1C17; border: 1px solid #2E2A22; border-radius: 14px; padding: 20px 22px; margin-bottom: 12px; }
        .cp-brief-topic { font-family: 'Cormorant Garamond', serif; font-size: 20px; font-weight: 600; color: #fff; line-height: 1.25; }
        .cp-brief-angle { font-size: 13px; color: #7A7260; line-height: 1.6; margin: 8px 0 14px; }
        .cp-brief-tags { display: flex; gap: 6px; flex-wrap: wrap; }
        .cp-tag { padding: 3px 10px; border-radius: 4px; font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.06em; background: #141210; border: 1px solid #2E2A22; color: #7A7260; }
        .cp-brief-items { list-style: none; margin: 6px 0 0; display: flex; flex-direction: column; gap: 4px; }
        .cp-brief-items li { font-size: 12px; color: #7A7260; padding-left: 14px; position: relative; line-height: 1.5; }
        .cp-brief-items li::before { content: '→'; position: absolute; left: 0; color: #4A4438; font-size: 10px; }

        .status-draft     { color: #7A7260; }
        .status-approved  { color: #E8A020; }
        .status-published { color: #10B981; }

        .cp-empty { text-align: center; padding: 60px 24px; }
        .cp-empty-icon { font-size: 40px; margin-bottom: 12px; opacity: 0.3; }
        .cp-empty-text { font-family: 'DM Mono', monospace; font-size: 11px; color: #4A4438; letter-spacing: 0.08em; }

        .cp-toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); background: #23201A; border: 1px solid rgba(232,160,32,0.25); color: #E8A020; font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.08em; padding: 10px 20px; border-radius: 8px; z-index: 100; white-space: nowrap; pointer-events: none; }
        .cp-loading { display: flex; align-items: center; justify-content: center; height: 200px; font-family: 'DM Mono', monospace; font-size: 10px; color: #4A4438; letter-spacing: 0.1em; }
      `}</style>

      <div className="cp-wrap">

        <div className="cp-header">
          <div>
            <h1 className="cp-title">Content <span>Pipeline</span></h1>
            <p className="cp-subtitle">AI-generated content — review, approve, publish</p>
          </div>
          <button className="cp-refresh" onClick={loadAll}>↻ Refresh</button>
        </div>

        <div className="cp-stats">
          {[
            { num: items.length,       label: 'Total Items' },
            { num: counts.draft,       label: 'Drafts',      highlight: counts.draft > 0 },
            { num: counts.approved,    label: 'Approved' },
            { num: counts.published,   label: 'Published' },
            { num: briefs.length,      label: 'Briefs' },
            { num: queueCounts.queued, label: 'Queued Posts', highlight: queueCounts.queued > 0 },
          ].map(s => (
            <div key={s.label} className="cp-stat">
              <div className="cp-stat-num" style={{ color: (s as any).highlight ? '#E8A020' : '#fff' }}>{s.num}</div>
              <div className="cp-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="cp-tabs">
          {(['content', 'briefs', 'queue'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`cp-tab ${tab === t ? 'active' : 'inactive'}`}>
              {t === 'content' ? '✍️ Content'
                : t === 'briefs' ? '🔬 Research'
                : `📅 Queue${queueCounts.queued > 0 ? ` (${queueCounts.queued})` : ''}`}
            </button>
          ))}
        </div>

        {loading && <div className="cp-loading">Loading pipeline…</div>}

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
                <div className="cp-list">
                  {filteredItems.map(item => {
                    const meta        = TYPE_META[item.type] || TYPE_META['Blog Post'];
                    const pillarColor = PILLAR_COLORS[item.pillar] || '#7A7260';
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
                        <div className="cp-item-meta">
                          <span className="cp-status-dot" style={{
                            background: item.status === 'published' ? '#10B981' : item.status === 'approved' ? '#E8A020' : '#4A4438'
                          }} />
                          <span className={`cp-item-time status-${item.status}`}>{item.status}</span>
                          {item.week && <span className="cp-item-time">Week {item.week}</span>}
                          <span className="cp-item-time">{item.created_at ? timeAgo(item.created_at) : ''}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="cp-detail">
                  {!selectedItem ? (
                    <div className="cp-detail-empty">
                      <div className="cp-detail-empty-icon">👈</div>
                      <p className="cp-detail-empty-text">Select an item to preview</p>
                    </div>
                  ) : (
                    <ContentDetail
                      item={selectedItem}
                      onApprove={approveItem}
                      onUnapprove={unapproveItem}
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
                <p className="cp-empty-text">No research briefs yet — researcher runs every Monday at 5am</p>
              </div>
            ) : briefs.map(brief => (
              <BriefCard key={brief.id} brief={brief} />
            ))}
          </div>
        )}

        {/* ── QUEUE TAB ── */}
        {!loading && tab === 'queue' && (
          <div>
            <div className="cp-queue-header">
              <p className="cp-queue-hint">Approve content in the Content tab → posts appear here automatically</p>
              <div className="cp-queue-counts">
                <span className="cp-queue-count">Pending: <span>{queueCounts.queued}</span></span>
                <span className="cp-queue-count">Posted: <span style={{ color: '#10B981' }}>{queueCounts.posted}</span></span>
              </div>
            </div>

            {queue.length === 0 ? (
              <div className="cp-empty">
                <div className="cp-empty-icon">📅</div>
                <p className="cp-empty-text">Queue empty — approve social posts in Content tab to add them here</p>
              </div>
            ) : queue.map(post => (
              <div key={post.id} className={`cp-queue-item ${post.status === 'posted' ? 'posted' : ''}`}>
                <div className="cp-queue-time">
                  {post.scheduled_for
                    ? new Date(post.scheduled_for).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) +
                      '\n' + new Date(post.scheduled_for).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' WAT'
                    : 'Unscheduled'}
                </div>
                <div className="cp-queue-body">
                  <div className="cp-queue-meta">
                    <span className="cp-queue-platform">{post.platform}</span>
                    {post.pillar && (
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: PILLAR_COLORS[post.pillar] || '#4A4438' }}>
                        · {post.pillar}
                      </span>
                    )}
                    <span className="cp-queue-status" style={{
                      background: post.status === 'posted' ? 'rgba(16,185,129,0.1)' : 'rgba(232,160,32,0.08)',
                      color:      post.status === 'posted' ? '#10B981' : '#E8A020',
                    }}>
                      {post.status}
                    </span>
                  </div>
                  <div className="cp-queue-text">
                    {(post.content || '').substring(0, 220)}{(post.content || '').length > 220 ? '…' : ''}
                  </div>
                </div>
                <div className="cp-queue-actions">
                  <button className="cp-qbtn cp-qbtn-copy" onClick={() => copyToClipboard(post.content || '')}>
                    📋 Copy
                  </button>
                  {post.status !== 'posted' && (
                    <button className="cp-qbtn cp-qbtn-done" onClick={() => markPosted(post.id)}>
                      ✓ Posted
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {toast && <div className="cp-toast">{toast}</div>}
    </>
  );
}

// ── Content Detail Panel ──────────────────────────────────────
function ContentDetail({ item, onApprove, onUnapprove, onPublishToBlog, onCopy, publishing }: {
  item:            any;
  onApprove:       (item: any) => void;
  onUnapprove:     (id: string) => void;
  onPublishToBlog: (item: any) => void;
  onCopy:          (text: string) => void;
  publishing:      boolean;
}) {
  const d    = item.content_data || {};
  const meta = TYPE_META[item.type] || TYPE_META['Blog Post'];
  const isBlog = item.type === 'Blog Post';

  function renderContent() {
    if (isBlog) return (
      <>
        <p className="cp-section-label">Title</p>
        <div className="cp-sub-content"><p className="cp-sub-text">{d.title || item.title}</p></div>
        <p className="cp-section-label">Body</p>
        <div className="cp-detail-content">{d.content || 'No content'}</div>
        {d.meta_description && (<>
          <p className="cp-section-label">SEO Description</p>
          <div className="cp-sub-content"><p className="cp-sub-text">{d.meta_description}</p></div>
        </>)}
        {d.cta && (<>
          <p className="cp-section-label">CTA</p>
          <div className="cp-sub-content"><p className="cp-sub-text">{d.cta}</p></div>
        </>)}
      </>
    );
    if (item.type === 'LinkedIn Post') return (
      <>
        <p className="cp-section-label">Hook</p>
        <div className="cp-sub-content"><p className="cp-sub-text">{d.hook || '—'}</p></div>
        <p className="cp-section-label">Full Post</p>
        <div className="cp-detail-content">{d.content || 'No content'}</div>
      </>
    );
    if (item.type === 'Twitter Thread') {
      const tweets = d.tweets || [];
      return (
        <>
          <p className="cp-section-label">Opener</p>
          <div className="cp-sub-content"><p className="cp-sub-text">{d.opener || '—'}</p></div>
          {tweets.map((t: string, i: number) => (
            <div key={i} className="cp-sub-content" style={{ marginBottom: 6 }}>
              <div className="cp-sub-label">{i + 2}/{tweets.length + 2}</div>
              <p className="cp-sub-text">{t}</p>
            </div>
          ))}
          {d.cta && (<>
            <p className="cp-section-label">CTA Tweet</p>
            <div className="cp-sub-content"><p className="cp-sub-text">{d.cta}</p></div>
          </>)}
        </>
      );
    }
    if (item.type === 'Email Newsletter') return (
      <>
        <p className="cp-section-label">Subject</p>
        <div className="cp-sub-content"><p className="cp-sub-text">{d.subject || '—'}</p></div>
        <p className="cp-section-label">Preview Text</p>
        <div className="cp-sub-content"><p className="cp-sub-text">{d.preview_text || '—'}</p></div>
        <p className="cp-section-label">Body</p>
        <div className="cp-detail-content">{d.body || 'No content'}</div>
      </>
    );
    return <div className="cp-detail-content">{JSON.stringify(d, null, 2)}</div>;
  }

  function getCopyText() {
    if (isBlog)                         return d.content || '';
    if (item.type === 'LinkedIn Post')  return d.content || '';
    if (item.type === 'Twitter Thread') return [d.opener, ...(d.tweets || []), d.cta].filter(Boolean).join('\n\n---\n\n');
    if (item.type === 'Email Newsletter') return `Subject: ${d.subject}\n\n${d.body}`;
    return JSON.stringify(d, null, 2);
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.1em', padding: '3px 10px', borderRadius: 6, background: meta.bg, color: meta.color }}>
          {meta.icon} {item.type}
        </span>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#4A4438' }}>
          {item.pillar && `· ${item.pillar}`} {item.week && `· Week ${item.week}`}
        </span>
      </div>

      <div className="cp-detail-title">{item.title}</div>

      {renderContent()}

      <div className="cp-detail-actions">
        {item.status === 'draft' && (
          <button className="cp-btn cp-btn-gold" onClick={() => onApprove(item)}>
            {isBlog ? '✓ Approve' : '✓ Approve + Add to Queue'}
          </button>
        )}
        {item.status === 'approved' && (
          <button className="cp-btn cp-btn-red" onClick={() => onUnapprove(item.id)}>
            ↩ Unapprove + Remove from Queue
          </button>
        )}
        {isBlog && item.status !== 'published' && (
          <button className="cp-btn cp-btn-green" onClick={() => onPublishToBlog(item)} disabled={publishing}>
            {publishing ? 'Sending…' : '→ Send to Blog Drafts'}
          </button>
        )}
        <button className="cp-btn cp-btn-outline" onClick={() => onCopy(getCopyText())}>
          📋 Copy Content
        </button>
      </div>
    </>
  );
}

// ── Brief Card ────────────────────────────────────────────────
function BriefCard({ brief }: { brief: any }) {
  const [expanded, setExpanded] = useState(false);
  const d           = brief.brief_data || {};
  const pillarColor = PILLAR_COLORS[brief.pillar] || '#7A7260';

  return (
    <div className="cp-brief-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.1em', padding: '3px 10px', borderRadius: 6, textTransform: 'uppercase' as const, background: `${pillarColor}15`, color: pillarColor, border: `1px solid ${pillarColor}25` }}>
              {brief.pillar}
            </span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#4A4438' }}>Week {brief.week_number}</span>
          </div>
          <div className="cp-brief-topic">{brief.topic}</div>
        </div>
        <button onClick={() => setExpanded(!expanded)}
          style={{ background: 'none', border: 'none', color: '#4A4438', cursor: 'pointer', fontSize: 12, padding: '4px 8px', flexShrink: 0 }}>
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
        <div style={{ marginTop: 16, borderTop: '1px solid #2E2A22', paddingTop: 14 }}>
          {([
            { label: 'Target Audience', val: d.targetAudience },
          ]).filter(r => r.val).map(row => (
            <div key={row.label} style={{ marginBottom: 12 }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#4A4438', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{row.label}</p>
              <p style={{ fontSize: 13, color: '#7A7260' }}>{row.val}</p>
            </div>
          ))}
          {d.keyMessages?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#4A4438', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Key Messages</p>
              <ul className="cp-brief-items">{d.keyMessages.map((m: string, i: number) => <li key={i}>{m}</li>)}</ul>
            </div>
          )}
          {d.hooks?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#4A4438', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Hooks</p>
              <ul className="cp-brief-items">{d.hooks.map((h: string, i: number) => <li key={i}>{h}</li>)}</ul>
            </div>
          )}
          {d.dataPoints?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#4A4438', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Data Points</p>
              <ul className="cp-brief-items">{d.dataPoints.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul>
            </div>
          )}
          {brief.research_raw && (
            <div>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#4A4438', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Raw Research</p>
              <div style={{ background: '#141210', border: '1px solid #2E2A22', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#7A7260', lineHeight: 1.7, maxHeight: 200, overflowY: 'auto' }}>
                {brief.research_raw}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
