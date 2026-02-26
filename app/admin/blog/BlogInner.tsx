'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';

const CATEGORIES = ['Leadership', 'Career Growth', 'African Context', 'Communication', 'Frameworks', 'Stories', 'General'];

// Category → color mapping using the full Ascentor palette
const CATEGORY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  'Leadership':      { bg: 'rgba(102,98,255,0.12)',  color: '#6662FF',  border: 'rgba(102,98,255,0.25)' },
  'Career Growth':   { bg: 'rgba(207,255,94,0.12)',  color: '#7AAA00',  border: 'rgba(207,255,94,0.35)' },
  'African Context': { bg: 'rgba(253,129,253,0.12)', color: '#C040C0',  border: 'rgba(253,129,253,0.3)' },
  'Communication':   { bg: 'rgba(166,162,255,0.15)', color: '#5550CC',  border: 'rgba(166,162,255,0.3)' },
  'Frameworks':      { bg: 'rgba(207,255,94,0.1)',   color: '#5E8000',  border: 'rgba(207,255,94,0.25)' },
  'Stories':         { bg: 'rgba(253,129,253,0.1)',  color: '#A030A0',  border: 'rgba(253,129,253,0.25)' },
  'General':         { bg: 'rgba(102,98,255,0.08)',  color: '#A6A2FF',  border: 'rgba(166,162,255,0.2)' },
};

function getCategoryStyle(cat: string) {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS['General'];
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  outline: 'none',
  transition: 'border-color 0.15s',
};

