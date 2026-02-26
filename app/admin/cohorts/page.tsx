'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';

const CATEGORIES = ['Technology', 'Finance', 'Leadership', 'Diversity', 'Entrepreneurship', 'Consulting', 'Career Growth', 'Executive'];
const ICONS = ['👥', '💻', '💰', '🏛️', '🚀', '🌍', '🎯', '📈', '🔥', '💡'];

// Category → palette color mapping
const CATEGORY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  'Technology':       { bg: 'rgba(102,98,255,0.1)',  color: '#6662FF', border: 'rgba(102,98,255,0.25)' },
  'Finance':          { bg: 'rgba(207,255,94,0.1)',  color: '#5E8000', border: 'rgba(207,255,94,0.3)'  },
  'Leadership':       { bg: 'rgba(102,98,255,0.12)', color: '#5550CC', border: 'rgba(166,162,255,0.3)' },
  'Diversity':        { bg: 'rgba(253,129,253,0.1)', color: '#C040C0', border: 'rgba(253,129,253,0.3)' },
  'Entrepreneurship': { bg: 'rgba(207,255,94,0.12)', color: '#5E8000', border: 'rgba(207,255,94,0.35)' },
  'Consulting':       { bg: 'rgba(166,162,255,0.12)',color: '#5550CC', border: 'rgba(166,162,255,0.3)' },
  'Career Growth':    { bg: 'rgba(253,129,253,0.08)',color: '#A030A0', border: 'rgba(253,129,253,0.22)' },
  'Executive':        { bg: 'rgba(102,98,255,0.08)', color: '#A6A2FF', border: 'rgba(166,162,255,0.2)' },
};
function getCat(cat: string) {
  return CATEGORY_COLORS[cat] || { bg: 'rgba(102,98,255,0.08)', color: '#A6A2FF', border: 'rgba(166,162,255,0.2)' };
}

