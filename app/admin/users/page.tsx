'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ============================================================
// ADMIN USER MANAGEMENT — /admin/users
// View, search, filter, edit roles, ban/unban users
// ============================================================

interface User {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  subscription_plan: string | null;
  subscription_status: string | null;
  subscription_end: string | null;
  created_at: string;
  referral_code: string | null;
  referral_count: number;
  current_role: string | null;
  industry: string | null;
  banned: boolean;
  last_sign_in: string | null;
}

const ROLES = ['member', 'moderator', 'admin'];
const STATUSES = ['', 'free', 'trialing', 'active', 'cancelled', 'past_due'];
const PLANS = ['', 'free', 'basic', 'standard', 'premium'];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');

  const supabase = createClient();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', String(page));

      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, page, supabase]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const doAction = async (userId: string, action: string, value?: string) => {
    setActionLoading(true);
    setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session!.access_token}`,
        },
        body: JSON.stringify({ targetUserId: userId, action, value }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(data.message);
        fetchUsers();
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch { setMessage('Action failed'); }
    finally { setActionLoading(false); }
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const statusBadge = (status: string | null, banned: boolean) => {
    if (banned) return { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', label: 'Banned' };
    const map: Record<string, { color: string; bg: string; label: string }> = {
      active: { color: '#10B981', bg: 'rgba(16,185,129,0.1)', label: 'Active' },
      trialing: { color: '#60A5FA', bg: 'rgba(96,165,250,0.1)', label: 'Trial' },
      cancelled: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', label: 'Cancelled' },
      past_due: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', label: 'Past Due' },
    };
    return map[status || ''] || { color: '#6B6A65', bg: 'rgba(107,106,101,0.1)', label: 'Free' };
  };

  const card: React.CSSProperties = { background: 'var(--bg-card, #12151F)', border: '1px solid var(--border, #2A2D3A)', borderRadius: '12px' };
  const input: React.CSSProperties = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border, #2A2D3A)', background: 'var(--bg-input, #1A1D2E)', color: 'var(--text)', fontSize: '14px', outline: 'none' };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>User Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '4px 0 0' }}>{total} total users</p>
        </div>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', background: message.startsWith('Error') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: message.startsWith('Error') ? '#EF4444' : '#10B981', fontSize: '14px', marginBottom: '16px' }}>
          {message}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input type="text" placeholder="Search name, email, referral code..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          style={{ ...input, flex: '1', minWidth: '220px' }} />
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }} style={{ ...input, cursor: 'pointer' }}>
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} style={{ ...input, cursor: 'pointer' }}>
          <option value="">All Statuses</option>
          {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading users...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['User', 'Role', 'Plan', 'Status', 'Joined', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: 'var(--text-dim)', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const badge = statusBadge(u.subscription_status, u.banned);
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', opacity: u.banned ? 0.6 : 1 }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{u.full_name || 'Unnamed'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{u.email}</div>
                        {u.current_role && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{u.current_role}{u.industry ? ` · ${u.industry}` : ''}</div>}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <select
                          value={u.role}
                          onChange={(e) => doAction(u.id, 'change_role', e.target.value)}
                          disabled={actionLoading}
                          style={{ ...input, padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}
                        >
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>{u.subscription_plan || 'free'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: badge.bg, color: badge.color }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{formatDate(u.created_at)}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => setSelectedUser(u)} style={{ ...input, padding: '4px 10px', fontSize: '11px', cursor: 'pointer' }}>View</button>
                          {u.banned ? (
                            <button onClick={() => doAction(u.id, 'unban')} disabled={actionLoading}
                              style={{ ...input, padding: '4px 10px', fontSize: '11px', cursor: 'pointer', color: '#10B981', borderColor: '#10B981' }}>Unban</button>
                          ) : (
                            <button onClick={() => { if (confirm(`Ban ${u.full_name || u.email}?`)) doAction(u.id, 'ban'); }} disabled={actionLoading}
                              style={{ ...input, padding: '4px 10px', fontSize: '11px', cursor: 'pointer', color: '#EF4444', borderColor: '#EF4444' }}>Ban</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
          style={{ ...input, cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1 }}>← Previous</button>
        <span style={{ color: 'var(--text-dim)', fontSize: '13px' }}>Page {page + 1} of {Math.ceil(total / 50) || 1}</span>
        <button onClick={() => setPage(p => p + 1)} disabled={users.length < 50}
          style={{ ...input, cursor: users.length < 50 ? 'not-allowed' : 'pointer', opacity: users.length < 50 ? 0.4 : 1 }}>Next →</button>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <>
          <div onClick={() => setSelectedUser(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9998 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            ...card, padding: '28px', width: '90%', maxWidth: '520px', zIndex: 9999, maxHeight: '80vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>User Details</h3>
              <button onClick={() => setSelectedUser(null)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>
            {[
              ['Name', selectedUser.full_name || '—'],
              ['Email', selectedUser.email],
              ['Role', selectedUser.role],
              ['Job Title', selectedUser.current_role || '—'],
              ['Industry', selectedUser.industry || '—'],
              ['Plan', selectedUser.subscription_plan || 'free'],
              ['Status', selectedUser.subscription_status || 'free'],
              ['Sub End', formatDate(selectedUser.subscription_end)],
              ['Referral Code', selectedUser.referral_code || '—'],
              ['Referrals', String(selectedUser.referral_count || 0)],
              ['Joined', formatDate(selectedUser.created_at)],
              ['Last Login', formatDate(selectedUser.last_sign_in)],
              ['Banned', selectedUser.banned ? 'Yes' : 'No'],
              ['User ID', selectedUser.id],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-dim)' }}>{label}</span>
                <span style={{ color: 'var(--text)', fontWeight: 500, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-all' }}>{value}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <select
                onChange={(e) => { if (e.target.value) doAction(selectedUser.id, 'change_plan', e.target.value); }}
                style={{ ...input, flex: 1, cursor: 'pointer' }}
                defaultValue=""
              >
                <option value="" disabled>Set plan...</option>
                {PLANS.filter(Boolean).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {selectedUser.banned ? (
                <button onClick={() => { doAction(selectedUser.id, 'unban'); setSelectedUser(null); }}
                  style={{ ...input, cursor: 'pointer', color: '#10B981' }}>Unban</button>
              ) : (
                <button onClick={() => { doAction(selectedUser.id, 'ban'); setSelectedUser(null); }}
                  style={{ ...input, cursor: 'pointer', color: '#EF4444' }}>Ban</button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
