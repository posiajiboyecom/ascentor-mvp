'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const ROLES = ['user', 'moderator', 'admin'] as const;

export default function AdminUsersPage() {
  const supabase = createClient();

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, current_role, industry, created_at')
      .order('created_at', { ascending: false });

    if (!profiles) { setLoading(false); return; }

    const { data: sessionCounts } = await supabase
      .from('coaching_sessions')
      .select('user_id');

    const sessionMap: Record<string, number> = {};
    sessionCounts?.forEach((s: any) => {
      sessionMap[s.user_id] = (sessionMap[s.user_id] || 0) + 1;
    });

    const enriched = profiles.map((p: any) => ({
      ...p,
      sessions: sessionMap[p.id] || 0,
    }));

    setUsers(enriched);
    setLoading(false);
  }

  async function changeRole(userId: string, newRole: string) {
    if (!confirm(`Change this user's role to "${newRole}"?`)) return;
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    loadUsers();
  }

  const filtered = users.filter((u) => {
    const matchesSearch = !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="text-2xl mb-2">⏳</div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading users...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-xl md:text-2xl font-semibold mb-1"
        style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
        Users
      </h1>
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
        {users.length} total · {users.filter((u) => u.role === 'admin').length} admins · {users.filter((u) => u.role === 'moderator').length} moderators
      </p>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          className="flex-1 px-3.5 py-2.5 text-sm rounded-xl"
          style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
        />
        <div className="flex gap-1 p-1 rounded-lg shrink-0" style={{ background: 'var(--bg-input)' }}>
          {['all', ...ROLES].map((r) => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className="px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all"
              style={{
                background: roleFilter === r ? 'var(--bg-card)' : 'transparent',
                color: roleFilter === r ? 'var(--accent)' : 'var(--text-dim)',
              }}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-[11px] font-bold uppercase tracking-wider"
          style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-dim)' }}>
          <div className="col-span-3">Name</div>
          <div className="col-span-3">Email</div>
          <div className="col-span-2">Role / Industry</div>
          <div className="col-span-1 text-center">Sessions</div>
          <div className="col-span-1 text-center">Joined</div>
          <div className="col-span-2 text-center">Role</div>
        </div>
        {filtered.map((u) => (
          <div key={u.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="col-span-3">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                {u.full_name || 'No name'}
              </p>
            </div>
            <div className="col-span-3">
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{u.email || '—'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>{u.current_role || '—'}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>{u.industry || ''}</p>
            </div>
            <div className="col-span-1 text-center">
              <span className="text-xs font-semibold" style={{ color: u.sessions > 0 ? 'var(--teal)' : 'var(--text-dim)' }}>
                {u.sessions}
              </span>
            </div>
            <div className="col-span-1 text-center">
              <span className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <div className="col-span-2 text-center">
              <select
                className="text-xs px-2 py-1 rounded-lg"
                style={{
                  background: 'var(--bg-input)',
                  color: u.role === 'admin' ? 'var(--accent)' : u.role === 'moderator' ? 'var(--purple)' : 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}
                value={u.role}
                onChange={(e) => changeRole(u.id, e.target.value)}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No users found</p>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden flex flex-col gap-3">
        {filtered.map((u) => (
          <div key={u.id} className="rounded-xl p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                  {u.full_name || 'No name'}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{u.email || '—'}</p>
              </div>
              <select
                className="text-xs px-2 py-1 rounded-lg shrink-0 ml-2"
                style={{
                  background: 'var(--bg-input)',
                  color: u.role === 'admin' ? 'var(--accent)' : u.role === 'moderator' ? 'var(--purple)' : 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}
                value={u.role}
                onChange={(e) => changeRole(u.id, e.target.value)}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex gap-4 text-[11px]" style={{ color: 'var(--text-dim)' }}>
              <span>{u.current_role || '—'}{u.industry ? ` · ${u.industry}` : ''}</span>
              <span style={{ color: u.sessions > 0 ? 'var(--teal)' : 'var(--text-dim)' }}>
                {u.sessions} sessions
              </span>
              <span>
                {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No users found</p>
          </div>
        )}
      </div>
    </div>
  );
}