// Cycle icon background through secondary palette
const ICON_BG_CYCLE = [
  'rgba(102,98,255,0.12)',
  'rgba(207,255,94,0.12)',
  'rgba(253,129,253,0.1)',
  'rgba(166,162,255,0.12)',
];

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)', color: 'var(--text)',
  border: '1px solid var(--border)', outline: 'none',
  transition: 'border-color 0.15s',
};

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
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '3px solid rgba(102,98,255,0.15)',
          borderTop: '3px solid #6662FF',
          animation: 'spin 0.9s linear infinite',
          margin: '0 auto 12px',
        }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading cohorts...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const catStyle = getCat(form.category);

  return (
    <div className="animate-fade-up">

      {/* ── Header ── */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold"
            style={{ fontFamily: "'Syne', sans-serif", color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Manage Cohorts
          </h1>
          {/* Stats pill — fuchsia for visual variety */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(253,129,253,0.1)', color: '#C040C0', border: '1px solid rgba(253,129,253,0.25)' }}>
              👥 {cohorts.length} cohort{cohorts.length !== 1 ? 's' : ''}
            </span>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(207,255,94,0.1)', color: '#5E8000', border: '1px solid rgba(207,255,94,0.28)' }}>
              {cohorts.reduce((sum, c) => sum + (c.member_count || 0), 0)} total members
            </span>
          </div>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: '#6662FF', color: '#fff', boxShadow: '0 2px 14px rgba(102,98,255,0.4)' }}>
          + Create Cohort
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

          {/* Form header with gradient accent bar */}
          <div className="flex items-center gap-3 mb-5">
            <div style={{
              width: 4, height: 32, borderRadius: 4,
              background: 'linear-gradient(180deg, #6662FF, #FD81FD)',
            }} />
            <h3 className="text-sm font-bold"
              style={{ fontFamily: "'Syne', sans-serif", color: 'var(--text)', letterSpacing: '-0.01em' }}>
              {editing ? 'Edit Cohort' : 'New Cohort'}
            </h3>
          </div>

          <div className="flex flex-col gap-3">
            {/* Name */}
            <input
              className="w-full px-3.5 py-2.5 text-sm rounded-xl" style={inputStyle}
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Cohort name"
              onFocus={(e) => e.target.style.borderColor = '#6662FF'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />

            {/* Description */}
            <textarea
              className="w-full px-3.5 py-2.5 text-sm rounded-xl resize-none" style={inputStyle}
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description" rows={2}
              onFocus={(e) => e.target.style.borderColor = '#6662FF'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />

            {/* Category + Max members */}
            <div className="grid grid-cols-2 gap-3">
              <select
                className="px-3 py-2.5 text-sm rounded-xl"
                style={{ ...inputStyle, background: 'var(--bg-input)' }}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                type="number" className="px-3 py-2.5 text-sm rounded-xl" style={inputStyle}
                value={form.max_members}
                onChange={(e) => setForm({ ...form, max_members: Number(e.target.value) })}
                placeholder="Max members"
                onFocus={(e) => e.target.style.borderColor = '#6662FF'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* Category preview */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
                Category preview:
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: catStyle.bg, color: catStyle.color, border: `1px solid ${catStyle.border}` }}>
                {form.category}
              </span>
            </div>

            {/* Icon picker */}
            <div>
              <label className="text-[11px] font-bold mb-2 block uppercase tracking-wider"
                style={{ color: 'var(--text-dim)' }}>Icon</label>
              <div className="flex gap-2 flex-wrap">
                {ICONS.map((icon, idx) => {
                  const isSelected = form.icon === icon;
                  const cycleBg = ICON_BG_CYCLE[idx % ICON_BG_CYCLE.length];
                  return (
                    <button key={icon} onClick={() => setForm({ ...form, icon })}
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all"
                      style={{
                        background: isSelected ? cycleBg : 'var(--bg-input)',
                        border: isSelected ? `1.5px solid ${catStyle.color}` : '1px solid var(--border)',
                        transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                        boxShadow: isSelected ? `0 0 0 3px ${catStyle.bg}` : 'none',
                      }}>
                      {icon}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={handleSave} disabled={saving || !form.name.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all"
                style={{ background: '#6662FF', color: '#fff', boxShadow: '0 2px 12px rgba(102,98,255,0.4)' }}>
                {saving ? 'Saving...' : editing ? 'Update Cohort' : 'Create Cohort'}
              </button>
              <button onClick={() => { setShowForm(false); setEditing(null); }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cohorts List ── */}
      {cohorts.length === 0 ? (
        <div className="text-center py-16 rounded-2xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'rgba(253,129,253,0.1)', border: '1.5px solid rgba(253,129,253,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px', fontSize: 22,
          }}>👥</div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>No cohorts yet</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>Click "Create Cohort" to get started</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {cohorts.map((c, idx) => {
            const cat = getCat(c.category || 'Technology');
            const iconBg = ICON_BG_CYCLE[idx % ICON_BG_CYCLE.length];
            const fillPct = Math.min(100, Math.round(((c.member_count || 0) / (c.max_members || 1000)) * 100));

            return (
              <div key={c.id}
                className="rounded-2xl p-4 flex items-center gap-4 transition-all group"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

                {/* Icon — cycling background color */}
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 transition-all"
                  style={{ background: iconBg }}>
                  {c.icon || '👥'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold"
                      style={{ fontFamily: "'Syne', sans-serif", color: 'var(--text)' }}>
                      {c.name}
                    </h4>
                    {/* Category badge — palette color */}
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: cat.bg, color: cat.color, border: `1px solid ${cat.border}` }}>
                      {c.category || 'General'}
                    </span>
                  </div>

                  {/* Member count + capacity bar */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                      style={{ background: 'var(--bg-input)', maxWidth: 120 }}>
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${fillPct}%`,
                        background: fillPct >= 80
                          ? '#FD81FD'   // fuchsia — nearly full
                          : fillPct >= 50
                          ? '#CFFF5E'   // green-yellow — half full
                          : '#6662FF',  // brand purple — lots of space
                      }} />
                    </div>
                    <span className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                      {c.member_count || 0} / {c.max_members || 1000} members
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEdit(c)}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                    style={{ color: '#6662FF', border: '1px solid rgba(102,98,255,0.3)', background: 'rgba(102,98,255,0.06)' }}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(c.id, c.name)}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                    style={{ color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.04)' }}>
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
