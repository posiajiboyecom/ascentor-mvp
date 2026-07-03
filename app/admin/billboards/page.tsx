'use client';
export const dynamic = 'force-dynamic';

// app/admin/billboards/page.tsx
// Manage the 3 billboard ad slots in the desktop left rail.
// Each billboard maps to a row in `rail_billboards` (Supabase).
//
// Required Supabase migration (run once):
// ─────────────────────────────────────────────────────────────
// create table if not exists rail_billboards (
//   id           uuid primary key default gen_random_uuid(),
//   slot         int not null check (slot between 1 and 3),
//   title        text not null,
//   body         text,
//   cta_label    text,
//   cta_url      text,
//   bg_color     text default '#161412',
//   accent_color text default '#C8A96E',
//   image_url    text,
//   is_active    boolean default true,
//   sort_order   int default 1,
//   created_at   timestamptz default now()
// );
// alter table rail_billboards enable row level security;
//
// -- Admins/moderators: full access (uses profiles table, NOT jwt role claim)
// create policy "admin_full_access" on rail_billboards for all
//   using (
//     exists (
//       select 1 from profiles
//       where profiles.id = auth.uid()
//       and profiles.role in ('admin', 'moderator')
//     )
//   )
//   with check (
//     exists (
//       select 1 from profiles
//       where profiles.id = auth.uid()
//       and profiles.role in ('admin', 'moderator')
//     )
//   );
//
// -- All authenticated users: read active billboards only
// create policy "users_read_active" on rail_billboards for select
//   using (is_active = true);
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import SageLoader from '@/components/SageLoader';

const supabase = createClient();

type Billboard = {
  id: string;
  slot: number;
  title: string;
  body: string;
  cta_label: string;
  cta_url: string;
  bg_color: string;
  accent_color: string;
  image_url: string;
  is_active: boolean;
  sort_order: number;
};

const EMPTY: Omit<Billboard, 'id'> = {
  slot: 1,
  title: '',
  body: '',
  cta_label: '',
  cta_url: '',
  bg_color: '#161412',
  accent_color: '#C8A96E',
  image_url: '',
  is_active: true,
  sort_order: 1,
};

const PRESETS = [
  { label: 'Gold (default)', bg: '#161412', accent: '#C8A96E' },
  { label: 'Emerald',        bg: '#0D1F14', accent: '#10B981' },
  { label: 'Sapphire',       bg: '#0D1629', accent: '#3B82F6' },
  { label: 'Crimson',        bg: '#1F0D0D', accent: '#EF4444' },
  { label: 'Slate',          bg: '#111827', accent: '#9CA3AF' },
];

const inputCls = "w-full px-3.5 py-2.5 text-sm rounded-xl outline-none";
const inputSt  = { background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)' };
const labelSt: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-dim)',
  display: 'block', marginBottom: 5,
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={labelSt}>{label}</label>{children}</div>;
}

