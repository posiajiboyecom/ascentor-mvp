'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

type Tab           = 'content' | 'briefs' | 'queue' | 'personal' | 'carousel';
type ContentFilter = 'all' | 'Blog Post' | 'LinkedIn Post' | 'Twitter Thread' | 'Twitter Single' | 'Email Newsletter' | 'Personal Brand';
type StatusFilter  = 'all' | 'draft' | 'approved' | 'scheduled' | 'published';

interface CalItem {
  id:             string;
  title:          string;
  type:           string;
  platform:       string | null;
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
  'Twitter Single':   { icon: '𝕏',  color: '#1D9BF0', bg: 'rgba(29,155,240,0.10)' },
  'Personal Brand':   { icon: '⚡', color: '#E8A020', bg: 'rgba(232,160,32,0.10)'  },
};

const PILLAR_COLOR: Record<string, string> = {
  leadership: '#E8A020', career: '#14B8A6', ai: '#8B5CF6',
  coaching: '#3B82F6',   community: '#EF4444',
  // Personal brand pillars
  personal_brand:            '#E8A020',
  penetration_testing:       '#EF4444',
  offensive_security:        '#EF4444',
  vulnerability_research:    '#F97316',
  red_team:                  '#DC2626',
  exploit_technique:         '#F97316',
  governance_risk_compliance:'#6366F1',
  security_frameworks:       '#6366F1',
  compliance_regulation:     '#8B5CF6',
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
  // ── Personal Brand Mode ─────────────────────────────────────
  const [pbModal,      setPbModal]      = useState(false);
  const [pbTopic,      setPbTopic]      = useState('');
  const [pbPillar,     setPbPillar]     = useState('authority');
  const [pbPlatform,   setPbPlatform]   = useState('both');
  const [pbIntent,     setPbIntent]     = useState('authority');
  const [pbPosts,      setPbPosts]      = useState<any[]>([]);
  const [pbLoading,    setPbLoading]    = useState(false);
  const [pbCopied,     setPbCopied]     = useState<string | null>(null);
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

  // pendingFilter: used only for schedule/publish transitions where panel closes
  useEffect(() => {
    if (pendingFilter !== null) {
      setStatusFilter(pendingFilter);
      setPendingFilter(null);
    }
  }, [pendingFilter]); // eslint-disable-line

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
    // Update both in the same render cycle to prevent flicker between states
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
    setSelectedItem(prev => {
      if (!prev || prev.id !== id) return prev;
      return { ...prev, ...patch } as CalItem;
    });
  }

  async function setStatus(id: string, status: string, extra?: Partial<CalItem>) {
    // Patch locally first for instant UI response
    patchItem(id, { status, ...extra });
    const { error } = await supabase.from('content_calendar').update({ status, ...extra }).eq('id', id);
    if (error) {
      showToast('Error: ' + error.message, false);
      // No revert here — minor operations, not worth complexity
    }
  }

  async function handleApprove() {
    if (!selectedItem || saving || selectedItem.status !== 'draft') return;
    setSaving(true);

    // Patch local state FIRST so the UI updates before filter switches
    const approvedAt = new Date().toISOString();
    patchItem(selectedItem.id, { status: 'approved', approved_at: approvedAt });

    // Then write to DB (non-blocking for UI)
    const { error: statusError } = await supabase
      .from('content_calendar')
      .update({ status: 'approved', approved_at: approvedAt })
      .eq('id', selectedItem.id);
    if (statusError) {
      showToast('Error: ' + statusError.message, false);
      // Revert local state
      patchItem(selectedItem.id, { status: 'draft', approved_at: null });
      setSaving(false);
      return;
    }

    // Auto-create blog draft when a Blog Post is approved
    if (selectedItem.type === 'Blog Post') {
      const d = (selectedItem.content_data || {}) as any;
      const baseTitle = d.title || selectedItem.title;
      const baseSlug  = slugify(baseTitle);

      // Check if this blog post was already created (re-approval of same item)
      const { data: existing } = await supabase
        .from('blog_posts')
        .select('id')
        .eq('slug', baseSlug)
        .maybeSingle();

      if (existing) {
        // Already exists — just navigate to blog admin, don't duplicate
        showToast('✓ Approved — blog draft already exists. View in /admin/blog');
      } else {
        const { error } = await supabase.from('blog_posts').insert({
          title:             baseTitle,
          slug:              baseSlug,
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
          // Slug collision fallback — append short unique id
          if (error.code === '23505') {
            const uniqueSlug = baseSlug + '-' + selectedItem.id.slice(0, 6);
            await supabase.from('blog_posts').insert({
              title:             baseTitle,
              slug:              uniqueSlug,
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
            showToast('✓ Approved → Blog draft created. Publish from /admin/blog');
          } else {
            showToast('Approved but blog draft failed: ' + error.message, false);
          }
        } else {
          showToast('✓ Approved → Blog draft created. Publish from /admin/blog');
        }
      }
    } else if (selectedItem.type === 'Email Newsletter') {
      // Queue newsletter — goes to /admin/newsletter for final send
      const d = (selectedItem.content_data || {}) as any;
      const { error } = await supabase.from('newsletter_queue').insert({
        subject:              d.subject || selectedItem.title,
        preview_text:         d.preview_text || '',
        body:                 d.body || '',
        pillar:               selectedItem.pillar,
        content_calendar_id:  selectedItem.id,
        status:               'queued',
        queued_at:            new Date().toISOString(),
      });
      if (error) {
        showToast('Approved but newsletter queue failed: ' + error.message, false);
      } else {
        showToast('✓ Approved → Newsletter queued. Send from /admin/newsletter');
      }
    } else {
      showToast('✓ Approved — moved to Approved queue');
    }

    // Switch filter immediately — patchItem already updated both items[] and selectedItem
    // so the panel stays open and shows the new approved state with send buttons
    setStatusFilter('approved');
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

  async function handleQueueSocial(item: CalItem, scheduledFor?: string, imageUrl?: string) {
    if (saving) return;
    setSaving(true);
    const d = item.content_data || {};
    let postContent = '';
    if (item.type === 'LinkedIn Post')    postContent = d.content || d.hook || item.title;
    if (item.type === 'Twitter Thread')   postContent = [d.opener, ...(d.tweets ?? []), d.cta].filter(Boolean).join('\n\n---\n\n');
    if (item.type === 'Email Newsletter') postContent = 'Subject: ' + (d.subject || item.title) + '\n\n' + (d.body || '');
    if (!postContent) postContent = d.caption || d.content || item.title;

    const platform =
      item.type === 'LinkedIn Post'     ? 'LinkedIn' :
      item.type === 'Twitter Thread'    ? 'Twitter/X' :
      item.type === 'Email Newsletter'  ? 'Email' :
      (item.type?.startsWith('Instagram') || item.platform === 'Instagram') ? 'Instagram' :
      item.platform || 'other';

    const { data: queueRow, error } = await supabase.from('social_queue').insert({
      platform,
      content: postContent,
      pillar: item.pillar,
      image_url: imageUrl || null,
      scheduled_for: scheduledFor ?? item.scheduled_date ?? null,
      status: 'pending',
      content_calendar_id: item.id,
    }).select().single();
    if (error) { showToast('Queue error: ' + error.message, false); setSaving(false); return; }

    // Immediately send to Buffer
    if (queueRow) {
      try {
        const bufRes = await fetch('/api/admin/buffer-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queueId: queueRow.id, imageUrl: imageUrl || null }),
        });
        const bufData = await bufRes.json();
        if (!bufRes.ok) {
          showToast('Queued locally but Buffer error: ' + (bufData.error || 'unknown'), false);
        } else {
          showToast('✓ Sent to Buffer for ' + platform);
        }
      } catch (bufErr: any) {
        showToast('Queued locally but Buffer unreachable: ' + bufErr.message, false);
      }
    }

    await setStatus(item.id, 'published', { published_at: new Date().toISOString() });
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
    // Always show the currently selected item so panel never loses its content
    if (selectedItem && it.id === selectedItem.id) return true;
    if (typeFilter === 'Personal Brand') {
      if (!it.content_data?.isPersonalBrand) return false;
    } else if (typeFilter !== 'all' && it.type !== typeFilter) return false;
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
          {(['content', 'briefs', 'queue', 'personal', 'carousel'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={"cp-tab " + (tab === t ? 'on' : 'off')}>
              {t === 'content' ? ('Content' + (counts.draft > 0 ? ' (' + counts.draft + ')' : '')) : t === 'briefs' ? 'Research' : t === 'queue' ? 'Social Queue' : t === 'personal' ? '⚡ Personal Brand' : '🎠 Carousel'}
            </button>
          ))}
        </div>

        {loading && <div className="cp-loading">Loading pipeline…</div>}

        {!loading && tab === 'content' && (
          <>
            <div className="cp-filters">
              {(['all', 'Blog Post', 'LinkedIn Post', 'Twitter Thread', 'Twitter Single', 'Email Newsletter', 'Personal Brand'] as ContentFilter[]).map(f => (
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
          <SocialQueuePanel queue={queue} showToast={showToast} onRefresh={loadAll} />
        )}

        {!loading && tab === 'personal' && (
          <PersonalBrandPanel
            posts={pbPosts}
            loading={pbLoading}
            copied={pbCopied}
            onGenerate={() => setPbModal(true)}
            onCopy={(text: string, id: string) => {
              navigator.clipboard.writeText(text);
              setPbCopied(id);
              setTimeout(() => setPbCopied(null), 2000);
            }}
            onSaveToQueue={async (post: any) => {
              // Default to 24 hours from now — user can reschedule in the Social Queue panel
              const defaultSchedule = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
              const { error } = await supabase.from('social_queue').insert({
                platform: post.platform === 'linkedin' ? 'LinkedIn' : 'Twitter/X',
                content: post.content,
                pillar: 'personal',
                status: 'queued',
                scheduled_for: defaultSchedule,
              });
              if (!error) showToast('Saved to Social Queue — scheduled for tomorrow');
              else showToast('Error: ' + error.message, false);
            }}
          />
        )}

        {!loading && tab === 'carousel' && (
          <CarouselTab showToast={showToast} />
        )}
      </div>

      {pbModal && (
        <div className="cp-backdrop" onClick={(e: any) => e.target === e.currentTarget && setPbModal(false)}>
          <div className="cp-modal" style={{ maxWidth: 520 }}>
            <div className="cp-modal-title">⚡ Generate Personal Brand Post</div>
            <p className="cp-modal-sub">Cybersecurity authority · Job-seeking signal · Your voice, your expertise</p>

            <div className="cp-field">
              <label className="cp-label">Content Pillar</label>
              <select className="cp-select" value={pbPillar} onChange={e => setPbPillar(e.target.value)}>
                <option value="authority">Authority — share expertise, educate, build credibility</option>
                <option value="career">Career Signal — visibility to recruiters, job intent</option>
                <option value="insight">Hot Take / Industry Insight — cybersecurity trends, opinions</option>
                <option value="story">Story — personal experience, lessons from the field</option>
                <option value="tool">Tool / Resource — share what actually works</option>
                <option value="myth">Myth-busting — correct misconceptions in cybersecurity</option>
              </select>
            </div>

            <div className="cp-field">
              <label className="cp-label">Platform</label>
              <select className="cp-select" value={pbPlatform} onChange={e => setPbPlatform(e.target.value)}>
                <option value="both">Both — LinkedIn long-form + Twitter/X thread</option>
                <option value="linkedin">LinkedIn only</option>
                <option value="twitter">Twitter/X only</option>
              </select>
            </div>

            <div className="cp-field">
              <label className="cp-label">Topic or angle (optional)</label>
              <input className="cp-input" placeholder="e.g. Why most companies fail their first pentest, Zero Trust myths, Security+ for career starters…"
                value={pbTopic} onChange={e => setPbTopic(e.target.value)} />
            </div>

            <div className="cp-field">
              <label className="cp-label">Primary goal for this post</label>
              <select className="cp-select" value={pbIntent} onChange={e => setPbIntent(e.target.value)}>
                <option value="authority">Build authority — attract followers + make recruiters notice</option>
                <option value="apply">Support a job application — show depth before they see my CV</option>
                <option value="inbound">Get inbound — make hiring managers reach out to me</option>
                <option value="network">Build network — connect with peers and senior practitioners</option>
              </select>
            </div>

            <div className="cp-modal-btns">
              <button className="cp-btn-cancel" onClick={() => setPbModal(false)}>Cancel</button>
              <button className="cp-btn-run" disabled={pbLoading} onClick={async () => {
                setPbLoading(true);
                setPbModal(false);
                try {
                  const res = await fetch('/api/admin/personal-brand', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pillar: pbPillar, platform: pbPlatform, topic: pbTopic.trim(), intent: pbIntent }),
                  });
                  const data = await res.json();
                  if (data.posts) { setPbPosts(prev => [...data.posts, ...prev]); showToast('Posts generated'); }
                  else showToast('Error: ' + (data.error || 'unknown'), false);
                } catch(e: any) { showToast('Error: ' + e.message, false); }
                setPbLoading(false);
                setPbTopic('');
              }}>
                {pbLoading ? 'Generating…' : '⚡ Generate Posts'}
              </button>
            </div>
          </div>
        </div>
      )}

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
  onQueueSocial: (item: CalItem, scheduledFor?: string, imageUrl?: string) => void;
  onReject: (id: string) => void;
  onCopy: (text: string) => void;
  onSaveNotes: (id: string, notes: string) => void;
}) {
  const [schedDate,   setSchedDate]   = useState(item.scheduled_date ?? '');
  const [notes,       setNotes]       = useState(item.publish_notes ?? '');
  const [uploadedImg, setUploadedImg] = useState<string>('');
  const [uploading,   setUploading]   = useState(false);

  async function handleImgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'social');
    const res  = await fetch('/api/admin/upload-media', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.url) setUploadedImg(data.url);
    e.target.value = '';
    setUploading(false);
  }
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

          {isApprov && !isBlog && item.type !== 'Email Newsletter' && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(232,160,32,0.08)', border: '1px solid rgba(232,160,32,0.2)' }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#E8A020', letterSpacing: '0.06em', margin: 0 }}>
                ✓ Approved · Now: attach image (optional) → click send button → goes to Social Queue
              </p>
            </div>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {isBlog ? (
                <a href="/admin/blog" className="cp-btn-pub cp-btn-green" style={{ textDecoration: 'none', textAlign: 'center' }}>✍ View in Blog Admin</a>
              ) : item.type === 'Email Newsletter' ? (
                <a href="/admin/newsletter" className="cp-btn-pub cp-btn-green" style={{ textDecoration: 'none', textAlign: 'center' }}>✉ View in Newsletter Admin</a>
              ) : (
                <>
                  {/* Image upload for social posts */}
                  <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(232,160,32,0.05)', border: '1px solid rgba(232,160,32,0.15)' }}>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#E8A020', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 8 }}>Attach Image (optional)</p>
                    {uploadedImg ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <img src={uploadedImg} alt="Attached" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(232,160,32,0.3)' }} />
                        <button onClick={() => setUploadedImg('')} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: 10 }}>✕ Remove</button>
                      </div>
                    ) : (
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--admin-bg-input)', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--admin-text-faint)' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        {uploading ? 'Uploading…' : 'Upload image'}
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImgUpload} disabled={uploading} />
                      </label>
                    )}
                  </div>

                  {/* Per-platform send buttons */}
                  {item.type === 'LinkedIn Post' && (
                    <button className="cp-btn-pub" style={{ background: 'rgba(10,102,194,0.12)', color: '#0A66C2', border: '1px solid rgba(10,102,194,0.25)' }} onClick={() => onQueueSocial(item, schedDate || undefined, uploadedImg || undefined)} disabled={saving}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                      Send to LinkedIn
                    </button>
                  )}

                  {item.type === 'Twitter Thread' && (
                    <button className="cp-btn-pub" style={{ background: 'rgba(180,180,180,0.08)', color: '#ccc', border: '1px solid rgba(200,200,200,0.2)' }} onClick={() => onQueueSocial(item, schedDate || undefined, uploadedImg || undefined)} disabled={saving}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      Send to X / Twitter
                    </button>
                  )}

                  {(item.type?.startsWith('Instagram') || item.type?.toLowerCase().includes('instagram') || item.platform === 'Instagram' || item.platform === 'instagram') && (
                    <button className="cp-btn-pub" style={{ background: 'rgba(225,48,108,0.08)', color: '#E1306C', border: '1px solid rgba(225,48,108,0.2)' }} onClick={() => onQueueSocial(item, schedDate || undefined, uploadedImg || undefined)} disabled={saving}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                      Send to Instagram
                    </button>
                  )}

                  {/* Fallback for any other platform */}
                  {!['LinkedIn Post','Twitter Thread'].includes(item.type) && !item.type?.startsWith('Instagram') && item.platform !== 'Instagram' && item.platform !== 'instagram' && (
                    <button className="cp-btn-pub cp-btn-green" onClick={() => onQueueSocial(item, schedDate || undefined, uploadedImg || undefined)} disabled={saving}>↑ Push to Social Queue</button>
                  )}
                </>
              )}
              <button className="cp-btn-pub cp-btn-outline" onClick={() => onCopy(getCopyText())} style={{ padding: '10px 14px' }}>⎘ Copy</button>
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
  if (item.type === 'Instagram Carousel') {
    const slides: any[] = d.slides ?? [];
    return (
      <>
        {d.hook && <><p className="cp-section-lbl">Hook</p><div className="cp-sub-box"><p className="cp-sub-text">{d.hook}</p></div></>}
        {d.caption && <><p className="cp-section-lbl">Caption</p><div className="cp-content-box">{d.caption}</div></>}
        {d.hashtags?.length > 0 && (
          <><p className="cp-section-lbl">Hashtags</p>
          <div className="cp-sub-box"><p className="cp-sub-text" style={{ color: '#6B7280' }}>{d.hashtags.map((h: string) => '#' + h).join(' ')}</p></div></>
        )}
        {slides.length > 0 && (
          <>
            <p className="cp-section-lbl">Slides ({slides.filter((s: any) => s.imageUrl).length}/{slides.length} images ready)</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 8 }}>
              {slides.map((slide: any, i: number) => (
                <div key={i} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--admin-bg-input)', background: 'var(--admin-bg-deep, #0C0B08)' }}>
                  {slide.imageUrl ? (
                    <img src={slide.imageUrl} alt={`Slide ${i + 1}`} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 11, fontFamily: "'DM Mono', monospace" }}>No image</div>
                  )}
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#E8A020', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
                      {i + 1} · {slide.purpose}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-faint)', lineHeight: 1.4, marginBottom: 8 }}>{slide.text}</div>
                    {slide.imageUrl && (
                      <a
                        href={slide.imageUrl}
                        download={`carousel-slide-${i + 1}.jpg`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 5, border: '1px solid var(--admin-bg-input)', color: '#E8A020', fontFamily: "'DM Mono', monospace", fontSize: 9, textDecoration: 'none', letterSpacing: '0.06em' }}
                      >
                        ↓ Download
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {slides.some((s: any) => s.imageUrl) && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <a
                  href={d.coverImageUrl || slides.find((s: any) => s.imageUrl)?.imageUrl}
                  download="carousel-cover.jpg"
                  target="_blank"
                  rel="noreferrer"
                  style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--admin-bg-input)', color: '#E8A020', fontFamily: "'DM Mono', monospace", fontSize: 10, textDecoration: 'none', letterSpacing: '0.06em' }}
                >
                  ↓ Download Cover Slide
                </a>
                <a
                  href={`data:text/plain;charset=utf-8,${encodeURIComponent(slides.map((s: any) => s.imageUrl).filter(Boolean).join('\n'))}`}
                  download="carousel-all-urls.txt"
                  style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--admin-bg-input)', color: '#6B7280', fontFamily: "'DM Mono', monospace", fontSize: 10, textDecoration: 'none', letterSpacing: '0.06em' }}
                >
                  ↓ All Image URLs
                </a>
              </div>
            )}
          </>
        )}
      </>
    );
  }
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

