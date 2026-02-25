'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useModal } from '@/components/Modal';

type Application = {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  country: string;
  role_title: string;
  company: string;
  years_experience: string;
  industry: string;
  linkedin_url?: string;
  career_summary: string;
  why_mentor: string;
  mentor_style: string;
  success_story?: string;
  age_groups: string;
  availability_hours: string;
  has_mentored_before: string;
  status: 'pending' | 'approved' | 'rejected' | 'active';
  applied_at: string;
  notes?: string;
};

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  pending:  { bg: 'rgba(245,158,11,0.09)',  color: 'var(--accent)',  label: 'Pending'  },
  approved: { bg: 'rgba(16,185,129,0.09)',  color: 'var(--success)', label: 'Approved' },
  active:   { bg: 'rgba(59,130,246,0.09)',  color: 'var(--blue)',    label: 'Active'   },
  rejected: { bg: 'rgba(239,68,68,0.09)',   color: 'var(--error)',   label: 'Rejected' },
};

export default function AdminMentorsPage() {
  const supabase = createClient();
  const { confirm, prompt, alert } = useModal();

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'approved' | 'active' | 'rejected' | 'all'>('pending');
  const [selected, setSelected] = useState<Application | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from('mentor_applications')
      .select('*')
      .order('applied_at', { ascending: false });
    setApplications(data || []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: Application['status']) {
    await supabase.from('mentor_applications').update({ status }).eq('id', id);
    setApplications(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
  }

  async function saveNotes(id: string, notes: string) {
    await supabase.from('mentor_applications').update({ notes }).eq('id', id);
    setApplications(prev => prev.map(a => a.id === id ? { ...a, notes } : a));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, notes } : null);
  }

  async function handleDelete(app: Application) {
    const ok = await confirm(`Permanently delete application from ${app.full_name}?`, 'Delete Application');
    if (!ok) return;
    await supabase.from('mentor_applications').delete().eq('id', app.id);
    setApplications(prev => prev.filter(a => a.id !== app.id));
    if (selected?.id === app.id) setSelected(null);
  }

  async function handleAddNote(app: Application) {
    const note = await prompt('Add or update internal notes for this applicant:', {
      title: 'Internal Notes',
      placeholder: 'e.g. Spoke with by phone on March 5 — very impressive...',
    });
    if (note !== null) await saveNotes(app.id, note);
  }

  const filtered = applications.filter(a => {
    const matchTab = tab === 'all' || a.status === tab;
    const q = search.toLowerCase();
    const matchSearch = !q || a.full_name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.industry.toLowerCase().includes(q) || a.country.toLowerCase().includes(q);
    return matchTab && matchSearch;
  });

  const counts = {
    pending:  applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    active:   applications.filter(a => a.status === 'active').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
    all:      applications.length,
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="animate-fade-up">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-1">
        <h1 className="text-xl md:text-2xl font-semibold" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
          Founding Mentors
        </h1>
        <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.09)', color: 'var(--accent)', border: '1px solid rgba(245,158,11,0.2)' }}>
          {counts.active} active · {counts.pending} pending
        </span>
      </div>
      <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
        {applications.length} total applications
      </p>

      {/* STATS ROW */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {(['pending', 'approved', 'active', 'rejected'] as const).map(s => (
          <div key={s} className="rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.01]"
            style={{
              background: 'var(--bg-card)', border: `1px solid var(--border)`,
              borderTop: `3px solid ${STATUS_COLORS[s].color.replace('var(--', '').includes('accent') ? '#F59E0B' : STATUS_COLORS[s].color.includes('success') ? '#10B981' : STATUS_COLORS[s].color.includes('blue') ? '#3B82F6' : '#EF4444'}`,
            }}
            onClick={() => setTab(s)}>
            <p className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>{counts[s]}</p>
            <p className="text-xs mt-1 capitalize" style={{ color: 'var(--text-dim)' }}>{STATUS_COLORS[s].label}</p>
          </div>
        ))}
      </div>

      <div className={`flex gap-4 ${selected ? 'lg:grid lg:grid-cols-[1fr_420px]' : ''}`}>

        {/* LEFT PANEL */}
        <div className="flex-1 min-w-0">

          {/* SEARCH + TABS */}
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <input
              placeholder="Search by name, email, industry, country..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 px-3.5 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)' }}
            />
          </div>

          <div className="flex gap-1 mb-4 p-1 rounded-lg overflow-x-auto" style={{ background: 'var(--bg-input)' }}>
            {(['pending', 'approved', 'active', 'rejected', 'all'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="flex-1 py-2 rounded-md text-xs font-semibold whitespace-nowrap px-2"
                style={{ background: tab === t ? 'var(--bg-card)' : 'transparent', color: tab === t ? 'var(--accent)' : 'var(--text-dim)' }}>
                {t === 'all' ? `All (${counts.all})` : `${STATUS_COLORS[t].label} (${counts[t]})`}
              </button>
            ))}
          </div>

          {/* TABLE (desktop) */}
          {loading ? (
            <div className="text-center py-12"><p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading...</p></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-3xl mb-2">🎓</p>
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
                {search ? 'No results match your search.' : `No ${tab === 'all' ? '' : tab} applications yet.`}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="grid gap-2 px-4 py-3 text-[11px] font-bold uppercase tracking-wider"
                  style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1.2fr', borderBottom: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                  <div>Applicant</div><div>Role & Company</div><div>Industry</div><div>Country</div><div>Applied</div><div className="text-center">Actions</div>
                </div>
                {filtered.map(app => (
                  <div key={app.id}
                    className="grid gap-2 px-4 py-3 items-center cursor-pointer transition-colors hover:bg-[rgba(255,255,255,0.02)]"
                    style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1.2fr', borderBottom: '1px solid var(--border)', background: selected?.id === app.id ? 'rgba(245,158,11,0.04)' : undefined }}
                    onClick={() => setSelected(selected?.id === app.id ? null : app)}>
                    <div>
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{app.full_name}</p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{app.email}</p>
                    </div>
                    <div>
                      <p className="text-xs truncate" style={{ color: 'var(--text)' }}>{app.role_title}</p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{app.company}</p>
                    </div>
                    <div><span className="text-[10px] px-2 py-0.5 rounded-full truncate block w-fit" style={{ background: 'rgba(59,130,246,0.09)', color: 'var(--blue)' }}>{app.industry.split(' ')[0]}</span></div>
                    <div><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{app.country}</p></div>
                    <div><p className="text-xs" style={{ color: 'var(--text-dim)' }}>{fmt(app.applied_at)}</p></div>
                    <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: STATUS_COLORS[app.status]?.bg, color: STATUS_COLORS[app.status]?.color }}>{STATUS_COLORS[app.status]?.label}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Mobile cards */}
              <div className="md:hidden flex flex-col gap-3">
                {filtered.map(app => (
                  <div key={app.id}
                    className="rounded-xl p-4 cursor-pointer"
                    style={{ background: 'var(--bg-card)', border: `1px solid ${selected?.id === app.id ? 'rgba(245,158,11,0.3)' : 'var(--border)'}` }}
                    onClick={() => setSelected(selected?.id === app.id ? null : app)}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{app.full_name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{app.role_title} · {app.company}</p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ml-2" style={{ background: STATUS_COLORS[app.status]?.bg, color: STATUS_COLORS[app.status]?.color }}>
                        {STATUS_COLORS[app.status]?.label}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{app.industry} · {app.country} · {fmt(app.applied_at)}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* RIGHT PANEL — DETAIL */}
        {selected && (
          <div className="rounded-xl overflow-hidden flex flex-col" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', height: 'fit-content', position: 'sticky', top: '80px' }}>

            {/* Panel header */}
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{selected.full_name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{selected.email}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-lg leading-none px-1" style={{ color: 'var(--text-dim)' }}>✕</button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>

              {/* Status badge + quick actions */}
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold" style={{ background: STATUS_COLORS[selected.status]?.bg, color: STATUS_COLORS[selected.status]?.color }}>
                    {STATUS_COLORS[selected.status]?.label}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Applied {fmt(selected.applied_at)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selected.status !== 'approved' && (
                    <button onClick={() => updateStatus(selected.id, 'approved')} className="text-[11px] px-3 py-1.5 rounded-lg font-semibold" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.2)' }}>✓ Approve</button>
                  )}
                  {selected.status !== 'active' && (
                    <button onClick={() => updateStatus(selected.id, 'active')} className="text-[11px] px-3 py-1.5 rounded-lg font-semibold" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.2)' }}>▶ Activate</button>
                  )}
                  {selected.status !== 'rejected' && (
                    <button onClick={() => updateStatus(selected.id, 'rejected')} className="text-[11px] px-3 py-1.5 rounded-lg font-semibold" style={{ background: 'rgba(239,68,68,0.06)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.15)' }}>✕ Reject</button>
                  )}
                  {selected.status !== 'pending' && (
                    <button onClick={() => updateStatus(selected.id, 'pending')} className="text-[11px] px-3 py-1.5 rounded-lg" style={{ color: 'var(--text-dim)', border: '1px solid var(--border)' }}>↩ Reset</button>
                  )}
                  <button onClick={() => handleAddNote(selected)} className="text-[11px] px-3 py-1.5 rounded-lg" style={{ color: 'var(--text-dim)', border: '1px solid var(--border)' }}>📝 Note</button>
                  <button onClick={() => handleDelete(selected)} className="text-[11px] px-3 py-1.5 rounded-lg" style={{ color: 'var(--error)', border: '1px solid rgba(239,68,68,0.2)' }}>🗑 Delete</button>
                </div>
              </div>

              {/* Bio info */}
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>Profile</p>
                <div className="flex flex-col gap-2">
                  {[
                    ['Role', `${selected.role_title} · ${selected.company}`],
                    ['Industry', selected.industry],
                    ['Experience', selected.years_experience],
                    ['Country', selected.country],
                    ['Phone', selected.phone || '—'],
                    ['Availability', selected.availability_hours + '/month'],
                    ['Mentored before?', selected.has_mentored_before],
                    ['Age groups', selected.age_groups],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="text-[11px] w-24 shrink-0 pt-0.5" style={{ color: 'var(--text-dim)' }}>{k}</span>
                      <span className="text-xs font-medium leading-relaxed" style={{ color: 'var(--text)' }}>{v}</span>
                    </div>
                  ))}
                  {selected.linkedin_url && (
                    <div className="flex gap-2">
                      <span className="text-[11px] w-24 shrink-0 pt-0.5" style={{ color: 'var(--text-dim)' }}>LinkedIn</span>
                      <a href={selected.linkedin_url} target="_blank" rel="noreferrer" className="text-xs font-medium truncate" style={{ color: 'var(--accent)' }}>View profile →</a>
                    </div>
                  )}
                </div>
              </div>

              {/* Written responses */}
              {[
                { label: 'Career Summary', value: selected.career_summary },
                { label: 'Why They Want to Mentor', value: selected.why_mentor },
                { label: 'Mentoring Style', value: selected.mentor_style },
                ...(selected.success_story ? [{ label: 'Success Story', value: selected.success_story }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-dim)' }}>{label}</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text)' }}>{value}</p>
                </div>
              ))}

              {/* Internal notes */}
              {selected.notes && (
                <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(245,158,11,0.03)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--accent)' }}>Internal Notes</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text)' }}>{selected.notes}</p>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