function Preview({ b }: { b: Omit<Billboard, 'id'> }) {
  const bg     = b.bg_color     || '#161412';
  const accent = b.accent_color || '#C8A96E';
  return (
    <div style={{
      borderRadius: 12, overflow: 'hidden',
      border: `1px solid ${accent}33`, background: bg, width: '100%',
    }}>
      <div style={{ height: 2, background: `linear-gradient(90deg,transparent,${accent}88,transparent)` }} />
      {b.image_url && (
        <div style={{ position: 'relative', height: 70, overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={b.image_url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom,transparent 40%,${bg} 100%)` }} />
        </div>
      )}
      <div style={{ padding: b.image_url ? '6px 12px 12px' : '12px' }}>
        {b.title && <p style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px', fontFamily: 'inherit' }}>{b.title}</p>}
        {b.body && <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.65)', margin: '0 0 8px', lineHeight: 1.5, fontFamily: 'inherit' }}>{b.body}</p>}
        {b.cta_label && <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: `${accent}22`, color: accent, border: `1px solid ${accent}44` }}>{b.cta_label} →</span>}
      </div>
    </div>
  );
}

export default function AdminBillboardsPage() {
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<Billboard | null>(null);
  const [form, setForm]             = useState<Omit<Billboard, 'id'>>(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [dbMissing, setDbMissing]   = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error: dbErr } = await supabase
      .from('rail_billboards')
      .select('*')
      .order('sort_order', { ascending: true });

    if (dbErr?.message?.includes('does not exist')) {
      setDbMissing(true);
    } else {
      setBillboards(data ?? []);
    }
    setLoading(false);
  }

  function set(k: string, v: unknown) { setForm((f) => ({ ...f, [k]: v })); }

  function openCreate() {
    setForm(EMPTY); setEditing(null); setError(null); setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openEdit(b: Billboard) {
    setForm({ slot: b.slot, title: b.title, body: b.body ?? '', cta_label: b.cta_label ?? '', cta_url: b.cta_url ?? '', bg_color: b.bg_color, accent_color: b.accent_color, image_url: b.image_url ?? '', is_active: b.is_active, sort_order: b.sort_order });
    setEditing(b); setError(null); setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSave() {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true); setError(null);

    const payload = {
      slot:         Number(form.slot),
      title:        form.title.trim(),
      body:         form.body.trim()       || null,
      cta_label:    form.cta_label.trim()  || null,
      cta_url:      form.cta_url.trim()    || null,
      bg_color:     form.bg_color          || '#161412',
      accent_color: form.accent_color      || '#C8A96E',
      image_url:    form.image_url.trim()  || null,
      is_active:    form.is_active,
      sort_order:   Number(form.sort_order),
    };

    const { error: dbErr } = editing
      ? await supabase.from('rail_billboards').update(payload).eq('id', editing.id)
      : await supabase.from('rail_billboards').insert(payload);

    setSaving(false);
    if (dbErr) { setError('Save failed: ' + dbErr.message); return; }
    setShowForm(false); setEditing(null); load();
  }

  async function toggleActive(b: Billboard) {
    await supabase.from('rail_billboards').update({ is_active: !b.is_active }).eq('id', b.id);
    load();
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    await supabase.from('rail_billboards').delete().eq('id', id);
    load();
  }

  if (loading) return (
    <div className="py-20 text-center"><SageLoader size="sm" />
      <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>Loading billboards…</p>
    </div>
  );

  return (
    <div className="animate-fade-up max-w-3xl">

      {/* Header */}
      <div className="flex justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold" style={{ fontFamily: "var(--font-display,'Plus Jakarta Sans',sans-serif)", color: 'var(--text)' }}>
            Rail Billboards
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Three ad/promo slots in the desktop left rail — premium in-app billboard space.
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
            {billboards.filter(b => b.is_active).length} active · {billboards.length} total
          </p>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap shrink-0"
          style={{ background: 'var(--accent)', color: '#000' }}>
          + New Billboard
        </button>
      </div>

      {/* DB missing notice */}
      {dbMissing && (
        <div className="rounded-xl p-4 mb-6" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#EF4444' }}>Table not found</p>
          <p className="text-xs" style={{ color: '#9CA3AF' }}>
            Run the SQL migration in the comment at the top of this file to create the <code>rail_billboards</code> table in Supabase, then reload this page.
          </p>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="rounded-2xl p-5 mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)' }}>
          <h3 className="text-sm font-bold mb-5" style={{ color: 'var(--text)' }}>
            {editing ? 'Edit Billboard' : 'New Billboard'}
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: fields */}
            <div className="flex flex-col gap-4">

              <div className="grid grid-cols-2 gap-3">
                <Field label="Slot (1–3)">
                  <select className={inputCls} style={{ ...inputSt, cursor: 'pointer' }}
                    value={form.slot} onChange={(e) => set('slot', Number(e.target.value))}>
                    <option value={1}>Slot 1 (top)</option>
                    <option value={2}>Slot 2 (middle)</option>
                    <option value={3}>Slot 3 (bottom)</option>
                  </select>
                </Field>
                <Field label="Sort Order">
                  <input type="number" className={inputCls} style={inputSt}
                    min={1} value={form.sort_order}
                    onChange={(e) => set('sort_order', Number(e.target.value))} />
                </Field>
              </div>

              <Field label="Title *">
                <input className={inputCls} style={inputSt} value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder="e.g. UPGRADE YOUR PLAN" />
              </Field>

              <Field label="Body text">
                <textarea className={inputCls} style={{ ...inputSt, resize: 'none' }} rows={2}
                  value={form.body} onChange={(e) => set('body', e.target.value)}
                  placeholder="Short compelling description…" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="CTA Button Label">
                  <input className={inputCls} style={inputSt} value={form.cta_label}
                    onChange={(e) => set('cta_label', e.target.value)}
                    placeholder="e.g. Upgrade now" />
                </Field>
                <Field label="CTA URL">
                  <input className={inputCls} style={inputSt} value={form.cta_url}
                    onChange={(e) => set('cta_url', e.target.value)}
                    placeholder="/account or https://…" />
                </Field>
              </div>

              <Field label="Image URL (optional)">
                <input className={inputCls} style={inputSt} value={form.image_url}
                  onChange={(e) => set('image_url', e.target.value)}
                  placeholder="https://… (banner image, ~80px tall)" />
              </Field>

              {/* Color presets */}
              <div>
                <label style={labelSt}>Color Theme</label>
                <div className="flex gap-2 flex-wrap mb-3">
                  {PRESETS.map((p) => (
                    <button key={p.label} onClick={() => { set('bg_color', p.bg); set('accent_color', p.accent); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: p.bg, color: p.accent,
                        border: `1px solid ${p.accent}44`,
                        outline: form.bg_color === p.bg ? `2px solid ${p.accent}` : 'none',
                      }}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={{ ...labelSt, marginBottom: 3 }}>Background</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form.bg_color}
                        onChange={(e) => set('bg_color', e.target.value)}
                        style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', padding: 2 }} />
                      <input className={inputCls} style={{ ...inputSt, flex: 1 }} value={form.bg_color}
                        onChange={(e) => set('bg_color', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label style={{ ...labelSt, marginBottom: 3 }}>Accent</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form.accent_color}
                        onChange={(e) => set('accent_color', e.target.value)}
                        style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', padding: 2 }} />
                      <input className={inputCls} style={{ ...inputSt, flex: 1 }} value={form.accent_color}
                        onChange={(e) => set('accent_color', e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => set('is_active', !form.is_active)}
                  style={{
                    width: 40, height: 22, borderRadius: 11, position: 'relative', cursor: 'pointer',
                    background: form.is_active ? 'var(--accent)' : 'var(--border)',
                    transition: 'background 0.2s',
                  }}>
                  <div style={{
                    position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%',
                    background: '#fff', transition: 'left 0.2s',
                    left: form.is_active ? 21 : 3,
                  }} />
                </div>
                <span className="text-sm" style={{ color: 'var(--text)' }}>
                  {form.is_active ? 'Active — showing in rail' : 'Inactive — hidden from rail'}
                </span>
              </label>

              {error && (
                <p className="text-sm px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={handleSave}
                  disabled={saving || !form.title.trim()}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: '#000' }}>
                  {saving ? 'Saving…' : editing ? 'Update' : 'Create Billboard'}
                </button>
                <button onClick={() => { setShowForm(false); setEditing(null); setError(null); }}
                  className="px-4 py-2.5 rounded-xl text-sm"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  Cancel
                </button>
              </div>
            </div>

            {/* Right: live preview */}
            <div>
              <p style={{ ...labelSt, marginBottom: 10 }}>Live Preview</p>
              <div style={{
                background: '#0C0B08', borderRadius: 16, padding: '16px 12px',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <Preview b={form} />
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--text-dim)' }}>
                Shown at 256px wide inside the dark rail.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Billboard list */}
      <div className="flex flex-col gap-3">
        {billboards.map((b) => (
          <div key={b.id} className="rounded-2xl p-4 md:p-5"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Color swatch */}
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: b.bg_color,
                  border: `2px solid ${b.accent_color}`,
                }} />
                <div className="min-w-0">
                  <h4 className="text-sm font-bold truncate" style={{ color: 'var(--text)' }}>
                    {b.title}
                  </h4>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                    Slot {b.slot} · Sort {b.sort_order}
                    {b.cta_url && ` · ${b.cta_url}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    background: b.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.1)',
                    color: b.is_active ? '#10B981' : '#6B7280',
                  }}>
                  {b.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            {b.body && (
              <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {b.body.length > 120 ? b.body.slice(0, 120) + '…' : b.body}
              </p>
            )}

            <div className="flex gap-2 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => openEdit(b)}
                className="text-xs px-3.5 py-1.5 rounded-lg"
                style={{ color: 'var(--accent)', border: '1px solid rgba(200,169,110,0.3)' }}>
                Edit
              </button>
              <button onClick={() => toggleActive(b)}
                className="text-xs px-3.5 py-1.5 rounded-lg"
                style={{
                  color: b.is_active ? '#6B7280' : '#10B981',
                  border: `1px solid ${b.is_active ? 'rgba(107,114,128,0.3)' : 'rgba(16,185,129,0.3)'}`,
                }}>
                {b.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button onClick={() => handleDelete(b.id, b.title)}
                className="text-xs px-3.5 py-1.5 rounded-lg ml-auto"
                style={{ color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                Delete
              </button>
            </div>
          </div>
        ))}

        {billboards.length === 0 && !dbMissing && (
          <div className="text-center py-16 rounded-2xl" style={{ border: '1px dashed var(--border)' }}>
            <p className="text-3xl mb-3">📢</p>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>No billboards yet</p>
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
              Create your first billboard — it will appear in the desktop rail for all members.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
