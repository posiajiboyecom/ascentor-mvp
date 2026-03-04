'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ============================================================
// ADMIN USER MANAGEMENT — /admin/users
// View, search, filter, edit roles, ban/unban users
// Ascentor brand: Dark #0C0B08 · Gold #E8A020 · Syne · DM Mono · Cormorant Garamond
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

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const statusBadge = (status: string | null, banned: boolean) => {
    if (banned) return { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', label: 'Banned' };
    const map: Record<string, { color: string; bg: string; label: string }> = {
      active:    { color: '#14B8A6', bg: 'rgba(20,184,166,0.1)',  label: 'Active' },
      trialing:  { color: '#E8A020', bg: 'rgba(232,160,32,0.1)',  label: 'Trial' },
      cancelled: { color: '#7A7260', bg: 'rgba(122,114,96,0.12)', label: 'Cancelled' },
      past_due:  { color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   label: 'Past Due' },
    };
    return map[status || ''] || { color: '#4A4438', bg: 'rgba(74,68,56,0.15)', label: 'Free' };
  };

  // ─── Shared style tokens ──────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: '#141310',
    border: '1px solid #2E2A22',
    borderRadius: '12px',
  };

  const inputBase: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #2E2A22',
    background: '#1E1C17',
    color: '#D4CFC3',
    fontSize: '13px',
    fontFamily: "'Syne', sans-serif",
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const monoLabel: React.CSSProperties = {
    fontFamily: "'DM Mono', monospace",
    fontSize: '10px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: '#4A4438',
  };

  const totalPages = Math.ceil(total / 50) || 1;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');

        .asc-input:focus          { border-color: #E8A020 !important; }
        .asc-input:hover          { border-color: #4A4438 !important; }
        .asc-tr:hover td          { background: #1A1815 !important; }
        .asc-btn-ghost:hover      { border-color: #E8A020 !important; color: #E8A020 !important; }
        .asc-btn-danger:hover     { background: rgba(239,68,68,0.08) !important; }
        .asc-btn-safe:hover       { background: rgba(20,184,166,0.08) !important; }
        .asc-modal-row:last-child { border-bottom: none !important; }

        @media (min-width: 768px) {
          .asc-table-desktop { display: block !important; }
          .asc-table-mobile  { display: none !important; }
          .asc-filters       { flex-direction: row !important; }
        }
        @media (max-width: 767px) {
          .asc-table-desktop { display: none !important; }
          .asc-table-mobile  { display: flex !important; }
          .asc-filters       { flex-direction: column !important; }
          .asc-filters input,
          .asc-filters select { width: 100% !important; min-width: unset !important; }
          .asc-page-header   { flex-direction: column !important; align-items: flex-start !important; }
        }
        * { box-sizing: border-box; }
      `}</style>

      {/* ─── Page Header ────────────────────────────────────────────────── */}
      <div className="asc-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '28px',
            fontWeight: 700,
            color: '#FEF9EC',
            margin: 0,
            lineHeight: 1.1,
            marginBottom: '6px',
          }}>
            User Management
          </h1>
          <p style={{ ...monoLabel }}>
            {total.toLocaleString()} total users
          </p>
        </div>
      </div>

      {/* ─── Status Message ──────────────────────────────────────────────── */}
      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: message.startsWith('Error') ? 'rgba(239,68,68,0.08)' : 'rgba(20,184,166,0.08)',
          color: message.startsWith('Error') ? '#EF4444' : '#14B8A6',
          fontFamily: "'DM Mono', monospace",
          fontSize: '12px',
          letterSpacing: '0.04em',
          border: `1px solid ${message.startsWith('Error') ? 'rgba(239,68,68,0.2)' : 'rgba(20,184,166,0.2)'}`,
          marginBottom: '16px',
        }}>
          {message}
        </div>
      )}

      {/* ─── Filters ────────────────────────────────────────────────────── */}
      <div className="asc-filters" style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search name, email, referral code..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="asc-input"
          style={{ ...inputBase, flex: '1', minWidth: '220px' }}
        />
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }}
          className="asc-input"
          style={{ ...inputBase, cursor: 'pointer' }}
        >
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          className="asc-input"
          style={{ ...inputBase, cursor: 'pointer' }}
        >
          <option value="">All Statuses</option>
          {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      {/* ─── Table ──────────────────────────────────────────────────────── */}
      <div style={{ ...card, overflow: 'hidden', marginBottom: '16px' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              border: '2px solid #2E2A22', borderTopColor: '#E8A020',
              animation: 'asc-spin 0.9s linear infinite',
              margin: '0 auto 12px',
            }} />
            <p style={{ ...monoLabel }}>Loading users...</p>
            <style>{`@keyframes asc-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="asc-table-desktop" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2E2A22' }}>
                    {['User', 'Role', 'Plan', 'Status', 'Joined', 'Actions'].map(h => (
                      <th key={h} style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontFamily: "'DM Mono', monospace",
                        fontSize: '10px',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: '#4A4438',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const badge = statusBadge(u.subscription_status, u.banned);
                    return (
                      <tr key={u.id} className="asc-tr" style={{ borderBottom: '1px solid #2E2A22', opacity: u.banned ? 0.55 : 1 }}>

                        {/* User */}
                        <td style={{ padding: '13px 16px' }}>
                          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: '13px', color: '#D4CFC3', marginBottom: '2px' }}>
                            {u.full_name || 'Unnamed'}
                          </div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: '#4A4438' }}>{u.email}</div>
                          {u.current_role && (
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#4A4438', marginTop: '2px', letterSpacing: '0.04em' }}>
                              {u.current_role}{u.industry ? ` · ${u.industry}` : ''}
                            </div>
                          )}
                        </td>

                        {/* Role */}
                        <td style={{ padding: '13px 16px' }}>
                          <select
                            value={u.role}
                            onChange={(e) => doAction(u.id, 'change_role', e.target.value)}
                            disabled={actionLoading}
                            className="asc-input"
                            style={{ ...inputBase, padding: '5px 10px', fontSize: '11px', cursor: 'pointer' }}
                          >
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>

                        {/* Plan */}
                        <td style={{ padding: '13px 16px' }}>
                          <span style={{ ...monoLabel, fontSize: '11px', color: '#7A7260' }}>
                            {u.subscription_plan || 'free'}
                          </span>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '13px 16px' }}>
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '100px',
                            fontFamily: "'DM Mono', monospace",
                            fontSize: '10px',
                            fontWeight: 500,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            background: badge.bg,
                            color: badge.color,
                          }}>
                            {badge.label}
                          </span>
                        </td>

                        {/* Joined */}
                        <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                          <span style={{ ...monoLabel, fontSize: '11px' }}>{formatDate(u.created_at)}</span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '13px 16px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => setSelectedUser(u)}
                              className="asc-btn-ghost"
                              style={{
                                ...inputBase,
                                padding: '5px 12px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                color: '#7A7260',
                              }}
                            >
                              View
                            </button>
                            {u.banned ? (
                              <button
                                onClick={() => doAction(u.id, 'unban')}
                                disabled={actionLoading}
                                className="asc-btn-safe"
                                style={{
                                  ...inputBase,
                                  padding: '5px 12px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  color: '#14B8A6',
                                  borderColor: 'rgba(20,184,166,0.3)',
                                }}
                              >
                                Unban
                              </button>
                            ) : (
                              <button
                                onClick={() => { if (confirm(`Ban ${u.full_name || u.email}?`)) doAction(u.id, 'ban'); }}
                                disabled={actionLoading}
                                className="asc-btn-danger"
                                style={{
                                  ...inputBase,
                                  padding: '5px 12px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  color: '#EF4444',
                                  borderColor: 'rgba(239,68,68,0.3)',
                                }}
                              >
                                Ban
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="asc-table-mobile" style={{ display: 'none', flexDirection: 'column' }}>
              {users.map(u => {
                const badge = statusBadge(u.subscription_status, u.banned);
                return (
                  <div
                    key={u.id}
                    style={{
                      padding: '16px',
                      borderBottom: '1px solid #2E2A22',
                      opacity: u.banned ? 0.6 : 1,
                    }}
                  >
                    {/* Top row: name + status badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div>
                        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: '14px', color: '#D4CFC3' }}>
                          {u.full_name || 'Unnamed'}
                        </div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: '#4A4438', marginTop: '2px' }}>
                          {u.email}
                        </div>
                      </div>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: '100px',
                        fontFamily: "'DM Mono', monospace",
                        fontSize: '10px',
                        fontWeight: 500,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase' as const,
                        background: badge.bg,
                        color: badge.color,
                        flexShrink: 0,
                        marginLeft: '8px',
                      }}>
                        {badge.label}
                      </span>
                    </div>

                    {/* Meta row */}
                    <div style={{
                      display: 'flex',
                      gap: '10px',
                      flexWrap: 'wrap',
                      marginBottom: '12px',
                    }}>
                      {u.current_role && (
                        <span style={{ ...monoLabel, fontSize: '10px' }}>{u.current_role}{u.industry ? ` · ${u.industry}` : ''}</span>
                      )}
                      <span style={{ ...monoLabel, fontSize: '10px' }}>{u.subscription_plan || 'free'}</span>
                      <span style={{ ...monoLabel, fontSize: '10px' }}>{formatDate(u.created_at)}</span>
                    </div>

                    {/* Role select + actions */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <select
                        value={u.role}
                        onChange={(e) => doAction(u.id, 'change_role', e.target.value)}
                        disabled={actionLoading}
                        className="asc-input"
                        style={{ ...inputBase, padding: '6px 10px', fontSize: '12px', cursor: 'pointer', flex: '1', minWidth: '100px' }}
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button
                        onClick={() => setSelectedUser(u)}
                        className="asc-btn-ghost"
                        style={{ ...inputBase, padding: '6px 14px', fontSize: '12px', cursor: 'pointer', color: '#7A7260' }}
                      >
                        View
                      </button>
                      {u.banned ? (
                        <button
                          onClick={() => doAction(u.id, 'unban')}
                          disabled={actionLoading}
                          className="asc-btn-safe"
                          style={{ ...inputBase, padding: '6px 14px', fontSize: '12px', cursor: 'pointer', color: '#14B8A6', borderColor: 'rgba(20,184,166,0.3)' }}
                        >
                          Unban
                        </button>
                      ) : (
                        <button
                          onClick={() => { if (confirm(`Ban ${u.full_name || u.email}?`)) doAction(u.id, 'ban'); }}
                          disabled={actionLoading}
                          className="asc-btn-danger"
                          style={{ ...inputBase, padding: '6px 14px', fontSize: '12px', cursor: 'pointer', color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)' }}
                        >
                          Ban
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ─── Pagination ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
        <button
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
          className="asc-btn-ghost"
          style={{
            ...inputBase,
            cursor: page === 0 ? 'not-allowed' : 'pointer',
            opacity: page === 0 ? 0.35 : 1,
            color: '#7A7260',
          }}
        >
          Previous
        </button>
        <span style={{ ...monoLabel }}>
          Page {page + 1} of {totalPages}
        </span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={users.length < 50}
          className="asc-btn-ghost"
          style={{
            ...inputBase,
            cursor: users.length < 50 ? 'not-allowed' : 'pointer',
            opacity: users.length < 50 ? 0.35 : 1,
            color: '#7A7260',
          }}
        >
          Next
        </button>
      </div>

      {/* ─── User Detail Modal ────────────────────────────────────────────── */}
      {selectedUser && (
        <>
          <div
            onClick={() => setSelectedUser(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9998, backdropFilter: 'blur(2px)' }}
          />
          <div style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#141310',
            border: '1px solid #2E2A22',
            borderRadius: '14px',
            padding: '28px',
            width: '90%',
            maxWidth: '520px',
            zIndex: 9999,
            maxHeight: '80vh',
            overflowY: 'auto',
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '22px',
                fontWeight: 700,
                color: '#FEF9EC',
                margin: 0,
              }}>
                User Details
              </h3>
              <button
                onClick={() => setSelectedUser(null)}
                style={{
                  background: 'none',
                  border: '1px solid #2E2A22',
                  borderRadius: '6px',
                  color: '#4A4438',
                  cursor: 'pointer',
                  fontSize: '18px',
                  lineHeight: 1,
                  padding: '2px 8px',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
              >
                x
              </button>
            </div>

            {/* Detail Rows */}
            {[
              ['Name',         selectedUser.full_name || '—'],
              ['Email',        selectedUser.email],
              ['Role',         selectedUser.role],
              ['Job Title',    selectedUser.current_role || '—'],
              ['Industry',     selectedUser.industry || '—'],
              ['Plan',         selectedUser.subscription_plan || 'free'],
              ['Status',       selectedUser.subscription_status || 'free'],
              ['Sub End',      formatDate(selectedUser.subscription_end)],
              ['Referral Code',selectedUser.referral_code || '—'],
              ['Referrals',    String(selectedUser.referral_count || 0)],
              ['Joined',       formatDate(selectedUser.created_at)],
              ['Last Login',   formatDate(selectedUser.last_sign_in)],
              ['Banned',       selectedUser.banned ? 'Yes' : 'No'],
              ['User ID',      selectedUser.id],
            ].map(([label, value]) => (
              <div
                key={label}
                className="asc-modal-row"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '9px 0',
                  borderBottom: '1px solid #2E2A22',
                }}
              >
                <span style={{ ...monoLabel }}>{label}</span>
                <span style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: '13px',
                  color: '#D4CFC3',
                  fontWeight: 500,
                  textAlign: 'right',
                  maxWidth: '60%',
                  wordBreak: 'break-all',
                }}>
                  {value}
                </span>
              </div>
            ))}

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <select
                onChange={(e) => { if (e.target.value) doAction(selectedUser.id, 'change_plan', e.target.value); }}
                className="asc-input"
                style={{ ...inputBase, flex: 1, cursor: 'pointer' }}
                defaultValue=""
              >
                <option value="" disabled>Set plan...</option>
                {PLANS.filter(Boolean).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {selectedUser.banned ? (
                <button
                  onClick={() => { doAction(selectedUser.id, 'unban'); setSelectedUser(null); }}
                  className="asc-btn-safe"
                  style={{
                    ...inputBase,
                    cursor: 'pointer',
                    color: '#14B8A6',
                    borderColor: 'rgba(20,184,166,0.3)',
                  }}
                >
                  Unban
                </button>
              ) : (
                <button
                  onClick={() => { doAction(selectedUser.id, 'ban'); setSelectedUser(null); }}
                  className="asc-btn-danger"
                  style={{
                    ...inputBase,
                    cursor: 'pointer',
                    color: '#EF4444',
                    borderColor: 'rgba(239,68,68,0.3)',
                  }}
                >
                  Ban
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
