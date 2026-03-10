'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

type Tab           = 'content' | 'briefs' | 'queue';
type ContentFilter = 'all' | 'Blog Post' | 'LinkedIn Post' | 'Twitter Thread' | 'Email Newsletter';
type StatusFilter  = 'all' | 'draft' | 'approved' | 'scheduled' | 'published';

interface CalItem {
  id:             string;
  title:          string;
  type:           string;
  pillar:         string;
  week:           number | null;
  status:         string;
  content_data:   any;
  scheduled_date: string | null;
  approved_at:    string | null;
  published_at:   string | null;
  publish_notes:  string | null;
  created_at:     string;
}

const TYPE_META: Record<string, { icon: string; color: string; bg: string }> = {
  'Blog Post':        { icon: '✍', color: '#E8A020', bg: 'rgba(232,160,32,0.10)' },
  'LinkedIn Post':    { icon: 'in', color: '#0A66C2', bg: 'rgba(10,102,194,0.10)' },
  'Twitter Thread':   { icon: '𝕏',  color: '#aaa',   bg: 'rgba(180,180,180,0.10)' },
  'Email Newsletter': { icon: '✉',  color: '#14B8A6', bg: 'rgba(20,184,166,0.10)' },
};

const PILLAR_COLOR: Record<string, string> = {
  leadership: '#E8A020', career: '#14B8A6', ai: '#8B5CF6',
  coaching: '#3B82F6',   community: '#EF4444',
};

const STATUS_COLOR: Record<string, string> = {
  draft:     '#6B7280',
  approved:  '#E8A020',
  scheduled: '#3B82F6',
  published: '#10B981',
};

