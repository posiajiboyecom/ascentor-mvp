'use client';

import SageLoader from '@/components/SageLoader';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';

const CATEGORIES = ['Leadership', 'Career Growth', 'African Context', 'Communication', 'Frameworks', 'Stories', 'General'];

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

  if (loading) return <SageLoader message="Loading posts…" />;

  return (
    <div className="animate-fade-up">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--text)' }}>Blog Posts</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{posts.filter(p => p.is_published).length} published · {posts.filter(p => !p.is_published).length} drafts</p>
        </div>
        <button onClick={openCreate} className="px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap" style={{ background: 'var(--accent)', color: '#000' }}>+ New Post</button>
      </div>

      {showForm && (
        <div className="rounded-xl p-4 md:p-5 mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>{editing ? 'Edit Post' : 'New Blog Post'}</h3>
          <div className="flex flex-col gap-3">
            <input className="w-full px-3.5 py-2.5 text-sm rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: editing ? form.slug : slugify(e.target.value) })} placeholder="Post title" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input className="px-3.5 py-2.5 text-sm rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
                value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="url-slug" />
              <select className="px-3 py-2.5 text-sm rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)' }}
                value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <textarea className="w-full px-3.5 py-2.5 text-sm rounded-xl resize-none" style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
              value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} placeholder="Short excerpt" rows={2} />
            <textarea className="w-full px-3.5 py-2.5 text-sm rounded-xl font-mono" style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
              value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Post content" rows={10} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input className="px-3.5 py-2.5 text-sm rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
                value={form.author_name} onChange={(e) => setForm({ ...form, author_name: e.target.value })} placeholder="Author name" />
              <input type="number" className="px-3.5 py-2.5 text-sm rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
                value={form.read_time_minutes} onChange={(e) => setForm({ ...form, read_time_minutes: Number(e.target.value) })} placeholder="Read time (min)" />
              <input className="px-3.5 py-2.5 text-sm rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
                value={form.cover_image_url} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })} placeholder="Cover image URL" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} className="w-4 h-4 rounded" />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Publish immediately</span>
            </label>
            <div className="flex gap-2 mt-2">
              <button onClick={handleSave} disabled={saving || !form.title.trim() || !form.content.trim()}
                className="px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-40" style={{ background: 'var(--accent)', color: '#000' }}>
                {saving ? 'Saving...' : editing ? 'Update' : 'Create Post'}
              </button>
              <button onClick={() => { setShowForm(false); setEditing(null); }}
                className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {posts.map((p) => (
          <div key={p.id} className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', opacity: p.is_published ? 1 : 0.6 }}>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                {p.title}
                {!p.is_published && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(107,114,128,0.15)', color: 'var(--text-dim)' }}>DRAFT</span>}
              </h4>
              <p className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>
                /{p.slug} · {p.category} · {p.read_time_minutes} min · by {p.author_name}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => togglePublish(p.id, p.is_published)} className="text-xs px-3 py-1.5 rounded-lg"
                style={{ color: p.is_published ? 'var(--text-dim)' : 'var(--success)', border: `1px solid ${p.is_published ? 'var(--border)' : 'rgba(16,185,129,0.3)'}` }}>
                {p.is_published ? 'Unpublish' : 'Publish'}
              </button>
              <button onClick={() => openEdit(p)} className="text-xs px-3 py-1.5 rounded-lg"
                style={{ color: 'var(--accent)', border: '1px solid rgba(245,158,11,0.3)' }}>Edit</button>
              <button onClick={() => handleDelete(p.id, p.title)} className="text-xs px-3 py-1.5 rounded-lg"
                style={{ color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}