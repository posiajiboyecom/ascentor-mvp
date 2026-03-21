'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const STATUSES = ['saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn'];

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  saved:        { bg: 'rgba(107,100,86,0.12)',  color: '#6B6456', border: 'rgba(107,100,86,0.25)' },
  applied:      { bg: 'rgba(59,130,246,0.12)',  color: '#60A5FA', border: 'rgba(59,130,246,0.25)' },
  interviewing: { bg: 'rgba(232,160,32,0.12)',  color: '#E8A020', border: 'rgba(232,160,32,0.25)' },
  offer:        { bg: 'rgba(16,185,129,0.12)',  color: '#10B981', border: 'rgba(16,185,129,0.25)' },
  rejected:     { bg: 'rgba(239,68,68,0.10)',   color: '#EF4444', border: 'rgba(239,68,68,0.20)' },
  withdrawn:    { bg: 'rgba(107,100,86,0.08)',  color: '#6B6456', border: 'rgba(107,100,86,0.15)' },
};

export default function GuardsmannTracker() {
  const [apps,       setApps]       = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [filter,     setFilter]     = useState('all');
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null);
  const [editId,     setEditId]     = useState<string | null>(null);

  const [form, setForm] = useState({
    company: '', title: '', url: '', salary: '',
    hq: '', notes: '', status: 'saved',
    applied_at: new Date().toISOString().split('T')[0],
  });

  const supabase = createClient();

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('guardsmann_applications')
      .select('*')
      .order('created_at', { ascending: false });
    setApps(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveApp() {
    if (!form.company || !form.title) { showToast('Company and title are required', false); return; }
    const payload = { ...form, applied_at: form.applied_at || null };

    if (editId) {
      const { error } = await supabase.from('guardsmann_applications').update(payload).eq('id', editId);
      if (error) { showToast('Error: ' + error.message, false); return; }
      showToast('Updated');
    } else {
      const { error } = await supabase.from('guardsmann_applications').insert(payload);
      if (error) { showToast('Error: ' + error.message, false); return; }
      showToast('Application logged');
    }

    setShowForm(false);
    setEditId(null);
    setForm({ company: '', title: '', url: '', salary: '', hq: '', notes: '', status: 'saved', applied_at: new Date().toISOString().split('T')[0] });
    load();
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('guardsmann_applications').update({ status }).eq('id', id);
    setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  }

  async function deleteApp(id: string) {
    await supabase.from('guardsmann_applications').delete().eq('id', id);
    setApps(prev => prev.filter(a => a.id !== id));
    showToast('Removed');
  }

  function startEdit(app: any) {
    setForm({
      company:    app.company || '',
      title:      app.title   || '',
      url:        app.url     || '',
      salary:     app.salary  || '',
      hq:         app.hq      || '',
      notes:      app.notes   || '',
      status:     app.status  || 'saved',
      applied_at: app.applied_at ? app.applied_at.split('T')[0] : new Date().toISOString().split('T')[0],
    });
    setEditId(app.id);
    setShowForm(true);
  }

  const filtered = filter === 'all' ? apps : apps.filter(a => a.status === filter);

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = apps.filter(a => a.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F5F3EE', marginBottom: 4 }}>Application Tracker</h1>
          <p style={{ fontSize: 12, color: 'var(--gm-muted)', fontFamily: 'var(--gm-font-mono)' }}>
            Track every GRC application — follow-ups, status, salary, notes
          </p>
        </div>
        <button className="gm-btn-primary" onClick={() => { setShowForm(true); setEditId(null); }}>
          + Log Application
        </button>
      </div>

      {/* Pipeline summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 10, marginBottom: 24 }}>
        {STATUSES.map(s => {
          const st = STATUS_STYLE[s];
          return (
            <button key={s} onClick={() => setFilter(filter === s ? 'all' : s)}
              style={{ padding: '12px 10px', borderRadius: 10, border: `1px solid ${filter === s ? st.color : 'var(--gm-border)'}`, background: filter === s ? st.bg : 'var(--gm-card)', cursor: 'pointer', textAlign: 'center' as const }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: st.color }}>{counts[s] || 0}</div>
              <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 9, color: st.color, letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>{s}</div>
            </button>
          );
        })}
      </div>

      {/* Form */}
      {showForm && (
        <div className="gm-card" style={{ marginBottom: 24, borderLeft: '3px solid var(--gm-gold)' }}>
          <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 11, color: 'var(--gm-gold)', marginBottom: 16 }}>
            {editId ? 'EDIT APPLICATION' : 'LOG NEW APPLICATION'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div className="gm-field">
              <label className="gm-label">Company *</label>
              <input className="gm-input" placeholder="Acme Corp" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
            </div>
            <div className="gm-field">
              <label className="gm-label">Job Title *</label>
              <input className="gm-input" placeholder="GRC Analyst" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="gm-field">
              <label className="gm-label">Company HQ</label>
              <input className="gm-input" placeholder="San Francisco, USA" value={form.hq} onChange={e => setForm(f => ({ ...f, hq: e.target.value }))} />
            </div>
            <div className="gm-field">
              <label className="gm-label">Salary (USD)</label>
              <input className="gm-input" placeholder="$60,000 – $80,000" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} />
            </div>
            <div className="gm-field">
              <label className="gm-label">Application URL</label>
              <input className="gm-input" placeholder="https://jobs.company.com/…" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
            </div>
            <div className="gm-field">
              <label className="gm-label">Status</label>
              <select className="gm-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div className="gm-field">
              <label className="gm-label">Date Applied</label>
              <input className="gm-input" type="date" value={form.applied_at} onChange={e => setForm(f => ({ ...f, applied_at: e.target.value }))} />
            </div>
            <div className="gm-field">
              <label className="gm-label">Notes</label>
              <input className="gm-input" placeholder="Requires CISM, asked about ISO 27001 experience…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="gm-btn-primary" onClick={saveApp}>{editId ? 'Update' : 'Save Application'}</button>
            <button className="gm-btn-secondary" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Application list */}
      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--gm-muted)', fontFamily: 'var(--gm-font-mono)', fontSize: 11 }}>LOADING…</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gm-muted)' }}>
          <div style={{ fontSize: 14, marginBottom: 6 }}>{filter === 'all' ? 'No applications yet' : `No applications with status "${filter}"`}</div>
          <div style={{ fontSize: 12, fontFamily: 'var(--gm-font-mono)' }}>Log your first GRC application above</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(app => {
          const st = STATUS_STYLE[app.status] || STATUS_STYLE.saved;
          return (
            <div key={app.id} className="gm-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Info */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#F5F3EE' }}>{app.title}</span>
                  <span style={{ fontSize: 13, color: 'var(--gm-muted)' }}>— {app.company}{app.hq ? ` · ${app.hq}` : ''}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: app.notes ? 8 : 0 }}>
                  <span className="gm-badge" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>{app.status}</span>
                  {app.salary && <span className="gm-badge gm-badge-gold">{app.salary}</span>}
                  {app.applied_at && <span className="gm-badge gm-badge-grey">Applied {new Date(app.applied_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                </div>
                {app.notes && <div style={{ fontSize: 12, color: 'var(--gm-muted)', marginTop: 4 }}>{app.notes}</div>}
              </div>
              {/* Actions — always in a wrapping row below, never overflows */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select className="gm-select" style={{ width: 140, fontSize: 11, padding: '5px 8px', flex: '0 0 auto' }}
                  value={app.status} onChange={e => updateStatus(app.id, e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
                {app.url && (
                  <a href={app.url} target="_blank" rel="noreferrer"
                    className="gm-btn-secondary" style={{ fontSize: 11, padding: '5px 10px', textDecoration: 'none' }}>↗ View</a>
                )}
                <button className="gm-btn-secondary" style={{ fontSize: 11, padding: '5px 10px' }}
                  onClick={() => startEdit(app)}>Edit</button>
                <button className="gm-btn-secondary" style={{ fontSize: 11, padding: '5px 10px', color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)' }}
                  onClick={() => deleteApp(app.id)}>Remove</button>
              </div>
            </div>
          );
        })}
      </div>

      {toast && <div className={`gm-toast ${toast.ok ? 'ok' : 'err'}`}>{toast.msg}</div>}
    </div>
  );
}