export default function AdminBlogPageInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(searchParams.get('action') === 'create');
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = {
    title: '', slug: '', excerpt: '', content: '', category: 'General',
    author_name: 'Posi Ajiboye', read_time_minutes: 5, is_published: false,
    cover_image_url: '',
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadPosts(); }, []);

  async function loadPosts() {
    const { data } = await supabase.from('blog_posts').select('*').order('created_at', { ascending: false });
    setPosts(data || []);
    setLoading(false);
  }

  function openEdit(post: any) {
    setForm({
      title: post.title, slug: post.slug, excerpt: post.excerpt || '',
      content: post.content, category: post.category || 'General',
      author_name: post.author_name || '', read_time_minutes: post.read_time_minutes || 5,
      is_published: post.is_published, cover_image_url: post.cover_image_url || '',
    });
    setEditing(post);
    setShowForm(true);
  }

  function openCreate() {
    setForm(emptyForm);
    setEditing(null);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);

    const slug = form.slug || slugify(form.title);
    const payload: any = {
      title: form.title,
      slug,
      excerpt: form.excerpt || null,
      content: form.content,
      category: form.category || 'General',
      author_name: form.author_name || null,
      cover_image_url: form.cover_image_url || null,
      read_time_minutes: Number(form.read_time_minutes) || 5,
      is_published: form.is_published,
      published_at: form.is_published ? (editing?.published_at || new Date().toISOString()) : null,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from('blog_posts').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('blog_posts').insert(payload));
    }

    if (error) {
      alert('Save failed: ' + error.message);
    } else {
      setShowForm(false);
      setEditing(null);
    }

    setSaving(false);
    loadPosts();
  }

  async function togglePublish(id: string, current: boolean) {
    await supabase.from('blog_posts').update({
      is_published: !current,
      published_at: !current ? new Date().toISOString() : null,
    }).eq('id', id);
    loadPosts();
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    await supabase.from('blog_posts').delete().eq('id', id);
    loadPosts();
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '3px solid rgba(102,98,255,0.15)',
          borderTop: '3px solid #6662FF',
          animation: 'spin 0.9s linear infinite',
          margin: '0 auto 12px',
        }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading posts...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const published = posts.filter(p => p.is_published);
  const drafts = posts.filter(p => !p.is_published);

  return (
    <div className="animate-fade-up">

      {/* ── Header ── */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold"
            style={{ fontFamily: "'Syne', sans-serif", color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Blog Posts
          </h1>
          {/* Stats pills using secondary colors */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(207,255,94,0.12)', color: '#5E8000', border: '1px solid rgba(207,255,94,0.3)' }}>
              ✓ {published.length} published
            </span>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(253,129,253,0.1)', color: '#A030A0', border: '1px solid rgba(253,129,253,0.25)' }}>
              ✎ {drafts.length} drafts
            </span>
          </div>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all"
          style={{
            background: '#6662FF',
            color: '#fff',
            boxShadow: '0 2px 14px rgba(102,98,255,0.4)',
          }}>
          + New Post
        </button>
      </div>

      {/* ── Create / Edit Form ── */}
      {showForm && (
        <div className="rounded-2xl p-5 mb-6"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid rgba(102,98,255,0.35)',
            boxShadow: '0 0 0 4px rgba(102,98,255,0.06)',
          }}>

          {/* Form header with green-yellow accent bar */}
          <div className="flex items-center gap-3 mb-5">
            <div style={{ width: 4, height: 32, borderRadius: 4, background: 'linear-gradient(180deg, #6662FF, #CFFF5E)' }} />
            <h3 className="text-sm font-bold"
              style={{ fontFamily: "'Syne', sans-serif", color: 'var(--text)', letterSpacing: '-0.01em' }}>
              {editing ? 'Edit Post' : 'New Blog Post'}
            </h3>
          </div>

          <div className="flex flex-col gap-3">
            {/* Title */}
            <input
              className="w-full px-3.5 py-2.5 text-sm rounded-xl"
              style={inputStyle}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value, slug: editing ? form.slug : slugify(e.target.value) })}
              placeholder="Post title"
              onFocus={(e) => e.target.style.borderColor = '#6662FF'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />

            {/* Slug + Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                className="px-3.5 py-2.5 text-sm rounded-xl"
                style={inputStyle}
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="url-slug"
                onFocus={(e) => e.target.style.borderColor = '#6662FF'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
              <select
                className="px-3 py-2.5 text-sm rounded-xl"
                style={{ ...inputStyle, background: 'var(--bg-input)' }}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>

            {/* Category preview badge */}
            {form.category && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Preview:</span>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    background: getCategoryStyle(form.category).bg,
                    color: getCategoryStyle(form.category).color,
                    border: `1px solid ${getCategoryStyle(form.category).border}`,
                  }}>
                  {form.category}
                </span>
              </div>
            )}

            {/* Excerpt */}
            <textarea
              className="w-full px-3.5 py-2.5 text-sm rounded-xl resize-none"
              style={inputStyle}
              value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              placeholder="Short excerpt"
              rows={2}
              onFocus={(e) => e.target.style.borderColor = '#6662FF'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />

            {/* Content */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block"
                style={{ color: 'var(--text-dim)' }}>Content</label>
              <textarea
                className="w-full px-3.5 py-2.5 text-sm rounded-xl font-mono"
                style={inputStyle}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Post content (markdown supported)"
                rows={10}
                onFocus={(e) => e.target.style.borderColor = '#6662FF'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* Author + Read time + Cover */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input className="px-3.5 py-2.5 text-sm rounded-xl" style={inputStyle}
                value={form.author_name} onChange={(e) => setForm({ ...form, author_name: e.target.value })}
                placeholder="Author name"
                onFocus={(e) => e.target.style.borderColor = '#6662FF'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
              <input type="number" className="px-3.5 py-2.5 text-sm rounded-xl" style={inputStyle}
                value={form.read_time_minutes} onChange={(e) => setForm({ ...form, read_time_minutes: Number(e.target.value) })}
                placeholder="Read time (min)"
                onFocus={(e) => e.target.style.borderColor = '#6662FF'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
              <input className="px-3.5 py-2.5 text-sm rounded-xl" style={inputStyle}
                value={form.cover_image_url} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })}
                placeholder="Cover image URL"
                onFocus={(e) => e.target.style.borderColor = '#6662FF'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
            </div>

            {/* Publish toggle — green-yellow when checked */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => setForm({ ...form, is_published: !form.is_published })}
                className="relative w-10 h-5 rounded-full transition-all shrink-0"
                style={{
                  background: form.is_published ? '#CFFF5E' : 'var(--bg-input)',
                  border: `1px solid ${form.is_published ? '#CFFF5E' : 'var(--border)'}`,
                  boxShadow: form.is_published ? '0 0 0 3px rgba(207,255,94,0.2)' : 'none',
                  cursor: 'pointer',
                }}>
                <div className="w-3.5 h-3.5 rounded-full absolute top-0.5 transition-all"
                  style={{
                    background: form.is_published ? '#1E1E1E' : 'var(--text-dim)',
                    left: form.is_published ? '20px' : '3px',
                  }} />
              </div>
              <span className="text-sm font-medium"
                style={{ color: form.is_published ? '#5E8000' : 'var(--text-muted)' }}>
                {form.is_published ? 'Publish immediately' : 'Save as draft'}
              </span>
            </label>

            {/* Actions */}
            <div className="flex gap-2 mt-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={handleSave}
                disabled={saving || !form.title.trim() || !form.content.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all"
                style={{
                  background: '#6662FF',
                  color: '#fff',
                  boxShadow: '0 2px 12px rgba(102,98,255,0.4)',
                }}>
                {saving ? 'Saving...' : editing ? 'Update Post' : 'Create Post'}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditing(null); }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Posts List ── */}
      {posts.length === 0 ? (
        <div className="text-center py-16 rounded-2xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'rgba(102,98,255,0.1)',
            border: '1.5px solid rgba(102,98,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px', fontSize: 22,
          }}>✍️</div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>No posts yet</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>Click "New Post" to write your first article</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {posts.map((p) => {
            const catStyle = getCategoryStyle(p.category || 'General');
            return (
              <div key={p.id}
                className="rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-all"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  opacity: p.is_published ? 1 : 0.72,
                }}>

                {/* Left: color accent bar */}
                <div style={{
                  width: 3, height: 40, borderRadius: 4, flexShrink: 0,
                  background: p.is_published
                    ? `linear-gradient(180deg, ${catStyle.color}, transparent)`
                    : 'var(--border)',
                }} className="hidden sm:block" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold truncate"
                      style={{ fontFamily: "'Syne', sans-serif", color: 'var(--text)' }}>
                      {p.title}
                    </h4>
                    {/* Draft badge — fuchsia */}
                    {!p.is_published && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: 'rgba(253,129,253,0.1)', color: '#A030A0', border: '1px solid rgba(253,129,253,0.25)' }}>
                        DRAFT
                      </span>
                    )}
                    {/* Category badge — palette color */}
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: catStyle.bg, color: catStyle.color, border: `1px solid ${catStyle.border}` }}>
                      {p.category}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-dim)' }}>
                    /{p.slug} · {p.read_time_minutes} min read · {p.author_name}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 shrink-0">
                  {/* Publish/Unpublish — green-yellow for publish */}
                  <button onClick={() => togglePublish(p.id, p.is_published)}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                    style={p.is_published ? {
                      color: 'var(--text-dim)',
                      border: '1px solid var(--border)',
                    } : {
                      color: '#5E8000',
                      border: '1px solid rgba(207,255,94,0.4)',
                      background: 'rgba(207,255,94,0.08)',
                    }}>
                    {p.is_published ? 'Unpublish' : '↑ Publish'}
                  </button>

                  {/* Edit — brand purple */}
                  <button onClick={() => openEdit(p)}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                    style={{
                      color: '#6662FF',
                      border: '1px solid rgba(102,98,255,0.3)',
                      background: 'rgba(102,98,255,0.06)',
                    }}>
                    Edit
                  </button>

                  {/* Delete — red */}
                  <button onClick={() => handleDelete(p.id, p.title)}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                    style={{
                      color: 'var(--error)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      background: 'rgba(239,68,68,0.04)',
                    }}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
