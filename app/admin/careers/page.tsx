'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ============================================================
// ADMIN CAREERS — /admin/careers
// Manage job listings + review applications
// ============================================================

interface Job {
  id: string; title: string; department: string; location: string;
  type: string; mode: string; description: string;
  requirements: string[]; nice_to_have: string[];
  apply_url: string | null; apply_email: string | null;
  is_active: boolean; created_at: string;
}

interface Application {
  id: string; job_id: string; job_title: string; department: string;
  full_name: string; email: string; phone: string | null;
  location: string | null; linkedin_url: string | null; portfolio_url: string | null;
  cover_letter: string; years_experience: string | null; how_did_you_hear: string | null;
  cv_url: string | null; cv_filename: string | null;
  status: 'new' | 'reviewing' | 'shortlisted' | 'rejected' | 'hired';
  created_at: string;
}

type FormState = {
  title: string; department: string; location: string;
  type: string; mode: string; description: string;
  requirements: string[]; nice_to_have: string[];
  apply_url: string; apply_email: string; is_active: boolean;
};

const APP_STATUSES = ['new', 'reviewing', 'shortlisted', 'rejected', 'hired'] as const;
const STATUS_COLOR: Record<string, string> = {
  new: '#E8A020', reviewing: '#14B8A6', shortlisted: '#8B5CF6',
  rejected: '#EF4444', hired: '#22C55E',
};
const DEPARTMENTS = ['Engineering', 'Product', 'Design', 'Marketing', 'Operations', 'Content', 'Partnerships'];
const JOB_TYPES   = ['Full-time', 'Part-time', 'Contract', 'Internship'];
const JOB_MODES   = ['Remote', 'Hybrid', 'On-site'];
const EMPTY_FORM: FormState = {
  title: '', department: 'Engineering', location: 'Remote / Worldwide',
  type: 'Full-time', mode: 'Remote', description: '',
  requirements: [''], nice_to_have: [''],
  apply_url: '', apply_email: '', is_active: true,
};

// ── Shared style constants (module-level so they never re-create) ─────────────
const INPUT_BASE: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: '1px solid var(--admin-bg-input)', background: 'var(--admin-bg-card)',
  color: 'var(--admin-text)', fontSize: 13,
  fontFamily: "'Syne', sans-serif", outline: 'none', boxSizing: 'border-box',
};
const LABEL_STYLE: React.CSSProperties = {
  fontFamily: "'DM Mono', monospace", fontSize: 10,
  letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--admin-text-faint)', display: 'block', marginBottom: 6,
};
const CARD_STYLE: React.CSSProperties = {
  background: 'var(--admin-bg-deep)', border: '1px solid var(--admin-bg-input)', borderRadius: 12,
};

// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS — defined OUTSIDE the page component so React never remounts
// them on state changes (which would kill input focus on every keystroke).
// ══════════════════════════════════════════════════════════════════════════════

function ActionBtn({ onClick, color, children }: { onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 12px', borderRadius: 6, border: `1px solid ${color}30`,
      background: 'transparent', color, cursor: 'pointer',
      fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 600,
    }}>
      {children}
    </button>
  );
}

function MonoTag({ text, gold }: { text: string; gold?: boolean }) {
  return (
    <span style={{
      fontFamily: "'DM Mono', monospace", fontSize: 9,
      letterSpacing: '0.1em', textTransform: 'uppercase',
      color: gold ? '#E8A020' : 'var(--admin-text-muted)',
      padding: '2px 8px',
      background: gold ? 'rgba(232,160,32,0.08)' : 'var(--admin-bg-card)',
      border: `1px solid ${gold ? 'rgba(232,160,32,0.2)' : 'var(--admin-bg-input)'}`,
      borderRadius: 100,
    }}>{text}</span>
  );
}

