'use client';

// app/admin/blog/BlogInner.tsx — THE LEDGER
// Restyled to The Ledger (styles/admin-ledger.css). Same conversion
// as the other three pages this pass: var(--bg-card)/var(--text)/
// var(--accent) -> var(--ledger-*) equivalents, raw status hex ->
// Ledger status tokens. Logic UNCHANGED — same loadPosts, handleSave,
// togglePublish, handleDelete.
//
// FUNCTIONAL FIX (not just styling): the post list below the form
// never rendered cover_image at all — no <img> tag existed in that
// section, only title/slug/category/author text. The form's OWN
// preview (further up, while editing) DID work, which is why this
// looked like an inconsistent "sometimes images don't show" bug
// rather than what it actually was: the list view was simply never
// built to display a thumbnail. Confirmed cover_image data is real
// and used correctly on the live post page (app/blog/[slug]/page.tsx)
// — only the admin list and the public blog INDEX (app/blog/page.tsx,
// a separate file, out of scope for this pass) are missing it.
// Added a 56x56 thumbnail (or a placeholder icon when no cover_image
// is set) to each row below.

import SageLoader from '@/components/SageLoader';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';

const CATEGORIES = ['Leadership', 'Career Growth', 'Communication', 'Frameworks', 'Stories', 'General'];

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function AdminBlogPageInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(searchParams.get('action') === 'create');
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const emptyForm = {
    title: '', slug: '', excerpt: '', content: '', category: 'General',
    author_name: 'Posi Ajiboye', read_time_minutes: 5, is_published: false,
    cover_image: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [coverUploading, setCoverUploading] = useState(false);

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
      is_published: post.is_published, cover_image: post.cover_image || '',
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
      cover_image: form.cover_image || null,
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
      setSaveError('Save failed: ' + error.message);
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

  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    await supabase.from('blog_posts').delete().eq('id', id);
    setDeletingId(null);
    loadPosts();
  }

  if (loading) return <SageLoader message="Loading posts…" />;

  return (
    <div className="animate-fade-up">
      <style>{`
        .blog-input:focus { border-color: var(--ledger-gold) !important; }
        .blog-input::placeholder { color: var(--ledger-ink-faint); opacity: 0.6; }
        .blog-post-actions { display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap; }
        @media (max-width: 480px) {
          .blog-post-actions { width: 100%; }
          .blog-post-actions button { flex: 1; justify-content: center; }
        }
      `}</style>

      {/* ── Header ── */}
      <div className="flex justify-between items-start mb-6" style={{ gap: '12px' }}>
        <div>
          <h1 className="ledger-h1" style={{ fontSize: 26 }}>
            Blog Posts
          </h1>
          <p className="text-sm ledger-mono" style={{ fontSize: 12 }}>
            {posts.filter(p => p.is_published).length} published · {posts.filter(p => !p.is_published).length} drafts
          </p>
        </div>
        <button
          onClick={openCreate}
          className="ledger-btn ledger-btn-primary px-4 py-2.5 text-sm whitespace-nowrap flex-shrink-0"
          style={{ fontFamily: 'var(--ledger-font-ui)', textTransform: 'none', letterSpacing: 0, fontSize: 13.5 }}
        >
          + New Post
        </button>
      </div>

      {/* ── Save error banner (replaces alert()) ── */}
      {saveError && (
        <div className="rounded-xl px-4 py-3 mb-4 text-sm flex items-center justify-between gap-3"
          style={{ background: 'var(--ledger-bad-bg)', border: '1px solid rgba(200,74,56,0.3)', color: 'var(--ledger-bad)' }}>
          <span>{saveError}</span>
          <button onClick={() => setSaveError('')} style={{ fontSize: '16px', lineHeight: 1, background: 'none', border: 'none', color: 'var(--ledger-bad)', cursor: 'pointer' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      )}

      {/* ── Create / Edit Form ── */}
      {showForm && (
        <div className="rounded-xl p-4 md:p-5 mb-6 ledger-panel" style={{ borderColor: 'var(--ledger-gold-border)' }}>
          <h3 className="text-sm font-semibold mb-4 ledger-h2" style={{ fontSize: 15 }}>
            {editing ? 'Edit Post' : 'New Blog Post'}
          </h3>
          <div className="flex flex-col gap-3">

            {/* Title */}
            <input
              className="blog-input w-full px-3.5 py-3 text-sm rounded-xl"
              style={{ background: 'var(--ledger-bg-input)', color: 'var(--ledger-ink)', border: '1px solid var(--ledger-line-strong)', outline: 'none' }}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value, slug: editing ? form.slug : slugify(e.target.value) })}
              placeholder="Post title"
            />

            {/* Slug + Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                className="blog-input px-3.5 py-3 text-sm rounded-xl"
                style={{ background: 'var(--ledger-bg-input)', color: 'var(--ledger-ink)', border: '1px solid var(--ledger-line-strong)', outline: 'none' }}
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="url-slug"
              />
              <select
                className="blog-input px-3 py-3 text-sm rounded-xl"
                style={{ background: 'var(--ledger-bg-input)', color: 'var(--ledger-ink)', border: '1px solid var(--ledger-line-strong)' }}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>

            {/* Excerpt */}
            <textarea
              className="blog-input w-full px-3.5 py-3 text-sm rounded-xl resize-none"
              style={{ background: 'var(--ledger-bg-input)', color: 'var(--ledger-ink)', border: '1px solid var(--ledger-line-strong)', outline: 'none' }}
              value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              placeholder="Short excerpt"
              rows={2}
            />

            {/* Content */}
            <textarea
              className="blog-input w-full px-3.5 py-3 text-sm rounded-xl font-mono"
              style={{ background: 'var(--ledger-bg-input)', color: 'var(--ledger-ink)', border: '1px solid var(--ledger-line-strong)', outline: 'none', minHeight: '200px' }}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Post content"
              rows={10}
            />

            {/* Author + Read time (2-col on mobile, 3-col on sm+) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                className="blog-input px-3.5 py-3 text-sm rounded-xl"
                style={{ background: 'var(--ledger-bg-input)', color: 'var(--ledger-ink)', border: '1px solid var(--ledger-line-strong)', outline: 'none' }}
                value={form.author_name}
                onChange={(e) => setForm({ ...form, author_name: e.target.value })}
                placeholder="Author name"
              />
              <input
                type="number"
                className="blog-input px-3.5 py-3 text-sm rounded-xl"
                style={{ background: 'var(--ledger-bg-input)', color: 'var(--ledger-ink)', border: '1px solid var(--ledger-line-strong)', outline: 'none' }}
                value={form.read_time_minutes}
                onChange={(e) => setForm({ ...form, read_time_minutes: Number(e.target.value) })}
                placeholder="Read time (min)"
              />
            </div>

            {/* Cover image — upload first; URL paste as fallback */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px',
                  borderRadius: 'var(--ledger-radius-md)', background: '#C8A96E', color: '#0F0F0E',
                  cursor: coverUploading ? 'wait' : 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                  opacity: coverUploading ? 0.6 : 1,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  {coverUploading ? 'Uploading…' : 'Upload cover'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} disabled={coverUploading} onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setCoverUploading(true);
                    try {
                      const fd = new FormData();
                      fd.append('file', file);
                      fd.append('folder', 'blog');
                      const res = await fetch('/api/admin/upload-media', { method: 'POST', body: fd });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Upload failed');
                      setForm(prev => ({ ...prev, cover_image: data.url }));
                    } catch (err) {
                      alert(err instanceof Error ? err.message : 'Upload failed — try again.');
                    } finally {
                      setCoverUploading(false);
                      e.target.value = '';
                    }
                  }} />
                </label>
                <input
                  className="blog-input px-3.5 py-3 text-sm rounded-xl"
                  style={{ flex: 1, background: 'var(--ledger-bg-input)', color: 'var(--ledger-ink)', border: '1px solid var(--ledger-line-strong)', outline: 'none' }}
                  value={form.cover_image}
                  onChange={(e) => setForm({ ...form, cover_image: e.target.value })}
                  placeholder="…or paste an image URL"
                />
              </div>
              {form.cover_image && (
                <img src={form.cover_image} alt="Cover preview" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 'var(--ledger-radius-md)', border: '1px solid var(--ledger-line-strong)' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
            </div>

            {/* Publish toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer py-1">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                className="w-4 h-4 rounded"
                style={{ accentColor: 'var(--ledger-gold)' }}
              />
              <span className="text-sm" style={{ color: 'var(--ledger-ink-soft)' }}>Publish immediately</span>
            </label>

            {/* Actions */}
            <div className="flex gap-2 mt-1">
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim() || !form.content.trim()}
                className="ledger-btn ledger-btn-primary px-5 py-2.5 text-sm disabled:opacity-40 flex-1 sm:flex-none"
                style={{ fontFamily: 'var(--ledger-font-ui)', textTransform: 'none', letterSpacing: 0, fontSize: 13.5 }}
              >
                {saving ? 'Saving...' : editing ? 'Update Post' : 'Create Post'}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditing(null); }}
                className="ledger-btn ledger-btn-ghost px-4 py-2.5 text-sm flex-1 sm:flex-none"
                style={{ fontFamily: 'var(--ledger-font-ui)', textTransform: 'none', letterSpacing: 0, fontSize: 13.5 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Post List ── */}
      <div className="flex flex-col gap-2">
        {posts.length === 0 && (
          <div className="rounded-xl p-8 text-center ledger-panel">
            <p className="text-sm ledger-mono">No posts yet. Create your first post above.</p>
          </div>
        )}
        {posts.map((p) => (
          <div
            key={p.id}
            className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 ledger-panel"
            style={{ opacity: p.is_published ? 1 : 0.65 }}
          >
            {/* Thumbnail — FIX: this row never rendered cover_image before.
                Falls back to a placeholder icon when no image is set, so
                the list stays visually scannable either way. */}
            {p.cover_image ? (
              <img
                src={p.cover_image}
                alt=""
                style={{
                  width: 56, height: 56, borderRadius: 'var(--ledger-radius-md)',
                  objectFit: 'cover', flexShrink: 0,
                  border: '1px solid var(--ledger-line)',
                }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div style={{
                width: 56, height: 56, borderRadius: 'var(--ledger-radius-md)',
                background: 'var(--ledger-bg-input)', border: '1px solid var(--ledger-line)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ledger-ink-faint)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
                </svg>
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-semibold truncate" style={{ color: 'var(--ledger-ink)' }}>{p.title}</h4>
                {!p.is_published && (
                  <span className="ledger-tag" style={{ background: 'var(--ledger-bg-input)', color: 'var(--ledger-ink-faint)' }}>
                    DRAFT
                  </span>
                )}
              </div>
              <p className="text-xs mt-0.5 ledger-mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                /{p.slug} · {p.category} · {p.read_time_minutes} min · {p.author_name}
              </p>
            </div>

            {/* Actions — wrap to full-width row on mobile */}
            <div className="blog-post-actions">
              <button
                onClick={() => togglePublish(p.id, p.is_published)}
                className="text-xs px-3 py-2 rounded-lg"
                style={{
                  color: p.is_published ? 'var(--ledger-ink-faint)' : 'var(--ledger-good)',
                  border: `1px solid ${p.is_published ? 'var(--ledger-line-strong)' : 'rgba(79,143,79,0.3)'}`,
                }}
              >
                {p.is_published ? 'Unpublish' : 'Publish'}
              </button>
              <button
                onClick={() => openEdit(p)}
                className="text-xs px-3 py-2 rounded-lg"
                style={{ color: 'var(--ledger-gold)', border: '1px solid var(--ledger-gold-border)' }}
              >
                Edit
              </button>
              {deletingId === p.id ? (
                <div className="flex gap-1.5 items-center">
                  <span className="text-xs" style={{ color: 'var(--ledger-ink-soft)' }}>Delete?</span>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-xs px-2.5 py-2 rounded-lg font-semibold"
                    style={{ color: '#fff', background: 'rgba(200,74,56,0.85)', border: '1px solid rgba(200,74,56,0.5)' }}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setDeletingId(null)}
                    className="text-xs px-2.5 py-2 rounded-lg"
                    style={{ color: 'var(--ledger-ink-soft)', border: '1px solid var(--ledger-line-strong)' }}
                  >
                    No
                  </button>
                </div>
              ) : (
              <button
                onClick={() => setDeletingId(p.id)}
                className="text-xs px-3 py-2 rounded-lg"
                style={{ color: 'var(--ledger-bad)', border: '1px solid rgba(200,74,56,0.3)' }}
              >
                Delete
              </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