function slugify(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60)  return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24)  return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminContentPage() {
  const [tab,          setTab]          = useState<Tab>('content');
  const [items,        setItems]        = useState<CalItem[]>([]);
  const [briefs,       setBriefs]       = useState<any[]>([]);
  const [queue,        setQueue]        = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [typeFilter,   setTypeFilter]   = useState<ContentFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('draft');
  const [selectedItem, setSelectedItem] = useState<CalItem | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null);
  const [runModal,     setRunModal]     = useState(false);
  const [runTopic,     setRunTopic]     = useState('');
  const [runPillar,    setRunPillar]    = useState('');
  const [runAudience,  setRunAudience]  = useState('young_professional');
  const [running,      setRunning]      = useState(false);
  // Used to switch filter AFTER patchItem state update completes
  const [pendingFilter, setPendingFilter] = useState<StatusFilter | null>(null);

  async function loadAll() {
    setLoading(true);
    const [cal, b, q] = await Promise.all([
      supabase.from('content_calendar').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('research_briefs').select('*').order('created_at', { ascending: false }).limit(30),
      supabase.from('social_queue').select('*').order('scheduled_for', { ascending: true }).limit(50),
    ]);
    setItems((cal.data ?? []) as CalItem[]);
    setBriefs(b.data ?? []);
    setQueue(q.data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []); // eslint-disable-line

  // Apply filter switch AFTER items state has updated from patchItem
  useEffect(() => {
    if (pendingFilter !== null) {
      setStatusFilter(pendingFilter);
      setPendingFilter(null);
    }
  }, [pendingFilter, items]); // eslint-disable-line

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!selectedItem) return;
      if (e.key === 'Escape') { setSelectedItem(null); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { handleApprove(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  function patchItem(id: string, patch: Partial<CalItem>) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
    setSelectedItem(prev => prev?.id === id ? { ...prev, ...patch } as CalItem : prev);
  }

  async function setStatus(id: string, status: string, extra?: Partial<CalItem>) {
    const { error } = await supabase.from('content_calendar').update({ status, ...extra }).eq('id', id);
    if (error) { showToast('Error: ' + error.message, false); return; }
    patchItem(id, { status, ...extra });
  }

  async function handleApprove() {
    if (!selectedItem || saving || selectedItem.status !== 'draft') return;
    setSaving(true);

    await setStatus(selectedItem.id, 'approved', { approved_at: new Date().toISOString() });

    // Auto-create blog draft when a Blog Post is approved
    if (selectedItem.type === 'Blog Post') {
      const d = (selectedItem.content_data || {}) as any;
      const { error } = await supabase.from('blog_posts').insert({
        title:             d.title || selectedItem.title,
        slug:              slugify(d.title || selectedItem.title),
        excerpt:           d.meta_description || d.excerpt || '',
        content:           d.content || '',
        category:          selectedItem.pillar
                             ? selectedItem.pillar[0].toUpperCase() + selectedItem.pillar.slice(1)
                             : 'General',
        author_name:       'Ascentor',
        read_time_minutes: Math.ceil(((d.content || '').split(' ').length || 400) / 200),
        is_published:      false,
        published_at:      null,
      });
      if (error) {
        showToast('Approved but blog draft failed: ' + error.message, false);
      } else {
        showToast('✓ Approved → Blog draft created. Publish from /admin/blog');
      }
    } else {
      showToast('✓ Approved — moved to Approved queue');
    }

    // Switch filter to 'approved' so the item stays visible in its new state
    // instead of disappearing from the 'draft' filter
    setPendingFilter('approved');
    setSelectedItem(null);
    setSaving(false);
  }

  async function handleSchedule(date: string) {
    if (!selectedItem || saving) return;
    setSaving(true);
    await setStatus(selectedItem.id, 'scheduled', {
      scheduled_date: date,
      approved_at: selectedItem.approved_at ?? new Date().toISOString(),
    });
    showToast('✓ Scheduled for ' + fmtDate(date));
    setPendingFilter('scheduled');
    setSelectedItem(null);
    setSaving(false);
  }

  async function handlePublishBlog(item: CalItem) {
    if (item.type !== 'Blog Post' || saving) return;
    setSaving(true);
    const d = item.content_data || {};
    const { error } = await supabase.from('blog_posts').insert({
      title:             d.title || item.title,
      slug:              slugify(d.title || item.title),
      excerpt:           d.meta_description || '',
      content:           d.content || '',
      category:          item.pillar ? item.pillar[0].toUpperCase() + item.pillar.slice(1) : 'General',
      author_name:       'Ascentor AI',
      read_time_minutes: Math.ceil(((d.content || '').split(' ').length || 800) / 200),
      is_published:      false,
      published_at:      null,
    });
    if (error) { showToast('Blog error: ' + error.message, false); setSaving(false); return; }
    await setStatus(item.id, 'published', { published_at: new Date().toISOString() });
    showToast('✓ Sent to Blog Drafts → publish from /admin/blog');
    setPendingFilter('published');
    setSelectedItem(null);
    setSaving(false);
  }

  async function handleQueueSocial(item: CalItem, scheduledFor?: string) {
    if (saving) return;
    setSaving(true);
    const d = item.content_data || {};
    let content = '';
    if (item.type === 'LinkedIn Post')    content = d.content || d.hook || item.title;
    if (item.type === 'Twitter Thread')   content = [d.opener, ...(d.tweets ?? []), d.cta].filter(Boolean).join('\n\n---\n\n');
    if (item.type === 'Email Newsletter') content = 'Subject: ' + (d.subject || item.title) + '\n\n' + (d.body || '');
    const platform = item.type === 'LinkedIn Post' ? 'linkedin' : item.type === 'Twitter Thread' ? 'twitter' : item.type === 'Email Newsletter' ? 'email' : 'other';
    const { error } = await supabase.from('social_queue').insert({
      platform, content, pillar: item.pillar,
      scheduled_for: scheduledFor ?? item.scheduled_date ?? null,
      status: 'pending', content_calendar_id: item.id,
    });
    if (error) { showToast('Queue error: ' + error.message, false); setSaving(false); return; }
    await setStatus(item.id, 'published', { published_at: new Date().toISOString() });
    showToast('✓ Added to social queue');
    setPendingFilter('published');
    setSelectedItem(null);
    setSaving(false);
  }

  async function handleSaveNotes(id: string, notes: string) {
    const { error } = await supabase.from('content_calendar').update({ publish_notes: notes }).eq('id', id);
    if (!error) patchItem(id, { publish_notes: notes });
  }

  async function triggerResearcher() {
    setRunning(true);
    try {
      const payload: any = { audience: runAudience };
      if (runTopic.trim()) payload.topic = runTopic.trim();
      if (runPillar)        payload.pillar = runPillar;
      const res = await fetch('/api/admin/agents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: '1', payload }) });
      const data = await res.json();
      if (data.success) { showToast('Researcher running — ID: ' + (data.runId || '').slice(0, 8) + '…'); setRunModal(false); setRunTopic(''); setRunPillar(''); setRunAudience('young_professional'); }
      else showToast('Error: ' + data.error, false);
    } catch (e: any) { showToast('Error: ' + e.message, false); }
    setRunning(false);
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    showToast('Copied');
  }

  const counts = {
    draft:     items.filter(i => i.status === 'draft').length,
    approved:  items.filter(i => i.status === 'approved').length,
    scheduled: items.filter(i => i.status === 'scheduled').length,
    published: items.filter(i => i.status === 'published').length,
  };

  const filtered = items.filter(it => {
    if (typeFilter !== 'all' && it.type !== typeFilter) return false;
    if (statusFilter !== 'all' && it.status !== statusFilter) return false;
    return true;
  });

  return (
    <>
      <style>{CSS}</style>
      <div className="cp-wrap">
        <div className="cp-header">
          <div>
            <h1 className="cp-title">Content <em>Pipeline</em></h1>
            <p className="cp-subtitle">Review · Approve · Schedule · Publish</p>
          </div>
          <div className="cp-topbtns">
            <button className="cp-runbtn" onClick={() => setRunModal(true)}>▶ Run Researcher</button>
            <button className="cp-refbtn" onClick={loadAll}>↻ Refresh</button>
          </div>
        </div>

        <div className="cp-stats">
          {[
            { num: counts.draft,     lbl: 'Needs Review', color: counts.draft > 0 ? '#E8A020' : undefined },
            { num: counts.approved,  lbl: 'Approved',     color: '#E8A020' },
            { num: counts.scheduled, lbl: 'Scheduled',    color: '#3B82F6' },
            { num: counts.published, lbl: 'Published',    color: '#10B981' },
            { num: briefs.length,    lbl: 'Briefs' },
            { num: queue.length,     lbl: 'In Queue' },
          ].map(s => (
            <div key={s.lbl} className="cp-stat">
              <div className="cp-stat-num" style={{ color: s.color ?? 'var(--admin-text)' }}>{s.num}</div>
              <div className="cp-stat-lbl">{s.lbl}</div>
            </div>
          ))}
        </div>

        <div className="cp-tabs">
          {(['content', 'briefs', 'queue'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={"cp-tab " + (tab === t ? 'on' : 'off')}>
              {t === 'content' ? ('Content' + (counts.draft > 0 ? ' (' + counts.draft + ')' : '')) : t === 'briefs' ? 'Research' : 'Social Queue'}
            </button>
          ))}
        </div>

        {loading && <div className="cp-loading">Loading pipeline…</div>}

        {!loading && tab === 'content' && (
          <>
            <div className="cp-filters">
              {(['all', 'Blog Post', 'LinkedIn Post', 'Twitter Thread', 'Email Newsletter'] as ContentFilter[]).map(f => (
                <button key={f} onClick={() => setTypeFilter(f)} className={"cp-fbtn " + (typeFilter === f ? 'on' : '')}>
                  {f === 'all' ? 'All Types' : f}
                </button>
              ))}
              <div className="cp-fsep" />
              {(['all', 'draft', 'approved', 'scheduled', 'published'] as StatusFilter[]).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} className={"cp-fbtn " + (statusFilter === s ? 'on' : '')}>
                  {s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)}
                  {s === 'draft' && counts.draft > 0 && ' (' + counts.draft + ')'}
                  {s === 'scheduled' && counts.scheduled > 0 && ' (' + counts.scheduled + ')'}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="cp-empty"><p className="cp-empty-text">No content matches these filters</p></div>
            ) : (
              <div className="cp-grid">
                <div className="cp-list">
                  {filtered.map(item => {
                    const meta = TYPE_META[item.type] ?? TYPE_META['Blog Post'];
                    const sc   = STATUS_COLOR[item.status] ?? '#6B7280';
                    const pc   = PILLAR_COLOR[item.pillar]  ?? '#6B7280';
                    return (
                      <div key={item.id} className={"cp-item " + (selectedItem?.id === item.id ? 'sel' : '')} onClick={() => setSelectedItem(item)}>
                        <div className="cp-item-row1">
                          <span className="cp-type-pill" style={{ background: meta.bg, color: meta.color }}>{meta.icon} {item.type}</span>
                          <span className="cp-dot" style={{ background: pc }} title={item.pillar} />
                          {item.scheduled_date && <span className="cp-muted" style={{ color: '#3B82F6' }}>📅 {fmtDate(item.scheduled_date)}</span>}
                        </div>
                        <div className="cp-item-title">{item.title}</div>
                        <div className="cp-item-meta">
                          <span className="cp-dot" style={{ background: sc }} />
                          <span className="cp-muted" style={{ color: sc }}>{item.status}</span>
                          {item.week ? <span className="cp-muted">Wk {item.week}</span> : null}
                          <span className="cp-muted">{timeAgo(item.created_at)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="cp-detail">
                  {!selectedItem ? (
                    <div className="cp-empty-panel">
                      <p className="cp-empty-msg">← Select an item to review</p>
                      <p className="cp-muted" style={{ fontSize: 9 }}>{counts.draft > 0 ? counts.draft + ' draft' + (counts.draft > 1 ? 's' : '') + ' need review' : 'All caught up'}</p>
                    </div>
                  ) : (
                    <DetailPanel
                      key={selectedItem.id}
                      item={selectedItem}
                      saving={saving}
                      onApprove={handleApprove}
                      onSchedule={handleSchedule}
                      onPublishBlog={handlePublishBlog}
                      onQueueSocial={handleQueueSocial}
                      onReject={(id) => { setStatus(id, 'draft'); setPendingFilter('draft'); setSelectedItem(null); }}
                      onCopy={copyText}
                      onSaveNotes={handleSaveNotes}
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {!loading && tab === 'briefs' && (
          <div>
            {briefs.length === 0
              ? <div className="cp-empty"><p className="cp-empty-text">No research briefs yet — run the Researcher agent</p></div>
              : briefs.map(b => <BriefCard key={b.id} brief={b} />)}
          </div>
        )}

        {!loading && tab === 'queue' && (
          <div>
            {queue.length === 0
              ? <div className="cp-empty"><p className="cp-empty-text">Queue is empty — approve social posts to push them here</p></div>
              : queue.map(post => (
                <div key={post.id} className="cp-qitem">
                  <div className="cp-qtime">
                    {post.scheduled_for ? new Date(post.scheduled_for).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Unscheduled'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span className="cp-muted">{(post.platform || '').toUpperCase()}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, padding: '2px 8px', borderRadius: 4, background: post.status === 'posted' ? 'rgba(16,185,129,0.1)' : 'rgba(232,160,32,0.08)', color: post.status === 'posted' ? '#10B981' : '#E8A020' }}>{post.status}</span>
                    </div>
                    <div className="cp-qtext">{(post.content || '').substring(0, 220)}{(post.content || '').length > 220 ? '…' : ''}</div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {runModal && (
        <div className="cp-backdrop" onClick={(e: any) => e.target === e.currentTarget && setRunModal(false)}>
          <div className="cp-modal">
            <div className="cp-modal-title">Run Researcher</div>
            <p className="cp-modal-sub">Triggers the content researcher + writer pipeline immediately</p>
            <div className="cp-field">
              <label className="cp-label">Audience</label>
              <select className="cp-select" value={runAudience} onChange={e => setRunAudience(e.target.value)}>
                <option value="young_professional">Young Professional (21–28)</option>
                <option value="mid_career">Mid-Career (29–38)</option>
                <option value="executive">Executive / Senior (39–50)</option>
                <option value="general">General</option>
              </select>
            </div>
            <div className="cp-field">
              <label className="cp-label">Topic (optional)</label>
              <input className="cp-input" placeholder="e.g. Salary negotiations in Lagos" value={runTopic} onChange={e => setRunTopic(e.target.value)} />
            </div>
            <div className="cp-field">
              <label className="cp-label">Pillar (optional)</label>
              <select className="cp-select" value={runPillar} onChange={e => setRunPillar(e.target.value)}>
                <option value="">Auto</option>
                {['leadership','career','ai','coaching','community'].map(p => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div className="cp-modal-btns">
              <button className="cp-btn-cancel" onClick={() => setRunModal(false)}>Cancel</button>
              <button className="cp-btn-run" onClick={triggerResearcher} disabled={running}>{running ? 'Triggering…' : '▶ Run Now'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={"cp-toast " + (toast.ok ? 'ok' : 'err')}>{toast.msg}</div>}
    </>
  );
}

function DetailPanel({ item, saving, onApprove, onSchedule, onPublishBlog, onQueueSocial, onReject, onCopy, onSaveNotes }: {
  item: CalItem; saving: boolean;
  onApprove: () => void;
  onSchedule: (date: string) => void;
  onPublishBlog: (item: CalItem) => void;
  onQueueSocial: (item: CalItem, scheduledFor?: string) => void;
  onReject: (id: string) => void;
  onCopy: (text: string) => void;
  onSaveNotes: (id: string, notes: string) => void;
}) {
  const [schedDate, setSchedDate] = useState(item.scheduled_date ?? '');
  const [notes, setNotes]         = useState(item.publish_notes ?? '');
  const d = item.content_data ?? {};
  const meta     = TYPE_META[item.type] ?? TYPE_META['Blog Post'];
  const sc       = STATUS_COLOR[item.status] ?? '#6B7280';
  const pc       = PILLAR_COLOR[item.pillar]  ?? '#6B7280';
  const isBlog   = item.type === 'Blog Post';
  const isDraft  = item.status === 'draft';
  const isApprov = item.status === 'approved';
  const isSchd   = item.status === 'scheduled';
  const isDone   = item.status === 'published';

  function getCopyText() {
    if (isBlog)                             return d.content || '';
    if (item.type === 'LinkedIn Post')      return d.content || '';
    if (item.type === 'Twitter Thread')     return [d.opener, ...(d.tweets ?? []), d.cta].filter(Boolean).join('\n\n---\n\n');
    if (item.type === 'Email Newsletter')   return 'Subject: ' + (d.subject || '') + '\n\n' + (d.body || '');
    return JSON.stringify(d, null, 2);
  }

  return (
    <>
      <div className="cp-detail-head">
        <div className="cp-d-type">
          <span className="cp-type-pill" style={{ background: meta.bg, color: meta.color }}>{meta.icon} {item.type}</span>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: pc, display: 'inline-block' }} />
          <span className="cp-muted">{item.pillar}{item.week ? ' · Wk ' + item.week : ''}</span>
          <span className="cp-status-badge" style={{ background: sc + '18', color: sc, border: '1px solid ' + sc + '30', marginLeft: 'auto' }}>● {item.status}</span>
        </div>
        <div className="cp-d-title">{item.title}</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span className="cp-muted">Created {timeAgo(item.created_at)}</span>
          {item.approved_at && <span className="cp-muted" style={{ color: '#E8A020' }}>Approved {timeAgo(item.approved_at)}</span>}
          {item.scheduled_date && <span className="cp-muted" style={{ color: '#3B82F6' }}>Scheduled {fmtDate(item.scheduled_date)}</span>}
          {item.published_at   && <span className="cp-muted" style={{ color: '#10B981' }}>Published {timeAgo(item.published_at)}</span>}
        </div>
      </div>

      <div className="cp-detail-body">
        <ContentPreview item={item} d={d} />
      </div>

      <div className="cp-detail-foot">
        <div className="cp-actions">

          {isDraft && (
            <>
              <button className="cp-btn-approve" onClick={onApprove} disabled={saving}>
                {saving ? 'Approving…' : '✓ Approve Content'}
              </button>
              <p className="cp-kbd"><kbd>⌘</kbd><kbd>↵</kbd> to approve</p>
            </>
          )}

          {(isApprov || isSchd) && (
            <>
              <div className="cp-schedule-row">
                <input type="date" className="cp-date-input" value={schedDate} min={new Date().toISOString().split('T')[0]} onChange={e => setSchedDate(e.target.value)} />
                <button className="cp-btn-sched" disabled={!schedDate || saving} onClick={() => onSchedule(schedDate)}>
                  {saving ? '…' : isSchd ? '↻ Reschedule' : '📅 Schedule'}
                </button>
              </div>
              {isSchd && item.scheduled_date && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#3B82F6', letterSpacing: '0.06em' }}>
                  📅 Scheduled for {fmtDate(item.scheduled_date)}
                </div>
              )}
              <div className="cp-divider" />
            </>
          )}

          {!isDraft && !isDone && (
            <div className="cp-action-row">
              {isBlog ? (
                <a href="/admin/blog" className="cp-btn-pub cp-btn-green" style={{ textDecoration: 'none', textAlign: 'center' }}>✍ View in Blog Admin</a>
              ) : (
                <button className="cp-btn-pub cp-btn-green" onClick={() => onQueueSocial(item, schedDate || undefined)} disabled={saving}>↑ Push to Social Queue</button>
              )}
              <button className="cp-btn-pub cp-btn-outline" onClick={() => onCopy(getCopyText())} style={{ flex: '0 0 auto', padding: '10px 14px' }}>⎘ Copy</button>
            </div>
          )}

          {isDone && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#10B981', letterSpacing: '0.08em' }}>
                ✓ Published {item.published_at ? fmtDate(item.published_at) : ''}
              </p>
            </div>
          )}

          {!isDraft && !isDone && (
            <button className="cp-btn-pub cp-btn-outline" style={{ marginTop: 2 }} onClick={() => onReject(item.id)} disabled={saving}>← Back to Draft</button>
          )}

          <div className="cp-divider" />
          <p className="cp-section-lbl" style={{ marginTop: 0 }}>Internal notes</p>
          <textarea className="cp-notes" placeholder="Add notes for this content…" value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => onSaveNotes(item.id, notes)} />
          <p className="cp-kbd">Notes auto-save on blur</p>
        </div>
      </div>
    </>
  );
}

function ContentPreview({ item, d }: { item: CalItem; d: any }) {
  if (item.type === 'Blog Post') return (
    <>
      {d.title && <><p className="cp-section-lbl">Title</p><div className="cp-sub-box"><p className="cp-sub-text">{d.title}</p></div></>}
      {d.meta_description && <><p className="cp-section-lbl">SEO Description</p><div className="cp-sub-box"><p className="cp-sub-text">{d.meta_description}</p></div></>}
      <p className="cp-section-lbl">Body</p>
      <div className="cp-content-box">{d.content || 'No content'}</div>
      {d.cta && <><p className="cp-section-lbl">CTA</p><div className="cp-sub-box"><p className="cp-sub-text">{d.cta}</p></div></>}
    </>
  );
  if (item.type === 'LinkedIn Post') return (
    <>
      {d.hook && <><p className="cp-section-lbl">Hook</p><div className="cp-sub-box"><p className="cp-sub-text">{d.hook}</p></div></>}
      <p className="cp-section-lbl">Full Post</p>
      <div className="cp-content-box">{d.content || 'No content'}</div>
    </>
  );
  if (item.type === 'Twitter Thread') {
    const tweets: string[] = d.tweets ?? [];
    return (
      <>
        <p className="cp-section-lbl">Opener</p>
        <div className="cp-sub-box"><p className="cp-sub-text">{d.opener || '—'}</p></div>
        {tweets.map((t, i) => <div key={i} className="cp-sub-box" style={{ marginBottom: 6 }}><div className="cp-sub-lbl">Tweet {i + 2}</div><p className="cp-sub-text">{t}</p></div>)}
        {d.cta && <><p className="cp-section-lbl">CTA Tweet</p><div className="cp-sub-box"><p className="cp-sub-text">{d.cta}</p></div></>}
      </>
    );
  }
  if (item.type === 'Email Newsletter') return (
    <>
      <p className="cp-section-lbl">Subject</p><div className="cp-sub-box"><p className="cp-sub-text">{d.subject || '—'}</p></div>
      {d.preview_text && <><p className="cp-section-lbl">Preview Text</p><div className="cp-sub-box"><p className="cp-sub-text">{d.preview_text}</p></div></>}
      <p className="cp-section-lbl">Body</p>
      <div className="cp-content-box">{d.body || 'No content'}</div>
    </>
  );
  return <div className="cp-content-box">{JSON.stringify(d, null, 2)}</div>;
}

function BriefCard({ brief }: { brief: any }) {
  const [expanded, setExpanded] = useState(false);
  const d = brief.brief_data ?? {};
  const pc = PILLAR_COLOR[brief.pillar] ?? '#9CA3AF';
  return (
    <div className="cp-brief">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.1em', padding: '3px 10px', borderRadius: 6, textTransform: 'uppercase' as const, background: pc + '18', color: pc, border: '1px solid ' + pc + '28' }}>{brief.pillar}</span>
            <span className="cp-muted">Week {brief.week_number}</span>
          </div>
          <div className="cp-brief-topic">{brief.topic}</div>
        </div>
        <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', color: 'var(--admin-text-faint)', cursor: 'pointer', padding: '4px 8px', fontSize: 11 }}>{expanded ? '▲' : '▼'}</button>
      </div>
      {d.angle && <p className="cp-brief-angle">{d.angle}</p>}
      {(d.seoKeywords ?? brief.trends_raw ?? []).slice(0, 5).map((k: string, i: number) => (
        <span key={i} style={{ display: 'inline-block', marginRight: 6, marginBottom: 4, padding: '2px 8px', borderRadius: 4, fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.06em', background: 'var(--admin-bg-deep, #0C0B08)', border: '1px solid var(--admin-bg-input)', color: 'var(--admin-text-faint)' }}>{k}</span>
      ))}
      {expanded && d.keyMessages?.length > 0 && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--admin-bg-input)', paddingTop: 14 }}>
          <p className="cp-muted" style={{ textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 6 }}>Key Messages</p>
          <ul className="cp-brief-items">{d.keyMessages.map((m: string, i: number) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=Cormorant+Garamond:ital,wght@0,600;1,600&display=swap');
  .cp-wrap{font-family:'Syne',sans-serif;color:var(--admin-text);min-height:100vh}
  .cp-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px;flex-wrap:wrap;gap:16px}
  .cp-title{font-family:'Cormorant Garamond',serif;font-size:32px;font-weight:600;color:#fff;line-height:1}
  .cp-title em{color:#E8A020;font-style:italic}
  .cp-subtitle{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.1em;color:var(--admin-text-faint);margin-top:6px;text-transform:uppercase}
  .cp-stats{display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap}
  .cp-stat{background:var(--admin-bg-card);border:1px solid var(--admin-bg-input);border-radius:12px;padding:14px 20px;min-width:110px}
  .cp-stat-num{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:600;line-height:1}
  .cp-stat-lbl{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--admin-text-faint);margin-top:4px}
  .cp-tabs{display:flex;gap:2px;background:var(--admin-bg-card);border:1px solid var(--admin-bg-input);border-radius:10px;padding:3px;margin-bottom:24px;width:fit-content}
  .cp-tab{padding:8px 20px;border-radius:8px;border:none;cursor:pointer;font-family:'Syne',sans-serif;font-size:12px;font-weight:600;letter-spacing:.04em;transition:all .15s}
  .cp-tab.on{background:var(--admin-bg-input);color:#E8A020}
  .cp-tab.off{background:transparent;color:var(--admin-text-faint)}
  .cp-tab.off:hover{color:var(--admin-text)}
  .cp-filters{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;align-items:center}
  .cp-fbtn{padding:5px 14px;border-radius:6px;border:1px solid var(--admin-bg-input);background:transparent;cursor:pointer;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.06em;color:var(--admin-text-faint);transition:all .15s}
  .cp-fbtn.on{background:rgba(232,160,32,.10);border-color:rgba(232,160,32,.25);color:#E8A020}
  .cp-fbtn:hover:not(.on){color:var(--admin-text);border-color:var(--admin-text-faint)}
  .cp-fsep{width:1px;height:20px;background:var(--admin-bg-input);margin:0 4px}
  .cp-grid{display:grid;grid-template-columns:1fr 420px;gap:20px;align-items:start}
  @media(max-width:1100px){.cp-grid{grid-template-columns:1fr}}
  .cp-list{display:flex;flex-direction:column;gap:6px}
  .cp-item{background:var(--admin-bg-card);border:1px solid var(--admin-bg-input);border-radius:12px;padding:14px 16px;cursor:pointer;transition:border-color .15s}
  .cp-item:hover{border-color:var(--admin-text-faint)}
  .cp-item.sel{border-color:rgba(232,160,32,.4);background:var(--admin-bg-card-hover,#1E1C17)}
  .cp-item-row1{display:flex;align-items:center;gap:8px;margin-bottom:7px}
  .cp-type-pill{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:5px;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.07em;font-weight:500;white-space:nowrap}
  .cp-item-title{font-size:13px;font-weight:600;color:var(--admin-text);line-height:1.4}
  .cp-item-meta{display:flex;align-items:center;gap:10px;margin-top:7px}
  .cp-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
  .cp-muted{font-family:'DM Mono',monospace;font-size:9px;color:var(--admin-text-faint)}
  .cp-detail{background:var(--admin-bg-card);border:1px solid var(--admin-bg-input);border-radius:14px;position:sticky;top:16px;max-height:calc(100vh - 100px);overflow-y:auto;display:flex;flex-direction:column}
  .cp-detail-head{padding:20px 22px 16px;border-bottom:1px solid var(--admin-bg-input)}
  .cp-detail-body{padding:18px 22px;flex:1;overflow-y:auto}
  .cp-detail-foot{padding:16px 22px;border-top:1px solid var(--admin-bg-input);background:var(--admin-bg-card);border-radius:0 0 14px 14px}
  .cp-empty-panel{display:flex;flex-direction:column;align-items:center;justify-content:center;height:320px;gap:10px}
  .cp-empty-msg{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.08em;color:var(--admin-text-faint)}
  .cp-d-type{display:flex;align-items:center;gap:8px;margin-bottom:10px}
  .cp-d-title{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:600;color:#fff;line-height:1.3;margin-bottom:14px}
  .cp-status-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase}
  .cp-section-lbl{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--admin-text-faint);margin-bottom:6px;margin-top:14px}
  .cp-content-box{background:var(--admin-bg-deep,#0C0B08);border:1px solid var(--admin-bg-input);border-radius:8px;padding:12px 14px;font-size:12px;color:var(--admin-text-dim,#7A7260);line-height:1.75;white-space:pre-wrap;max-height:280px;overflow-y:auto}
  .cp-sub-box{background:var(--admin-bg-deep,#0C0B08);border:1px solid var(--admin-bg-input);border-radius:8px;padding:10px 14px;margin-bottom:8px}
  .cp-sub-lbl{font-family:'DM Mono',monospace;font-size:9px;color:#E8A020;letter-spacing:.08em;margin-bottom:5px}
  .cp-sub-text{font-size:12px;color:var(--admin-text-dim,#7A7260);line-height:1.7;white-space:pre-wrap}
  .cp-actions{display:flex;flex-direction:column;gap:8px}
  .cp-action-row{display:flex;gap:8px}
  .cp-btn-approve{flex:1;padding:13px;border-radius:10px;border:none;background:#E8A020;color:#0C0B08;font-family:'Syne',sans-serif;font-size:13px;font-weight:800;letter-spacing:.03em;cursor:pointer;transition:background .15s;display:flex;align-items:center;justify-content:center;gap:6px}
  .cp-btn-approve:hover:not(:disabled){background:#F5C55A}
  .cp-btn-approve:disabled{opacity:.4;cursor:not-allowed}
  .cp-schedule-row{display:flex;gap:8px;align-items:center}
  .cp-date-input{flex:1;padding:9px 12px;border-radius:8px;border:1px solid var(--admin-bg-input);background:var(--admin-bg-deep,#0C0B08);color:var(--admin-text);font-family:'DM Mono',monospace;font-size:12px;letter-spacing:.04em;outline:none}
  .cp-date-input:focus{border-color:rgba(59,130,246,.5)}
  .cp-btn-sched{padding:9px 16px;border-radius:8px;border:1px solid rgba(59,130,246,.2);background:rgba(59,130,246,.12);color:#3B82F6;font-family:'Syne',sans-serif;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all .15s}
  .cp-btn-sched:hover:not(:disabled){background:rgba(59,130,246,.2)}
  .cp-btn-sched:disabled{opacity:.4;cursor:not-allowed}
  .cp-btn-pub{flex:1;padding:10px 14px;border-radius:8px;border:none;font-family:'Syne',sans-serif;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:6px}
  .cp-btn-green{background:rgba(16,185,129,.12);color:#10B981;border:1px solid rgba(16,185,129,.2)}
  .cp-btn-green:hover:not(:disabled){background:rgba(16,185,129,.22)}
  .cp-btn-outline{background:transparent;color:var(--admin-text-muted,#9CA3AF);border:1px solid var(--admin-bg-input)}
  .cp-btn-outline:hover:not(:disabled){color:var(--admin-text);border-color:var(--admin-text-faint)}
  .cp-btn-pub:disabled{opacity:.4;cursor:not-allowed}
  .cp-notes{width:100%;padding:9px 12px;border-radius:8px;border:1px solid var(--admin-bg-input);background:var(--admin-bg-deep,#0C0B08);color:var(--admin-text);font-family:'Syne',sans-serif;font-size:12px;line-height:1.6;resize:vertical;outline:none;min-height:64px;box-sizing:border-box}
  .cp-notes:focus{border-color:rgba(232,160,32,.3)}
  .cp-kbd{font-family:'DM Mono',monospace;font-size:9px;color:var(--admin-text-faint);letter-spacing:.06em;text-align:right}
  .cp-kbd kbd{background:var(--admin-bg-input);border:1px solid var(--admin-text-faint);border-radius:3px;padding:1px 4px;font-size:9px}
  .cp-divider{height:1px;background:var(--admin-bg-input);margin:12px 0}
  .cp-topbtns{display:flex;gap:8px}
  .cp-runbtn{padding:8px 18px;border-radius:8px;border:1px solid rgba(232,160,32,.35);background:rgba(232,160,32,.08);color:#E8A020;font-family:'Syne',sans-serif;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s}
  .cp-runbtn:hover{background:rgba(232,160,32,.16);border-color:rgba(232,160,32,.6)}
  .cp-refbtn{padding:8px 16px;border-radius:8px;border:1px solid var(--admin-bg-input);background:transparent;color:var(--admin-text-faint);font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.08em;cursor:pointer;transition:all .15s}
  .cp-refbtn:hover{color:#E8A020;border-color:rgba(232,160,32,.3)}
  .cp-qitem{background:var(--admin-bg-card);border:1px solid var(--admin-bg-input);border-radius:10px;padding:14px 16px;display:flex;gap:14px;margin-bottom:8px}
  .cp-qtime{font-family:'DM Mono',monospace;font-size:10px;color:var(--admin-text-faint);white-space:nowrap;min-width:80px;padding-top:2px}
  .cp-qtext{flex:1;font-size:13px;color:var(--admin-text-dim,#7A7260);line-height:1.6}
  .cp-brief{background:var(--admin-bg-card);border:1px solid var(--admin-bg-input);border-radius:14px;padding:20px 22px;margin-bottom:12px}
  .cp-brief-topic{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:600;color:#fff;line-height:1.25;margin-bottom:8px}
  .cp-brief-angle{font-size:13px;color:var(--admin-text-muted,#9CA3AF);line-height:1.6;margin-bottom:12px}
  .cp-brief-items{list-style:none;display:flex;flex-direction:column;gap:4px}
  .cp-brief-items li{font-size:12px;color:var(--admin-text-muted,#9CA3AF);padding-left:14px;position:relative;line-height:1.5}
  .cp-brief-items li::before{content:'→';position:absolute;left:0;color:var(--admin-text-faint);font-size:10px}
  .cp-empty{text-align:center;padding:60px 24px}
  .cp-empty-text{font-family:'DM Mono',monospace;font-size:11px;color:var(--admin-text-faint);letter-spacing:.08em}
  .cp-loading{padding:40px 0;text-align:center;font-family:'DM Mono',monospace;font-size:10px;color:var(--admin-text-faint);letter-spacing:.1em}
  .cp-toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:8px;z-index:1000;font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.08em;white-space:nowrap;pointer-events:none}
  .cp-toast.ok{background:var(--admin-bg-card,#1E1A12);border:1px solid rgba(232,160,32,.3);color:#E8A020}
  .cp-toast.err{background:var(--admin-bg-card,#1E1A12);border:1px solid rgba(239,68,68,.3);color:#EF4444}
  .cp-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px}
  .cp-modal{background:var(--admin-bg-card);border:1px solid var(--admin-bg-input);border-radius:16px;padding:28px;width:100%;max-width:440px}
  .cp-modal-title{font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:600;color:#fff;margin-bottom:4px}
  .cp-modal-sub{font-family:'DM Mono',monospace;font-size:10px;color:var(--admin-text-faint);letter-spacing:.08em;margin-bottom:22px}
  .cp-field{margin-bottom:16px}
  .cp-label{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--admin-text-faint);margin-bottom:6px;display:block}
  .cp-input{width:100%;padding:10px 14px;border-radius:8px;border:1px solid var(--admin-bg-input);background:var(--admin-bg-deep,#0C0B08);color:var(--admin-text);font-family:'Syne',sans-serif;font-size:13px;outline:none;box-sizing:border-box}
  .cp-input:focus{border-color:rgba(232,160,32,.4)}
  .cp-select{width:100%;padding:10px 14px;border-radius:8px;border:1px solid var(--admin-bg-input);background:var(--admin-bg-deep,#0C0B08);color:var(--admin-text);font-family:'Syne',sans-serif;font-size:13px;outline:none;cursor:pointer}
  .cp-modal-btns{display:flex;gap:10px;margin-top:22px}
  .cp-btn-cancel{flex:1;padding:10px;border-radius:8px;border:1px solid var(--admin-bg-input);background:transparent;color:var(--admin-text-muted,#9CA3AF);font-family:'Syne',sans-serif;font-size:12px;font-weight:600;cursor:pointer}
  .cp-btn-run{flex:2;padding:10px;border-radius:8px;border:none;background:#E8A020;color:#0C0B08;font-family:'Syne',sans-serif;font-size:12px;font-weight:700;cursor:pointer;transition:background .15s}
  .cp-btn-run:hover:not(:disabled){background:#F5C55A}
  .cp-btn-run:disabled{opacity:.5;cursor:not-allowed}
`;