// ── ListField: repeating text-input list (requirements / nice-to-have) ────────
function ListField({ label, value, onChange }: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div>
      <span style={LABEL_STYLE}>{label}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {value.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 6 }}>
            <input
              value={item}
              onChange={e => {
                const next = [...value];
                next[i] = e.target.value;
                onChange(next);
              }}
              placeholder={`Item ${i + 1}`}
              style={{ ...INPUT_BASE, flex: 1 }}
            />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              style={{
                padding: '0 12px', borderRadius: 6,
                border: '1px solid rgba(239,68,68,0.2)',
                background: 'transparent', color: '#EF4444',
                cursor: 'pointer', fontSize: 16, fontWeight: 700, flexShrink: 0,
              }}
            >×</button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...value, ''])}
          style={{
            padding: '7px 14px', borderRadius: 6,
            border: '1px dashed var(--admin-bg-input)',
            background: 'transparent', color: 'var(--admin-text-faint)',
            cursor: 'pointer', fontFamily: "'DM Mono', monospace",
            fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
            textAlign: 'left',
          }}
        >+ Add item</button>
      </div>
    </div>
  );
}

// ── JobForm: the create / edit form ──────────────────────────────────────────
function JobForm({ form, setForm, onSave, onCancel, saving, msg }: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  msg: { text: string; ok: boolean } | null;
}) {
  const set = (key: keyof FormState, val: any) =>
    setForm(f => ({ ...f, [key]: val }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Title */}
      <div>
        <span style={LABEL_STYLE}>Job Title *</span>
        <input
          value={form.title}
          onChange={e => set('title', e.target.value)}
          placeholder="e.g. Senior Frontend Engineer"
          style={INPUT_BASE}
        />
      </div>

      {/* Dept / Type / Mode */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <span style={LABEL_STYLE}>Department</span>
          <select value={form.department} onChange={e => set('department', e.target.value)}
            style={{ ...INPUT_BASE, cursor: 'pointer' }}>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <span style={LABEL_STYLE}>Job Type</span>
          <select value={form.type} onChange={e => set('type', e.target.value)}
            style={{ ...INPUT_BASE, cursor: 'pointer' }}>
            {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <span style={LABEL_STYLE}>Work Mode</span>
          <select value={form.mode} onChange={e => set('mode', e.target.value)}
            style={{ ...INPUT_BASE, cursor: 'pointer' }}>
            {JOB_MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Location */}
      <div>
        <span style={LABEL_STYLE}>Location</span>
        <input
          value={form.location}
          onChange={e => set('location', e.target.value)}
          placeholder="e.g. Remote or Lagos, Nigeria"
          style={INPUT_BASE}
        />
      </div>

      {/* Description */}
      <div>
        <span style={LABEL_STYLE}>Description *</span>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Describe the role, the team, and the impact..."
          rows={6}
          style={{ ...INPUT_BASE, resize: 'vertical', lineHeight: 1.7 }}
        />
      </div>

      {/* Requirements */}
      <ListField
        label="Requirements"
        value={form.requirements}
        onChange={v => set('requirements', v)}
      />

      {/* Nice to have */}
      <ListField
        label="Nice to Have"
        value={form.nice_to_have}
        onChange={v => set('nice_to_have', v)}
      />

      {/* Apply URL / Email */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <span style={LABEL_STYLE}>Application URL (optional)</span>
          <input
            value={form.apply_url}
            onChange={e => set('apply_url', e.target.value)}
            placeholder="https://..."
            style={INPUT_BASE}
          />
        </div>
        <div>
          <span style={LABEL_STYLE}>Application Email (optional)</span>
          <input
            value={form.apply_email}
            onChange={e => set('apply_email', e.target.value)}
            placeholder="careers@ascentorbi.com"
            style={INPUT_BASE}
          />
        </div>
      </div>

      {/* Publish toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          onClick={() => set('is_active', !form.is_active)}
          style={{
            width: 40, height: 22, borderRadius: 100, flexShrink: 0,
            background: form.is_active ? '#E8A020' : 'var(--admin-bg-input)',
            position: 'relative', transition: 'background 0.2s', cursor: 'pointer',
          }}
        >
          <div style={{
            position: 'absolute', top: 3,
            left: form.is_active ? 21 : 3,
            width: 16, height: 16, borderRadius: '50%',
            background: form.is_active ? 'var(--admin-bg)' : 'var(--admin-text-faint)',
            transition: 'left 0.2s',
          }} />
        </div>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, color: 'var(--admin-text)' }}>
          {form.is_active ? 'Published — visible on /careers' : 'Draft — hidden from public'}
        </span>
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
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          style={{
            padding: '11px 24px', borderRadius: 8, border: 'none',
            background: '#E8A020', color: 'var(--admin-bg)',
            fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save Role'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '11px 20px', borderRadius: 8,
            border: '1px solid var(--admin-bg-input)', background: 'transparent',
            color: 'var(--admin-text-muted)', fontFamily: "'Syne', sans-serif",
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function AdminCareersPage() {
  const supabase = createClient();

  const [jobs,         setJobs]         = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [appsLoading,  setAppsLoading]  = useState(false);
  const [mainTab,      setMainTab]      = useState<'listings' | 'applications'>('listings');
  const [tab,          setTab]          = useState<'listings' | 'create' | 'edit'>('listings');
  const [editing,      setEditing]      = useState<Job | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [msg,          setMsg]          = useState<{ text: string; ok: boolean } | null>(null);
  const [form,         setForm]         = useState<FormState>({ ...EMPTY_FORM });
  const [expandedApp,  setExpandedApp]  = useState<string | null>(null);
  const [filterJob,    setFilterJob]    = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('job_listings').select('*').order('created_at', { ascending: false });
    setJobs(data || []);
    setLoading(false);
  }, [supabase]);

  const fetchApplications = useCallback(async () => {
    setAppsLoading(true);
    const { data } = await supabase.from('job_applications').select('*').order('created_at', { ascending: false });
    setApplications(data || []);
    setAppsLoading(false);
  }, [supabase]);

  useEffect(() => { fetchJobs(); fetchApplications(); }, [fetchJobs, fetchApplications]);

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
      setMsg({ text: editing ? 'Role updated.' : 'Role created.', ok: true });
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

  async function updateAppStatus(id: string, status: string) {
    await supabase.from('job_applications').update({ status }).eq('id', id);
    fetchApplications();
  }

  async function deleteApp(id: string) {
    if (!confirm('Delete this application? This cannot be undone.')) return;
    await supabase.from('job_applications').delete().eq('id', id);
    fetchApplications();
  }

  const filteredApps = applications.filter(a =>
    (filterJob === 'all' || a.job_id === filterJob) &&
    (filterStatus === 'all' || a.status === filterStatus)
  );

  return (
    <div style={{ animation: 'asc-fade-up 0.35s ease both' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        @keyframes asc-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes asc-spin { to { transform: rotate(360deg); } }
        select option { background: var(--admin-bg-card); color: var(--admin-text); }
        input:focus, textarea:focus, select:focus { border-color: rgba(232,160,32,0.6) !important; }
        .app-row:hover { background: var(--admin-bg-card) !important; }
      `}</style>

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 700, color: 'var(--admin-text-heading)', margin: 0 }}>
          Careers
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/careers" target="_blank" rel="noopener noreferrer" style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid var(--admin-bg-input)',
            background: 'transparent', color: 'var(--admin-text-muted)',
            fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.1em',
            textTransform: 'uppercase', textDecoration: 'none',
          }}>View Page ↗</a>
          {mainTab === 'listings' && tab === 'listings' && (
            <button onClick={openCreate} style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: '#E8A020', color: 'var(--admin-bg)',
              fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>+ New Role</button>
          )}
        </div>
      </div>

      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--admin-text-faint)', marginBottom: 20 }}>
        {jobs.filter(j => j.is_active).length} published · {jobs.filter(j => !j.is_active).length} drafts · {applications.length} applications
      </p>

      {/* ── Main tabs (Listings | Applications) ─────────────────────────────── */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, padding: 4, background: 'var(--admin-bg-card)', borderRadius: 10, border: '1px solid var(--admin-bg-input)', width: 'fit-content' }}>
        {[
          { key: 'listings',     label: `Listings (${jobs.length})` },
          { key: 'applications', label: `Applications (${applications.filter(a => a.status === 'new').length} new)` },
        ].map(t => (
          <button key={t.key} onClick={() => { setMainTab(t.key as any); setTab('listings'); }} style={{
            padding: '7px 18px', borderRadius: 7, border: 'none',
            background: mainTab === t.key ? 'var(--admin-bg-deep)' : 'transparent',
            color: mainTab === t.key ? '#E8A020' : 'var(--admin-text-faint)',
            fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.1em',
            textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          LISTINGS TAB
      ═══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'listings' && (
        <>
          {/* Sub-tab bar for create / edit mode */}
          {(tab === 'create' || tab === 'edit') && (
            <div style={{ display: 'flex', gap: 2, marginBottom: 20, padding: 4, background: 'var(--admin-bg-card)', borderRadius: 10, border: '1px solid var(--admin-bg-input)', width: 'fit-content' }}>
              {[
                { key: 'listings', label: 'All Roles' },
                { key: tab, label: tab === 'create' ? 'New Role' : `Editing: ${editing?.title.slice(0, 22)}…` },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key as any)} style={{
                  padding: '7px 16px', borderRadius: 7, border: 'none',
                  background: tab === t.key ? 'var(--admin-bg-deep)' : 'transparent',
                  color: tab === t.key ? '#E8A020' : 'var(--admin-text-faint)',
                  fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.1em',
                  textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap',
                }}>{t.label}</button>
              ))}
            </div>
          )}

          {/* Listings table */}
          {tab === 'listings' && (
            loading ? (
              <div style={{ padding: '48px 0', textAlign: 'center' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', margin: '0 auto', border: '2px solid var(--admin-bg-input)', borderTopColor: '#E8A020', animation: 'asc-spin 0.8s linear infinite' }} />
              </div>
            ) : jobs.length === 0 ? (
              <div style={{ ...CARD_STYLE, padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, color: 'var(--admin-text-faint)', margin: 0 }}>No job listings yet. Create one to get started.</p>
              </div>
            ) : (
              <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 110px 90px 160px', padding: '10px 20px', borderBottom: '1px solid var(--admin-bg-input)' }}>
                  {['Role', 'Department', 'Type', 'Mode', 'Actions'].map(h => (
                    <span key={h} style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--admin-text-faint)' }}>{h}</span>
                  ))}
                </div>
                {jobs.map(job => {
                  const appCount = applications.filter(a => a.job_id === job.id).length;
                  return (
                    <div key={job.id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 110px 90px 160px', padding: '14px 20px', borderBottom: '1px solid var(--admin-bg-input)', alignItems: 'center', opacity: job.is_active ? 1 : 0.55 }}>
                      <div>
                        <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 600, color: 'var(--admin-text-heading)', margin: '0 0 5px' }}>{job.title}</p>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <MonoTag text={job.is_active ? 'Live' : 'Draft'} gold={job.is_active} />
                          {appCount > 0 && (
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#8B5CF6', padding: '2px 8px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 100 }}>
                              {appCount} application{appCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--admin-text-muted)' }}>{job.department}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--admin-text-muted)' }}>{job.type}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--admin-text-muted)' }}>{job.mode}</span>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <ActionBtn onClick={() => openEdit(job)} color="#E8A020">Edit</ActionBtn>
                        <ActionBtn onClick={() => toggleActive(job)} color={job.is_active ? 'var(--admin-text-muted)' : '#14B8A6'}>
                          {job.is_active ? 'Unpublish' : 'Publish'}
                        </ActionBtn>
                        <ActionBtn onClick={() => deleteJob(job)} color="#EF4444">Delete</ActionBtn>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Create / Edit form — JobForm is a stable external component */}
          {(tab === 'create' || tab === 'edit') && (
            <div style={{ ...CARD_STYLE, padding: 28 }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, color: 'var(--admin-text-heading)', margin: '0 0 24px' }}>
                {tab === 'create' ? 'New Role' : `Editing: ${editing?.title}`}
              </h2>
              <JobForm
                form={form}
                setForm={setForm}
                onSave={handleSave}
                onCancel={() => { setTab('listings'); setMsg(null); }}
                saving={saving}
                msg={msg}
              />
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          APPLICATIONS TAB
      ═══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'applications' && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <select value={filterJob} onChange={e => setFilterJob(e.target.value)}
              style={{ ...INPUT_BASE, width: 'auto', padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}>
              <option value="all">All Roles</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ ...INPUT_BASE, width: 'auto', padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}>
              <option value="all">All Statuses</option>
              {APP_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>

          {appsLoading ? (
            <div style={{ padding: '48px 0', textAlign: 'center' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', margin: '0 auto', border: '2px solid var(--admin-bg-input)', borderTopColor: '#E8A020', animation: 'asc-spin 0.8s linear infinite' }} />
            </div>
          ) : filteredApps.length === 0 ? (
            <div style={{ ...CARD_STYLE, padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, color: 'var(--admin-text-faint)', margin: 0 }}>No applications yet.</p>
            </div>
          ) : (
            <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
              {filteredApps.map((app, i) => (
                <div key={app.id} style={{ borderBottom: i < filteredApps.length - 1 ? '1px solid var(--admin-bg-input)' : 'none' }}>
                  {/* Row */}
                  <div className="app-row"
                    onClick={() => setExpandedApp(expandedApp === app.id ? null : app.id)}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 180px 110px 130px', padding: '14px 20px', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'background 0.15s' }}>
                    <div>
                      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--admin-text-heading)', margin: '0 0 3px' }}>{app.full_name}</p>
                      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--admin-text-muted)', margin: 0 }}>{app.email}</p>
                    </div>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--admin-text-muted)' }}>{app.job_title}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: 'var(--admin-text-faint)' }}>
                      {new Date(app.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: STATUS_COLOR[app.status], padding: '2px 8px',
                        background: `${STATUS_COLOR[app.status]}14`, border: `1px solid ${STATUS_COLOR[app.status]}30`, borderRadius: 100,
                      }}>{app.status}</span>
                      <span style={{ color: 'var(--admin-text-faint)', fontSize: 11 }}>{expandedApp === app.id ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Expanded detail panel */}
                  {expandedApp === app.id && (
                    <div style={{ padding: '0 20px 20px', background: 'var(--admin-bg)' }}>
                      <div style={{ borderRadius: 10, border: '1px solid var(--admin-bg-input)', overflow: 'hidden' }}>

                        {/* Header row */}
                        <div style={{ padding: '14px 18px', background: 'var(--admin-bg-deep)', borderBottom: '1px solid var(--admin-bg-input)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                          <div>
                            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--admin-text-heading)', margin: '0 0 2px' }}>{app.full_name}</p>
                            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--admin-text-muted)', margin: 0 }}>
                              {app.job_title} · {app.department}
                              {app.years_experience ? ` · ${app.years_experience}` : ''}
                              {app.location ? ` · ${app.location}` : ''}
                            </p>
                          </div>
                          <select value={app.status} onChange={e => updateAppStatus(app.id, e.target.value)}
                            style={{ ...INPUT_BASE, width: 'auto', padding: '6px 12px', fontSize: 12, color: STATUS_COLOR[app.status], cursor: 'pointer' }}>
                            {APP_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                          </select>
                        </div>

                        {/* Links row */}
                        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--admin-bg-input)', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                          <a href={`mailto:${app.email}`} style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#E8A020', textDecoration: 'none' }}>✉ {app.email}</a>
                          {app.phone && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--admin-text-muted)' }}>☎ {app.phone}</span>}
                          {app.linkedin_url && <a href={app.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#14B8A6', textDecoration: 'none' }}>↗ LinkedIn</a>}
                          {app.portfolio_url && <a href={app.portfolio_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#8B5CF6', textDecoration: 'none' }}>↗ Portfolio</a>}
                          {app.cv_url && (
                            <a href={app.cv_url} download={app.cv_filename || true} target="_blank" rel="noopener noreferrer"
                              style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#22C55E', textDecoration: 'none', padding: '3px 10px', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 5 }}>
                              ⬇ Download CV{app.cv_filename ? ` — ${app.cv_filename}` : ''}
                            </a>
                          )}
                          {app.how_did_you_hear && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--admin-text-faint)' }}>via {app.how_did_you_hear}</span>}
                        </div>

                        {/* Cover letter */}
                        <div style={{ padding: '16px 18px' }}>
                          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#E8A020', margin: '0 0 10px' }}>Cover Letter</p>
                          <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, color: 'var(--admin-text)', lineHeight: 1.75, margin: '0 0 20px', whiteSpace: 'pre-wrap' }}>{app.cover_letter}</p>
                          <button onClick={() => deleteApp(app.id)}
                            style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.08em', color: '#EF4444', background: 'none', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>
                            Delete Application
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
