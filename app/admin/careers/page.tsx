'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ============================================================
// ADMIN CAREERS — /admin/careers
// Create, edit, publish/unpublish, and delete job listings
// Ascentor brand: Dark var(--admin-bg) · Gold #E8A020 · Syne · DM Mono · Cormorant Garamond
// ============================================================

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  mode: string;
  description: string;
  requirements: string[];
  nice_to_have: string[];
  apply_url: string | null;
  apply_email: string | null;
  is_active: boolean;
  created_at: string;
}

const DEPARTMENTS = ['Engineering', 'Product', 'Design', 'Marketing', 'Operations', 'Content', 'Partnerships'];
const JOB_TYPES   = ['Full-time', 'Part-time', 'Contract', 'Internship'];
const JOB_MODES   = ['Remote', 'Hybrid', 'On-site'];

const EMPTY_FORM = {
  title: '',
  department: 'Engineering',
  location: 'Remote — Africa',
  type: 'Full-time',
  mode: 'Remote',
  description: '',
  requirements: [''],
  nice_to_have: [''],
  apply_url: '',
  apply_email: '',
  is_active: true,
};

export default function AdminCareersPage() {
  const supabase = createClient();

  const [jobs,    setJobs]    = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<'listings' | 'create' | 'edit'>('listings');
  const [editing, setEditing] = useState<Job | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null);
  const [form,    setForm]    = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('job_listings')
      .select('*')
      .order('created_at', { ascending: false });
    setJobs(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setEditing(null);
    setTab('create');
    setMsg(null);
  }

  function openEdit(job: Job) {
    setForm({
      title:        job.title,
      department:   job.department,
      location:     job.location,
      type:         job.type,
      mode:         job.mode,
      description:  job.description,
      requirements: job.requirements?.length ? job.requirements : [''],
      nice_to_have: job.nice_to_have?.length ? job.nice_to_have : [''],
      apply_url:    job.apply_url || '',
      apply_email:  job.apply_email || '',
      is_active:    job.is_active,
    });
    setEditing(job);
    setTab('edit');
    setMsg(null);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.description.trim()) {
      setMsg({ text: 'Title and description are required.', ok: false });
      return;
    }
    setSaving(true);
    setMsg(null);

    const payload = {
      title:        form.title.trim(),
      department:   form.department,
      location:     form.location.trim(),
      type:         form.type,
      mode:         form.mode,
      description:  form.description.trim(),
      requirements: form.requirements.filter(r => r.trim()),
      nice_to_have: form.nice_to_have.filter(r => r.trim()),
      apply_url:    form.apply_url.trim() || null,
      apply_email:  form.apply_email.trim() || null,
      is_active:    form.is_active,
      updated_at:   new Date().toISOString(),
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from('job_listings').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('job_listings').insert(payload));
    }

    if (error) {
      setMsg({ text: `Error: ${error.message}`, ok: false });
    } else {
      setMsg({ text: editing ? 'Role updated.' : 'Role created and live.', ok: true });
      fetchJobs();
      setTimeout(() => { setTab('listings'); setMsg(null); }, 1200);
    }
    setSaving(false);
  }

  async function toggleActive(job: Job) {
    await supabase.from('job_listings').update({ is_active: !job.is_active }).eq('id', job.id);
    fetchJobs();
  }

  async function deleteJob(job: Job) {
    if (!confirm(`Delete "${job.title}"? This cannot be undone.`)) return;
    await supabase.from('job_listings').delete().eq('id', job.id);
    fetchJobs();
  }

  // ── Shared style tokens ────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: 'var(--admin-bg-deep)', border: '1px solid var(--admin-bg-input)', borderRadius: 12,
  };
  const inputBase: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: '1px solid var(--admin-bg-input)', background: 'var(--admin-bg-card)',
    color: 'var(--admin-text)', fontSize: 13,
    fontFamily: "'Syne', sans-serif", outline: 'none',
  };
  const label: React.CSSProperties = {
    fontFamily: "'DM Mono', monospace", fontSize: 10,
    letterSpacing: '0.1em', textTransform: 'uppercase' as const,
    color: 'var(--admin-text-faint)', display: 'block', marginBottom: 6,
  };
  const monoTag = (text: string, gold = false) => (
    <span style={{
      fontFamily: "'DM Mono', monospace", fontSize: 9,
      letterSpacing: '0.1em', textTransform: 'uppercase' as const,
      color: gold ? '#E8A020' : 'var(--admin-text-muted)',
      padding: '2px 8px',
      background: gold ? 'rgba(232,160,32,0.08)' : 'var(--admin-bg-card)',
      border: `1px solid ${gold ? 'rgba(232,160,32,0.2)' : 'var(--admin-bg-input)'}`,
      borderRadius: 100,
    }}>{text}</span>
  );

  // ── List item actions ──────────────────────────────────────────────────────
  const ActionBtn = ({ onClick, color, children }: { onClick: () => void; color: string; children: React.ReactNode }) => (
    <button onClick={onClick} style={{
      padding: '4px 12px', borderRadius: 6, border: `1px solid ${color}20`,
      background: 'transparent', color, cursor: 'pointer',
      fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 600,
      transition: 'background 0.15s',
    }}>
      {children}
    </button>
  );

  // ── Repeating list field (requirements / nice to have) ────────────────────
  const ListField = ({
    label: lbl, value, onChange,
  }: { label: string; value: string[]; onChange: (v: string[]) => void }) => (
    <div>
      <span style={label}>{lbl}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {value.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 6 }}>
            <input
              value={item}
              onChange={e => { const n = [...value]; n[i] = e.target.value; onChange(n); }}
              placeholder={`Item ${i + 1}`}
              style={{ ...inputBase, flex: 1 }}
            />
            <button
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              style={{
                padding: '0 10px', borderRadius: 6,
                border: '1px solid rgba(239,68,68,0.2)',
                background: 'transparent', color: '#EF4444',
                cursor: 'pointer', fontSize: 14, fontWeight: 700,
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={() => onChange([...value, ''])}
          style={{
            padding: '7px 14px', borderRadius: 6, border: '1px dashed var(--admin-bg-input)',
            background: 'transparent', color: 'var(--admin-text-faint)', cursor: 'pointer',
            fontFamily: "'DM Mono', monospace", fontSize: 10,
            letterSpacing: '0.08em', textTransform: 'uppercase' as const,
            textAlign: 'left' as const,
          }}
        >
          + Add item
        </button>
      </div>
    </div>
  );

  // ── Form (shared for create + edit) ───────────────────────────────────────
  const JobForm = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Title */}
      <div>
        <span style={label}>Job Title *</span>
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="e.g. Senior Frontend Engineer" style={inputBase} />
      </div>

      {/* Row: dept + type + mode */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <span style={label}>Department</span>
          <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
            style={{ ...inputBase, cursor: 'pointer' }}>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <span style={label}>Job Type</span>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            style={{ ...inputBase, cursor: 'pointer' }}>
            {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <span style={label}>Work Mode</span>
          <select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}
            style={{ ...inputBase, cursor: 'pointer' }}>
            {JOB_MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Location */}
      <div>
        <span style={label}>Location</span>
        <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
          placeholder="e.g. Remote — Africa" style={inputBase} />
      </div>

      {/* Description */}
      <div>
        <span style={label}>Description *</span>
        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Describe the role, team, and impact..." rows={5}
          style={{ ...inputBase, resize: 'vertical', lineHeight: 1.6 }} />
      </div>

      {/* Requirements */}
      <ListField
        label="Requirements"
        value={form.requirements}
        onChange={v => setForm(f => ({ ...f, requirements: v }))}
      />

      {/* Nice to have */}
      <ListField
        label="Nice to Have"
        value={form.nice_to_have}
        onChange={v => setForm(f => ({ ...f, nice_to_have: v }))}
      />

      {/* Apply URL / Email */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <span style={label}>Application URL</span>
          <input value={form.apply_url} onChange={e => setForm(f => ({ ...f, apply_url: e.target.value }))}
            placeholder="https://..." style={inputBase} />
        </div>
        <div>
          <span style={label}>Application Email</span>
          <input value={form.apply_email} onChange={e => setForm(f => ({ ...f, apply_email: e.target.value }))}
            placeholder="careers@ascentor.co" style={inputBase} />
        </div>
      </div>

      {/* Publish toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 10,
          cursor: 'pointer', userSelect: 'none',
        }}>
          <div
            onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
            style={{
              width: 40, height: 22, borderRadius: 100,
              background: form.is_active ? '#E8A020' : 'var(--admin-bg-input)',
              position: 'relative', transition: 'background 0.2s', cursor: 'pointer',
            }}
          >
            <div style={{
              position: 'absolute', top: 3, left: form.is_active ? 21 : 3,
              width: 16, height: 16, borderRadius: '50%',
              background: form.is_active ? 'var(--admin-bg)' : 'var(--admin-text-faint)',
              transition: 'left 0.2s',
            }} />
          </div>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, color: 'var(--admin-text)' }}>
            {form.is_active ? 'Published — visible on /careers' : 'Draft — hidden from public'}
          </span>
        </label>
      </div>

      {/* Status message */}
      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          background: msg.ok ? 'rgba(20,184,166,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${msg.ok ? 'rgba(20,184,166,0.2)' : 'rgba(239,68,68,0.2)'}`,
          color: msg.ok ? '#14B8A6' : '#EF4444',
          fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: '0.06em',
        }}>
          {msg.text}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
        <button onClick={handleSave} disabled={saving} style={{
          padding: '11px 24px', borderRadius: 8, border: 'none',
          background: '#E8A020', color: 'var(--admin-bg)',
          fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13,
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.5 : 1,
        }}>
          {saving ? 'Saving...' : editing ? 'Update Role' : 'Publish Role'}
        </button>
        <button onClick={() => { setTab('listings'); setMsg(null); }} style={{
          padding: '11px 20px', borderRadius: 8,
          border: '1px solid var(--admin-bg-input)', background: 'transparent',
          color: 'var(--admin-text-muted)', fontFamily: "'Syne', sans-serif",
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ animation: 'asc-fade-up 0.35s ease both' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        @keyframes asc-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        select option { background: var(--admin-bg-card); color: var(--admin-text); }
        input:focus, textarea:focus, select:focus { border-color: #E8A020 !important; }
      `}</style>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif", fontSize: 28,
          fontWeight: 700, color: '#FEF9EC', margin: 0, lineHeight: 1.1,
        }}>
          Careers
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/careers" target="_blank" rel="noopener noreferrer" style={{
            padding: '8px 16px', borderRadius: 8,
            border: '1px solid var(--admin-bg-input)', background: 'transparent',
            color: 'var(--admin-text-muted)', fontFamily: "'DM Mono', monospace",
            fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
            cursor: 'pointer', textDecoration: 'none',
          }}>
            View Page ↗
          </a>
          {tab === 'listings' && (
            <button onClick={openCreate} style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: '#E8A020', color: 'var(--admin-bg)',
              fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13,
              cursor: 'pointer',
            }}>
              + New Role
            </button>
          )}
        </div>
      </div>
      <p style={{
        fontFamily: "'DM Mono', monospace", fontSize: 10,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'var(--admin-text-faint)', marginBottom: 24,
      }}>
        {jobs.filter(j => j.is_active).length} published · {jobs.filter(j => !j.is_active).length} drafts
      </p>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      {(tab === 'create' || tab === 'edit') && (
        <div style={{
          display: 'flex', gap: 2, marginBottom: 20,
          padding: 4, background: 'var(--admin-bg-card)',
          borderRadius: 10, border: '1px solid var(--admin-bg-input)',
          width: 'fit-content',
        }}>
          {[
            { key: 'listings', label: 'All Roles' },
            { key: tab,        label: tab === 'create' ? 'New Role' : `Editing: ${editing?.title.slice(0, 24)}...` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)} style={{
              padding: '7px 16px', borderRadius: 7, border: 'none',
              background: tab === t.key ? 'var(--admin-bg-deep)' : 'transparent',
              color: tab === t.key ? '#E8A020' : 'var(--admin-text-faint)',
              fontFamily: "'DM Mono', monospace", fontSize: 10,
              letterSpacing: '0.1em', textTransform: 'uppercase' as const,
              cursor: 'pointer', whiteSpace: 'nowrap' as const,
            }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Listings tab ────────────────────────────────────────────────── */}
      {tab === 'listings' && (
        loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', margin: '0 auto',
              border: '2px solid var(--admin-bg-input)', borderTopColor: '#E8A020',
              animation: 'asc-spin 0.8s linear infinite',
            }} />
            <style>{`@keyframes asc-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ ...card, padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, color: 'var(--admin-text-faint)', margin: 0 }}>
              No job listings yet. Create one to get started.
            </p>
          </div>
        ) : (
          <div style={{ ...card, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 120px 100px 80px 120px',
              padding: '10px 20px', borderBottom: '1px solid var(--admin-bg-input)',
            }}>
              {['Role', 'Department', 'Type', 'Mode', 'Actions'].map(h => (
                <span key={h} style={{
                  fontFamily: "'DM Mono', monospace", fontSize: 9,
                  letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--admin-text-faint)',
                }}>{h}</span>
              ))}
            </div>

            {jobs.map(job => (
              <div key={job.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 120px 100px 80px 120px',
                padding: '14px 20px', borderBottom: '1px solid var(--admin-bg-input)',
                alignItems: 'center', opacity: job.is_active ? 1 : 0.5,
                transition: 'background 0.15s',
              }}>
                {/* Title + status */}
                <div>
                  <p style={{
                    fontFamily: "'Syne', sans-serif", fontSize: 14,
                    fontWeight: 600, color: '#FEF9EC', margin: '0 0 4px',
                  }}>
                    {job.title}
                  </p>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {monoTag(job.is_active ? 'Live' : 'Draft', job.is_active)}
                    <span style={{
                      fontFamily: "'DM Mono', monospace", fontSize: 9,
                      color: 'var(--admin-text-faint)', letterSpacing: '0.06em',
                    }}>
                      {job.location}
                    </span>
                  </div>
                </div>

                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--admin-text-muted)', letterSpacing: '0.06em' }}>
                  {job.department}
                </span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--admin-text-muted)' }}>
                  {job.type}
                </span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--admin-text-muted)' }}>
                  {job.mode}
                </span>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <ActionBtn onClick={() => openEdit(job)} color="#E8A020">Edit</ActionBtn>
                  <ActionBtn onClick={() => toggleActive(job)} color={job.is_active ? 'var(--admin-text-muted)' : '#14B8A6'}>
                    {job.is_active ? 'Unpublish' : 'Publish'}
                  </ActionBtn>
                  <ActionBtn onClick={() => deleteJob(job)} color="#EF4444">Delete</ActionBtn>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Create / Edit tab ───────────────────────────────────────────── */}
      {(tab === 'create' || tab === 'edit') && (
        <div style={{ ...card, padding: 24 }}>
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif", fontSize: 22,
            fontWeight: 700, color: '#FEF9EC', margin: '0 0 24px',
          }}>
            {tab === 'create' ? 'New Role' : `Editing: ${editing?.title}`}
          </h2>
          <JobForm />
        </div>
      )}
    </div>
  );
}