// ═══════════════════════════════════════════════════════════
// SOCIAL QUEUE PANEL
// Groups posts by platform. Each post has:
//   - Image upload (attaches to that specific post)
//   - Individual Send to Buffer button
//   - Status badge
// ═══════════════════════════════════════════════════════════

const PLATFORM_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  'LinkedIn': {
    label: 'LinkedIn',
    color: '#0A66C2',
    bg: 'rgba(10,102,194,0.08)',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>,
  },
  'Twitter/X': {
    label: 'X / Twitter',
    color: '#E2E8F0',
    bg: 'rgba(226,232,240,0.06)',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
  },
  'Instagram': {
    label: 'Instagram',
    color: '#E1306C',
    bg: 'rgba(225,48,108,0.08)',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>,
  },
  'Facebook': {
    label: 'Facebook',
    color: '#1877F2',
    bg: 'rgba(24,119,242,0.08)',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>,
  },
  'Email': {
    label: 'Email / Newsletter',
    color: '#14B8A6',
    bg: 'rgba(20,184,166,0.08)',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  },
};

function SocialQueuePanel({ queue, showToast, onRefresh }: {
  queue: any[];
  showToast: (msg: string, ok?: boolean) => void;
  onRefresh: () => void;
}) {
  const [postImages, setPostImages]     = useState<Record<string, string>>({});
  const [uploading, setUploading]       = useState<string | null>(null);
  const [sending, setSending]           = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'sent'>('all');

  // Group posts by platform
  const platforms = Object.keys(PLATFORM_CONFIG);
  const otherPosts = queue.filter(p => !platforms.includes(p.platform));

  const grouped: Record<string, any[]> = {};
  platforms.forEach(p => {
    const posts = queue.filter(post =>
      post.platform === p ||
      (p === 'Twitter/X' && (post.platform === 'Twitter' || post.platform === 'X'))
    );
    if (posts.length > 0) grouped[p] = posts;
  });
  if (otherPosts.length > 0) grouped['Other'] = otherPosts;

  const filtered = (posts: any[]) => {
    if (filterStatus === 'pending') return posts.filter(p => !p.buffer_update_id && p.status !== 'posted');
    if (filterStatus === 'sent')    return posts.filter(p => p.buffer_update_id || p.status === 'posted' || p.status === 'scheduled_buffer');
    return posts;
  };

  async function uploadImage(postId: string, file: File) {
    setUploading(postId);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'social');
    const res  = await fetch('/api/admin/upload-media', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.url) {
      setPostImages(prev => ({ ...prev, [postId]: data.url }));
      // Also persist the image URL to the queue row
      const { createClient } = await import('@/lib/supabase/client');
      await createClient().from('social_queue').update({ image_url: data.url }).eq('id', postId);
      showToast('Image attached');
    } else {
      showToast('Upload failed: ' + data.error, false);
    }
    setUploading(null);
  }

  async function sendToBuffer(post: any) {
    setSending(post.id);
    const imageUrl = postImages[post.id] || post.image_url;

    // If image was just attached locally, save it first
    if (postImages[post.id] && !post.image_url) {
      const { createClient } = await import('@/lib/supabase/client');
      await createClient().from('social_queue').update({ image_url: postImages[post.id] }).eq('id', post.id);
    }

    const res  = await fetch('/api/admin/buffer-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueId: post.id, imageUrl }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('✓ Sent to Buffer — post scheduled');
      onRefresh();
    } else {
      showToast('Buffer error: ' + (data.error || 'Unknown error'), false);
    }
    setSending(null);
  }

  async function removeFromQueue(postId: string) {
    const { createClient } = await import('@/lib/supabase/client');
    await createClient().from('social_queue').delete().eq('id', postId);
    showToast('Removed from queue');
    onRefresh();
  }

  const totalPending = queue.filter(p => !p.buffer_update_id && p.status !== 'posted').length;
  const totalSent    = queue.filter(p => p.buffer_update_id || p.status === 'posted' || p.status === 'scheduled_buffer').length;

  return (
    <div>
      {/* Header + filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: 'var(--admin-text-faint)', textTransform: 'uppercase' as const }}>
            {queue.length} posts total · {totalPending} pending · {totalSent} sent to Buffer
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--admin-bg-card)', border: '1px solid var(--admin-bg-input)', borderRadius: 8, padding: 3 }}>
          {(['all', 'pending', 'sent'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.08em',
              background: filterStatus === s ? 'var(--admin-bg-input)' : 'transparent',
              color: filterStatus === s ? '#E8A020' : 'var(--admin-text-faint)',
              transition: 'all 0.15s',
            }}>
              {s === 'all' ? 'All' : s === 'pending' ? `Pending (${totalPending})` : `Sent (${totalSent})`}
            </button>
          ))}
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="cp-empty">
          <p className="cp-empty-text">Queue is empty</p>
          <p className="cp-muted" style={{ marginTop: 8 }}>Approve posts from the Content tab — they appear here by platform</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {Object.entries(grouped).map(([platform, posts]) => {
            const cfg   = PLATFORM_CONFIG[platform] || { label: platform, color: '#E8A020', bg: 'rgba(232,160,32,0.08)', icon: null };
            const shown = filtered(posts);
            if (shown.length === 0) return null;

            return (
              <div key={platform}>
                {/* Platform header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${cfg.color}22` }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color }}>
                    {cfg.icon}
                  </div>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, color: cfg.color }}>
                    {cfg.label}
                  </span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.08em', color: 'var(--admin-text-faint)', marginLeft: 4 }}>
                    {shown.length} post{shown.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Posts in this platform */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {shown.map(post => {
                    const isSent    = post.buffer_update_id || post.status === 'posted' || post.status === 'scheduled_buffer';
                    const imgUrl    = postImages[post.id] || post.image_url;
                    const isUploading = uploading === post.id;
                    const isSending   = sending === post.id;

                    return (
                      <div key={post.id} style={{
                        background: 'var(--admin-bg-card)',
                        border: `1px solid ${isSent ? 'rgba(16,185,129,0.2)' : 'var(--admin-bg-input)'}`,
                        borderRadius: 12,
                        padding: '14px 16px',
                        display: 'flex',
                        gap: 14,
                        opacity: isSent ? 0.75 : 1,
                        transition: 'opacity 0.2s',
                      }}>
                        {/* Left: image slot */}
                        <div style={{ flexShrink: 0 }}>
                          {imgUrl ? (
                            <div style={{ position: 'relative' as const }}>
                              <img src={imgUrl} alt="Post" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: `1px solid ${cfg.color}30`, display: 'block' }} />
                              {!isSent && (
                                <button onClick={() => {
                                  setPostImages(prev => { const n = {...prev}; delete n[post.id]; return n; });
                                  // Clear from DB too
                                  import('@/lib/supabase/client').then(({ createClient }) =>
                                    createClient().from('social_queue').update({ image_url: null }).eq('id', post.id)
                                  );
                                }} style={{ position: 'absolute' as const, top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#EF4444', border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                              )}
                            </div>
                          ) : (
                            <label style={{
                              width: 72, height: 72, borderRadius: 8,
                              border: `1.5px dashed ${cfg.color}40`,
                              background: cfg.bg,
                              display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
                              cursor: isSent ? 'not-allowed' : 'pointer',
                              gap: 4,
                            }}>
                              {isUploading ? (
                                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: cfg.color }}>…</span>
                              ) : (
                                <>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={cfg.color} strokeWidth="2" style={{ opacity: 0.7 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 7, color: cfg.color, opacity: 0.8, textAlign: 'center' as const }}>ADD IMAGE</span>
                                </>
                              )}
                              {!isSent && <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(post.id, f); e.target.value = ''; }} />}
                            </label>
                          )}
                        </div>

                        {/* Right: content + actions */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Meta row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' as const }}>
                            {post.pillar && (
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: '0.1em', padding: '2px 7px', borderRadius: 4, background: 'var(--admin-bg-deep)', color: 'var(--admin-text-faint)', textTransform: 'uppercase' as const }}>
                                {post.pillar}
                              </span>
                            )}
                            {post.scheduled_for && (
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: '#3B82F6', letterSpacing: '0.06em' }}>
                                📅 {new Date(post.scheduled_for).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            {isSent ? (
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, padding: '2px 8px', borderRadius: 4, background: 'rgba(16,185,129,0.1)', color: '#10B981', letterSpacing: '0.06em' }}>
                                ✓ Sent to Buffer
                              </span>
                            ) : (
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, padding: '2px 8px', borderRadius: 4, background: 'rgba(232,160,32,0.08)', color: '#E8A020', letterSpacing: '0.06em' }}>
                                Pending
                              </span>
                            )}
                          </div>

                          {/* Post content preview */}
                          <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, color: 'var(--admin-text)', lineHeight: 1.6, margin: '0 0 10px', whiteSpace: 'pre-wrap' as const }}>
                            {(post.content || '').substring(0, 200)}{(post.content || '').length > 200 ? '…' : ''}
                          </p>

                          {/* Actions */}
                          {!isSent && (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
                              <button
                                onClick={() => sendToBuffer(post)}
                                disabled={isSending}
                                style={{
                                  padding: '7px 16px', borderRadius: 8, border: 'none',
                                  background: cfg.color, color: '#fff',
                                  fontFamily: "'Syne', sans-serif", fontSize: 12, fontWeight: 700,
                                  cursor: isSending ? 'not-allowed' : 'pointer',
                                  opacity: isSending ? 0.6 : 1,
                                  display: 'flex', alignItems: 'center', gap: 6, transition: 'opacity 0.15s',
                                }}>
                                {isSending ? (
                                  <>Sending…</>
                                ) : (
                                  <>{cfg.icon} Send to {cfg.label}</>
                                )}
                              </button>
                              <button onClick={() => removeFromQueue(post.id)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#EF4444', fontFamily: "'DM Mono', monospace", fontSize: 10, cursor: 'pointer' }}>
                                Remove
                              </button>
                            </div>
                          )}

                          {isSent && post.buffer_update_id && (
                            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#10B981', letterSpacing: '0.06em' }}>
                              Buffer ID: {post.buffer_update_id}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Personal Brand Panel ──────────────────────────────────────────────────
function PersonalBrandPanel({ posts, loading, copied, onGenerate, onCopy, onSaveToQueue }: {
  posts: any[];
  loading: boolean;
  copied: string | null;
  onGenerate: () => void;
  onCopy: (text: string, id: string) => void;
  onSaveToQueue: (post: any) => void;
}) {
  const [imgStyle,    setImgStyle]    = useState('dark_gold');
  const [imgPlatform, setImgPlatform] = useState('linkedin');
  const [imgLoading,  setImgLoading]  = useState<Record<number, boolean>>({});
  const [imgResults,  setImgResults]  = useState<Record<number, { url: string; prompt: string; provider?: string }>>({});
  const [imgPrompt,   setImgPrompt]   = useState('');
  const [imgError,    setImgError]    = useState<Record<number, string>>({});

  const PILLAR_LABELS: Record<string, string> = {
    authority: 'Authority', career: 'Career Signal', insight: 'Insight',
    story: 'Story', tool: 'Tool / Resource', myth: 'Myth-bust',
  };

  async function generateImage(idx: number, postContent: string, platform: string) {
    setImgLoading(prev => ({ ...prev, [idx]: true }));
    setImgError(prev => ({ ...prev, [idx]: '' }));
    try {
      const res = await fetch('/api/admin/personal-brand/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postContent,
          style: imgStyle,
          platform: imgPlatform,
          customPrompt: imgPrompt.trim(),
        }),
      });

      // Guard against HTML error pages (Next.js 404/500 before route runs)
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        const hint = res.status === 404
          ? 'API route not found — redeploy to Vercel'
          : res.status === 500
          ? 'Server error — check Vercel logs'
          : `HTTP ${res.status}`;
        setImgError(prev => ({ ...prev, [idx]: hint }));
        setImgLoading(prev => ({ ...prev, [idx]: false }));
        return;
      }

      const data = await res.json();
      if (data.storedUrl || data.imageUrl) {
        setImgResults(prev => ({ ...prev, [idx]: { url: data.storedUrl || data.imageUrl, prompt: data.prompt, provider: data.provider } }));
      } else {
        setImgError(prev => ({ ...prev, [idx]: data.error || 'Generation failed' }));
      }
    } catch (e: any) {
      setImgError(prev => ({ ...prev, [idx]: e.message }));
    }
    setImgLoading(prev => ({ ...prev, [idx]: false }));
  }

  return (
    <div style={{ padding: '0 0 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: 'var(--admin-font-display)', fontSize: 20, fontWeight: 700, color: 'var(--admin-text-heading)' }}>
            Personal Brand
          </div>
          <div style={{ fontFamily: 'var(--admin-font-mono)', fontSize: 11, color: 'var(--admin-text-muted)', marginTop: 2, letterSpacing: '0.04em' }}>
            CYBERSECURITY · POSI AJIBOYE SAMUEL · LINKEDIN + TWITTER
          </div>
        </div>
        <button onClick={onGenerate} disabled={loading} style={{
          padding: '9px 18px', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          background: loading ? 'rgba(232,160,32,0.3)' : '#E8A020', color: '#0C0B08',
          fontFamily: 'var(--admin-font-ui)', fontSize: 13, fontWeight: 700,
        }}>
          {loading ? 'Generating…' : '⚡ Generate Posts'}
        </button>
      </div>

      {/* Strategy strip */}
      <div style={{ padding: '14px 18px', borderRadius: 10, marginBottom: 20, background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)', borderLeft: '3px solid #E8A020' }}>
        <div style={{ fontFamily: 'var(--admin-font-mono)', fontSize: 10, color: '#E8A020', letterSpacing: '0.08em', marginBottom: 8 }}>
          IMAGE SETTINGS — applies to all generated images
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontFamily: 'var(--admin-font-mono)', fontSize: 10, color: 'var(--admin-text-muted)', display: 'block', marginBottom: 4 }}>VISUAL STYLE</label>
            <select className="cp-select" value={imgStyle} onChange={e => setImgStyle(e.target.value)}>
              <option value="dark_gold">Dark + Gold — near-black with gold accent (dark theme)</option>
              <option value="light_warm">Light Warm — parchment &amp; cream with gold (light theme)</option>
              <option value="dark_contrast">Dark Contrast — black + bold gold geometry</option>
              <option value="light_editorial">Light Editorial — cream tones, magazine style</option>
              <option value="gradient_brand">Brand Gradient — parchment to near-black</option>
              <option value="terminal">Terminal — dark with gold glow, cyber feel</option>
              <option value="abstract_gold">Abstract Gold — network nodes, black + cream + gold</option>
            </select>
          </div>
          <div>
            <label style={{ fontFamily: 'var(--admin-font-mono)', fontSize: 10, color: 'var(--admin-text-muted)', display: 'block', marginBottom: 4 }}>IMAGE DIMENSIONS</label>
            <select className="cp-select" value={imgPlatform} onChange={e => setImgPlatform(e.target.value)}>
              <option value="linkedin">LinkedIn — 896×512 (optimised for speed)</option>
              <option value="twitter">Twitter/X — 896×512 (optimised for speed)</option>
              <option value="square">Square — 768×768 (optimised for speed)</option>
            </select>
          </div>
        </div>
        <div>
          <label style={{ fontFamily: 'var(--admin-font-mono)', fontSize: 10, color: 'var(--admin-text-muted)', display: 'block', marginBottom: 4 }}>CUSTOM PROMPT (optional — overrides auto-generation)</label>
          <input className="cp-input" placeholder="e.g. Close-up of a glowing server rack in a dark data centre, cinematic…" value={imgPrompt} onChange={e => setImgPrompt(e.target.value)} />
        </div>
      </div>

      {/* Empty state */}
      {posts.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
          <div style={{ fontFamily: 'var(--admin-font-display)', fontSize: 22, color: 'var(--admin-text-muted)', marginBottom: 8 }}>No posts yet</div>
          <div style={{ fontFamily: 'var(--admin-font-mono)', fontSize: 11, color: 'var(--admin-text-faint)', letterSpacing: '0.04em' }}>Click "Generate Posts" to create LinkedIn and Twitter content</div>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontFamily: 'var(--admin-font-mono)', fontSize: 12, color: '#E8A020', letterSpacing: '0.06em' }}>WRITING YOUR POSTS…</div>
        </div>
      )}

      {/* Post cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {posts.map((post, idx) => {
          const id = `post-${idx}`;
          const platformColor = post.platform === 'linkedin' ? '#0A66C2' : '#1D9BF0';
          const platformLabel = post.platform === 'linkedin' ? 'LinkedIn' : 'Twitter/X';
          const img = imgResults[idx];
          const isImgLoading = imgLoading[idx];
          const imgErr = imgError[idx];

          return (
            <div key={id} style={{ borderRadius: 12, background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)', borderTop: `3px solid ${platformColor}`, overflow: 'hidden' }}>

              {/* Card header */}
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--admin-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--admin-font-mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 999, background: `${platformColor}18`, color: platformColor, border: `1px solid ${platformColor}30` }}>{platformLabel}</span>
                  {post.pillar && <span style={{ fontFamily: 'var(--admin-font-mono)', fontSize: 10, color: 'var(--admin-text-muted)' }}>{PILLAR_LABELS[post.pillar] || post.pillar}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => onCopy(post.content, id)} style={{ padding: '5px 12px', borderRadius: 7, cursor: 'pointer', background: copied === id ? 'rgba(16,185,129,0.12)' : 'transparent', border: `1px solid ${copied === id ? '#10B981' : 'var(--admin-border)'}`, color: copied === id ? '#10B981' : 'var(--admin-text-muted)', fontFamily: 'var(--admin-font-mono)', fontSize: 10 }}>
                    {copied === id ? '✓ Copied' : 'Copy'}
                  </button>
                  <button onClick={() => onSaveToQueue(post)} style={{ padding: '5px 12px', borderRadius: 7, cursor: 'pointer', background: 'transparent', border: '1px solid var(--admin-border)', color: '#E8A020', fontFamily: 'var(--admin-font-mono)', fontSize: 10 }}>
                    → Queue
                  </button>
                </div>
              </div>

              {/* Post content */}
              <div style={{ padding: '16px', fontFamily: 'var(--admin-font-ui)', fontSize: 13, color: 'var(--admin-text)', lineHeight: 1.65, whiteSpace: 'pre-wrap', maxHeight: 280, overflowY: 'auto' }}>
                {post.content}
              </div>
              {post.hashtags && (
                <div style={{ padding: '4px 16px 12px', fontFamily: 'var(--admin-font-mono)', fontSize: 11, color: platformColor, opacity: 0.8 }}>
                  {post.hashtags}
                </div>
              )}

              {/* Image section */}
              <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--admin-border)' }}>
                {!img && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={() => generateImage(idx, post.content, post.platform)}
                      disabled={isImgLoading}
                      style={{ padding: '7px 14px', borderRadius: 8, cursor: isImgLoading ? 'not-allowed' : 'pointer', background: 'transparent', border: '1px solid var(--admin-border)', color: isImgLoading ? 'var(--admin-text-faint)' : 'var(--admin-text-muted)', fontFamily: 'var(--admin-font-mono)', fontSize: 10 }}
                    >
                      {isImgLoading ? '🎨 Generating image…' : '🎨 Generate Image'}
                    </button>
                    {imgErr && <span style={{ fontFamily: 'var(--admin-font-mono)', fontSize: 10, color: '#EF4444' }}>{imgErr}</span>}
                  </div>
                )}

                {img && (
                  <div>
                    <img src={img.url} alt="Generated social image" style={{ width: '100%', borderRadius: 8, display: 'block', marginBottom: 8 }} />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <a href={img.url} download="post-image.png" target="_blank" rel="noreferrer" style={{ padding: '5px 12px', borderRadius: 7, background: 'transparent', border: '1px solid var(--admin-border)', color: '#E8A020', fontFamily: 'var(--admin-font-mono)', fontSize: 10, textDecoration: 'none' }}>
                        ↓ Download
                      </a>
                      <button onClick={() => { setImgResults(prev => { const n = {...prev}; delete n[idx]; return n; }); generateImage(idx, post.content, post.platform); }}
                        style={{ padding: '5px 12px', borderRadius: 7, cursor: 'pointer', background: 'transparent', border: '1px solid var(--admin-border)', color: 'var(--admin-text-muted)', fontFamily: 'var(--admin-font-mono)', fontSize: 10 }}>
                        ↺ Regenerate
                      </button>
                      {img.provider && (
                        <span style={{
                          fontFamily: 'var(--admin-font-mono)', fontSize: 9, padding: '2px 7px',
                          borderRadius: 999, whiteSpace: 'nowrap',
                          background: img.provider === 'huggingface' ? 'rgba(232,160,32,0.12)' : 'rgba(16,185,129,0.12)',
                          color:      img.provider === 'huggingface' ? '#E8A020' : '#10B981',
                          border:     `1px solid ${img.provider === 'huggingface' ? 'rgba(232,160,32,0.25)' : 'rgba(16,185,129,0.25)'}`,
                        }}>
                          {img.provider === 'huggingface' ? 'HF FLUX' : 'Pollinations'}
                        </span>
                      )}
                      <span style={{ fontFamily: 'var(--admin-font-mono)', fontSize: 9, color: 'var(--admin-text-faint)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {img.prompt}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// CarouselTab — Agent 13 UI (added by carousel-agent setup)
// ─────────────────────────────────────────────────────────────
function CarouselTab({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const [pillar,    setPillar]    = useState('career');
  const [platform,  setPlatform]  = useState('LinkedIn');
  const [postCount, setPostCount] = useState(3);
  const [week,      setWeek]      = useState(Math.ceil(new Date().getDate() / 7));
  const [hooks,     setHooks]     = useState('');
  const [running,   setRunning]   = useState(false);
  const [done,      setDone]      = useState(false);

  const pillars   = ['career', 'leadership', 'ai', 'coaching', 'community'];
  const platforms = ['LinkedIn', 'Instagram', 'TikTok'];
  const PRICE_PER_IMAGE = 0.011; // gpt-image-1 low quality 1024x1024 — update if quality/size changes
  const cost = (postCount * 6 * PRICE_PER_IMAGE + 0.02).toFixed(3);

  async function run() {
    setRunning(true); setDone(false);
    try {
      const hooksArr = hooks.split('\n').map((h: string) => h.trim()).filter(Boolean);
      const payload: Record<string, any> = { pillar, platform, postCount, week };
      if (hooksArr.length > 0) payload.hooks = hooksArr;
      const res  = await fetch('/api/admin/agents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: '13', payload }) });
      const data = await res.json();
      if (data.success) { showToast(`Carousel agent started — run ${(data.runId||'').slice(0,8)}\u2026 Posts in Content Calendar as drafts in ~3 min.`); setDone(true); }
      else showToast('Error: ' + data.error, false);
    } catch (e: any) { showToast('Error: ' + e.message, false); }
    setRunning(false);
  }

  const pill = (active: boolean) => ({ padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: "'DM Mono', monospace", textTransform: 'capitalize' as const, border: `1px solid ${active ? '#A0720A' : '#E2DDD4'}`, background: active ? '#A0720A' : '#F5F3EE', color: active ? '#fff' : '#6B6860' });

  return (
    <div style={{ padding: '24px 0', maxWidth: 620 }}>
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#A0720A', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Agent 13 · Carousel Agent</p>
      <p style={{ fontSize: 13, color: '#6B6860', lineHeight: 1.65, marginBottom: 24 }}>Claude + GPT-image-1 → 6-slide portrait carousels → Content Calendar drafts → Queue Social → Buffer. ~${cost} per session.</p>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#A0720A', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Pillar</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{pillars.map(p => <button key={p} style={pill(pillar === p)} onClick={() => setPillar(p)}>{p}</button>)}</div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#A0720A', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Platform</label>
        <div style={{ display: 'flex', gap: 8 }}>{platforms.map(p => <button key={p} style={pill(platform === p)} onClick={() => setPlatform(p)}>{p}</button>)}</div>
      </div>

      <div style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#A0720A', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Posts</label>
          <div style={{ display: 'flex', gap: 6 }}>{[1,2,3,5].map(n => <button key={n} onClick={() => setPostCount(n)} style={{ width: 36, height: 36, borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: "'DM Mono', monospace", border: `1px solid ${postCount===n?'#A0720A':'#E2DDD4'}`, background: postCount===n?'#A0720A':'#F5F3EE', color: postCount===n?'#fff':'#6B6860' }}>{n}</button>)}</div>
        </div>
        <div>
          <label style={{ display: 'block', fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#A0720A', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Week</label>
          <input type="number" min={1} max={52} value={week} onChange={e => setWeek(Number(e.target.value))} style={{ width: 64, padding: '6px 10px', border: '1px solid #E2DDD4', borderRadius: 6, background: '#F5F3EE', fontSize: 13, fontFamily: "'DM Mono', monospace", color: '#0C0B08' }} />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#A0720A', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Hooks from hook bank <span style={{ color: '#9E9B94', fontWeight: 400, textTransform: 'none', fontSize: 10 }}>— optional, one per line</span></label>
        <textarea value={hooks} onChange={e => setHooks(e.target.value)} rows={3} placeholder={"My manager said I wasn't ready for a promotion. My Ascentor mentor asked me one question that changed everything.\nI almost quit my job. My mentor showed me I wasn't stuck — I was just invisible to the right people."} style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2DDD4', borderRadius: 8, background: '#F5F3EE', fontSize: 12, fontFamily: "'DM Mono', monospace", color: '#0C0B08', resize: 'vertical', lineHeight: 1.65 }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F5F3EE', border: '1px solid #E2DDD4', borderRadius: 8, padding: '10px 16px', marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: '#6B6860', fontFamily: "'DM Mono', monospace" }}>Estimated cost</span>
        <span style={{ fontSize: 13, fontFamily: "'DM Mono', monospace", color: '#0C0B08' }}>~${cost} <span style={{ color: '#9E9B94', fontSize: 11 }}>({postCount} posts × 6 × ${PRICE_PER_IMAGE})</span></span>
      </div>

      <button onClick={run} disabled={running} style={{ width: '100%', padding: '12px 0', borderRadius: 8, border: 'none', cursor: running?'not-allowed':'pointer', background: running?'#9E9B94':'#0C0B08', color: '#fff', fontSize: 13, fontFamily: "'DM Mono', monospace", letterSpacing: '0.04em' }}>
        {running ? 'Running\u2026 (~3 min for image generation)' : `\u25b6  Generate ${postCount} carousel${postCount>1?'s':''} \u2014 ${platform}`}
      </button>

      {done && <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 8, background: '#E8F4F0', border: '1px solid #9FE1CB', fontSize: 12, color: '#1A5C4A', fontFamily: "'DM Mono', monospace", lineHeight: 1.7 }}>\u2713 Agent started. When done (~3 min):<br/>1. Content tab \u2192 filter: Instagram Carousel<br/>2. Review \u2192 Approve<br/>3. Queue Social \u2192 cover slide auto-attaches to Buffer<br/>4. TikTok: drafts \u2192 add trending sound \u2192 publish</div>}

      <div style={{ marginTop: 20, padding: '14px 16px', borderRadius: 8, background: '#0C0B08' }}>
        <p style={{ fontSize: 10, color: '#A0720A', fontFamily: "'DM Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>The winning formula</p>
        <p style={{ fontSize: 12, color: '#F5F3EE', fontFamily: "'DM Mono', monospace", lineHeight: 1.8 }}>[PERSON] + [CONFLICT] \u2192 [ASCENTOR MOMENT] \u2192 [MIND CHANGED]</p>
      </div>
    </div>
  );
}
