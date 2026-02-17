'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';

const CATEGORIES = ['Technology', 'Finance', 'Leadership', 'Diversity', 'Entrepreneurship', 'Consulting', 'Career Growth', 'Executive'];
const ICONS = ['👥', '💻', '💰', '🏛️', '🚀', '🌍', '🎯', '📈', '🔥', '💡'];

export default function AdminCohortsPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [cohorts, setCohorts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(searchParams.get('action') === 'create');
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '', description: '', category: 'Technology', icon: '👥', max_members: 1000,
  });

  useEffect(() => { loadCohorts(); }, []);

  async function loadCohorts() {
    const { data } = await supabase.from('cohorts').select('*').order('member_count', { ascending: false });
    setCohorts(data || []);
    setLoading(false);
  }

  function openEdit(cohort: any) {
    setForm({
      name: cohort.name, description: cohort.description || '',
      category: cohort.category || 'Technology', icon: cohort.icon || '👥',
      max_members: cohort.max_members || 1000,
    });
    setEditing(cohort);
    setShowForm(true);
  }

  function openCreate() {
    setForm({ name: '', description: '', category: 'Technology', icon: '👥', max_members: 1000 });
    setEditing(null);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);

    if (editing) {
      await supabase.from('cohorts').update(form).eq('id', editing.id);
    } else {
      await supabase.from('cohorts').insert({ ...form, member_count: 0 });
    }

    setSaving(false);
    setShowForm(false);
    setEditing(null);
    loadCohorts();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This removes all posts and members inside it.`)) return;
    await supabase.from('cohorts').delete().eq('id', id);
    loadCohorts();
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="text-2xl mb-2">⏳</div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading cohorts...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold"
            style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
            Manage Cohorts
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{cohorts.length} cohorts</p>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: 'var(--accent)', color: '#000' }}>
          + Create Cohort
        </button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="rounded-xl p-5 mb-6"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>
            {editing ? 'Edit Cohort' : 'New Cohort'}
          </h3>
          <div className="flex flex-col gap-3">
            <input
              className="w-full px-3.5 py-2.5 text-sm rounded-xl"
              style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Cohort name"
            />
            <textarea
              className="w-full px-3.5 py-2.5 text-sm rounded-xl resize-none"
              style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description" rows={2}
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                className="px-3 py-2.5 text-sm rounded-xl"
                style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)' }}
                value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                type="number"
                className="px-3 py-2.5 text-sm rounded-xl"
                style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
                value={form.max_members} onChange={(e) => setForm({ ...form, max_members: Number(e.target.value) })}
                placeholder="Max members"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold mb-1.5 block" style={{ color: 'var(--text-dim)' }}>Icon</label>
              <div className="flex gap-2 flex-wrap">
                {ICONS.map((icon) => (
                  <button key={icon} onClick={() => setForm({ ...form, icon })}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                    style={{
                      background: form.icon === icon ? 'rgba(245,158,11,0.15)' : 'var(--bg-input)',
                      border: form.icon === icon ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                    }}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={handleSave} disabled={saving || !form.name.trim()}
                className="px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#000' }}>
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
              <button onClick={() => { setShowForm(false); setEditing(null); }}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cohorts List */}
      <div className="flex flex-col gap-3">
        {cohorts.map((c) => (
          <div key={c.id} className="rounded-xl p-4 flex items-center gap-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
              style={{ background: 'rgba(245,158,11,0.06)' }}>
              {c.icon || '👥'}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{c.name}</h4>
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                {c.member_count || 0} members · {c.category || 'General'} · Max {c.max_members || 1000}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEdit(c)}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ color: 'var(--accent)', border: '1px solid rgba(245,158,11,0.3)' }}>
                Edit
              </button>
              <button onClick={() => handleDelete(c.id, c.name)}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)' }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
