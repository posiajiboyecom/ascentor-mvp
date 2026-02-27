'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';

const STATUSES = ['scheduled', 'live', 'completed', 'cancelled'] as const;

export default function AdminExpertsPageInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(searchParams.get('action') === 'create');
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const emptyForm = {
    title: '', description: '', expert_name: '', expert_bio: '',
    scheduled_at: '', duration_minutes: 60, max_participants: 50,
    status: 'scheduled' as string, join_url: '', registration_url: '',
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadEvents(); }, []);

  async function loadEvents() {
    const { data } = await supabase.from('expert_sessions').select('*').order('scheduled_at', { ascending: false });
    setEvents(data || []);
    setLoading(false);
  }

  function openEdit(event: any) {
    setForm({
      title: event.title || '', description: event.description || '',
      expert_name: event.expert_name || '', expert_bio: event.expert_bio || '',
      scheduled_at: event.scheduled_at ? new Date(event.scheduled_at).toISOString().slice(0, 16) : '',
      duration_minutes: event.duration_minutes || 60,
      max_participants: event.max_participants || 50,
      status: event.status || 'scheduled',
      join_url: event.join_url || '', registration_url: event.registration_url || '',
    });
    setEditing(event);
    setShowForm(true);
  }

  function openCreate() {
    setForm(emptyForm);
    setEditing(null);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.expert_name.trim() || !form.scheduled_at) return;
    setSaving(true);

    const payload: any = {
      title: form.title,
      description: form.description || null,
      expert_name: form.expert_name,
      expert_bio: form.expert_bio || null,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      duration_minutes: Number(form.duration_minutes) || 60,
      max_participants: Number(form.max_participants) || 50,
      status: form.status,
      join_url: form.join_url || null,
      registration_url: form.registration_url || null,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from('expert_sessions').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('expert_sessions').insert(payload));
    }

    if (error) {
      alert('Save failed: ' + error.message);
    } else {
      setShowForm(false);
      setEditing(null);
    }

    setSaving(false);
    loadEvents();
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    await supabase.from('expert_sessions').delete().eq('id', id);
    loadEvents();
  }

  const upcoming = events.filter((e) => ['scheduled', 'live'].includes(e.status));
  const past = events.filter((e) => ['completed', 'cancelled'].includes(e.status));

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="text-2xl mb-2">⏳</div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading events...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--text)' }}>
            Expert Events
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {upcoming.length} upcoming · {past.length} past
          </p>
        </div>
        <button onClick={openCreate}
          className="px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"
          style={{ background: 'var(--accent)', color: '#000' }}>
          + New Event
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl p-4 md:p-5 mb-6"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>
            {editing ? 'Edit Event' : 'New Expert Event'}
          </h3>
          <div className="flex flex-col gap-3">
            <input className="w-full px-3.5 py-2.5 text-sm rounded-xl"
              style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Event title" />
            <textarea className="w-full px-3.5 py-2.5 text-sm rounded-xl resize-none"
              style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Event description" rows={2} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input className="px-3.5 py-2.5 text-sm rounded-xl"
                style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
                value={form.expert_name} onChange={(e) => setForm({ ...form, expert_name: e.target.value })}
                placeholder="Expert name" />
              <input className="px-3.5 py-2.5 text-sm rounded-xl"
                style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
                value={form.expert_bio} onChange={(e) => setForm({ ...form, expert_bio: e.target.value })}
                placeholder="Expert bio (short)" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold mb-1 block" style={{ color: 'var(--text-dim)' }}>Date & Time</label>
                <input type="datetime-local" className="w-full px-3 py-2.5 text-sm rounded-xl"
                  style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
                  value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
              </div>
              <div>
                <label className="text-[11px] font-bold mb-1 block" style={{ color: 'var(--text-dim)' }}>Status</label>
                <select className="w-full px-3 py-2.5 text-sm rounded-xl"
                  style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input className="px-3.5 py-2.5 text-sm rounded-xl"
                style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
                value={form.registration_url}
                onChange={(e) => setForm({ ...form, registration_url: e.target.value })}
                placeholder="Registration link (Zoom, Meet, Teams, etc.)" />
              <input className="px-3.5 py-2.5 text-sm rounded-xl"
                style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
                value={form.join_url}
                onChange={(e) => setForm({ ...form, join_url: e.target.value })}
                placeholder="Meeting/webinar join link" />
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={handleSave}
                disabled={saving || !form.title.trim() || !form.expert_name.trim() || !form.scheduled_at}
                className="px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#000' }}>
                {saving ? 'Saving...' : editing ? 'Update' : 'Create Event'}
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

      <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: 'var(--bg-input)' }}>
        {(['upcoming', 'past'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-md text-xs font-semibold transition-all capitalize"
            style={{
              background: tab === t ? 'var(--bg-card)' : 'transparent',
              color: tab === t ? 'var(--accent)' : 'var(--text-dim)',
            }}>
            {t} ({t === 'upcoming' ? upcoming.length : past.length})
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {(tab === 'upcoming' ? upcoming : past).map((e) => (
          <div key={e.id} className="rounded-xl p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{e.title}</h4>
                <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  {e.expert_name} · {new Date(e.scheduled_at).toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                  })}
                </p>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2"
                style={{
                  background: e.status === 'scheduled' ? 'rgba(59,130,246,0.09)' : e.status === 'live' ? 'rgba(239,68,68,0.09)' : e.status === 'completed' ? 'rgba(16,185,129,0.09)' : 'rgba(107,114,128,0.09)',
                  color: e.status === 'scheduled' ? 'var(--blue)' : e.status === 'live' ? 'var(--error)' : e.status === 'completed' ? 'var(--success)' : 'var(--text-dim)',
                }}>
                {e.status}
              </span>
            </div>
            <div className="flex gap-3 items-center text-[11px] mb-3" style={{ color: 'var(--text-dim)' }}>
              {e.registration_url && <span>📋 Reg link</span>}
              {e.join_url && <span>🎥 Join link</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEdit(e)}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ color: 'var(--accent)', border: '1px solid rgba(245,158,11,0.3)' }}>
                Edit
              </button>
              <button onClick={() => handleDelete(e.id, e.title)}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)' }}>
                Delete
              </button>
            </div>
          </div>
        ))}
        {(tab === 'upcoming' ? upcoming : past).length === 0 && (
          <div className="text-center py-10">
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
              No {tab} events. {tab === 'upcoming' && 'Create one above.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}