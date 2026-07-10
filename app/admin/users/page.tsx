'use client';
// app/admin/users/page.tsx — THE LEDGER
// View, search, filter, edit roles, assign granular permissions,
// change plan, ban/unban, hard delete with confirmation
//
// Restyled to The Ledger (styles/admin-ledger.css). This file already
// used a structured --admin-* token system + shared style objects
// (mono/inp/cardSt) before this pass, so the conversion is mostly a
// direct token rename: --admin-bg-* -> --ledger-bg-*, --admin-text-*
// -> --ledger-ink-*, etc. The old gold constant G = '#E8A020' is
// replaced with Ledger's gold (#C8A96E via var(--ledger-gold)) — a
// different hex than what this file used before, now consistent
// with every other Ledger-restyled page. Status colors (banned/
// active/trial/past_due) now reference Ledger's bad/good/gold/info
// tokens instead of raw hex, so a future palette change propagates
// here automatically. Logic is UNCHANGED — same fetchUsers, doAction,
// setPermissions, togglePerm. This is a styling-only pass.

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

interface User {
  id: string; full_name: string | null; email: string;
  role: string; subscription_plan: string | null;
  subscription_status: string | null; subscription_end: string | null;
  created_at: string; referral_code: string | null; referral_count: number;
  current_role: string | null; industry: string | null; banned: boolean;
  last_sign_in: string | null; permissions: string[] | null;
}

const ROLES = ['member', 'moderator', 'admin'];
const PLANS = ['', 'explorer', 'builder', 'climber'];
const STATUSES = ['', 'free', 'trialing', 'active', 'cancelled', 'past_due'];

// Granular permissions — matches Permission type in lib/permissions.ts
const PERMISSION_GROUPS = [
  {
    label: 'Community',
    perms: [
      { key: 'community:moderate', label: 'Moderate community', desc: 'Delete messages, pin, broadcast' },
      { key: 'community:read_all', label: 'Read all channels', desc: 'Access private channels' },
    ],
  },
  {
    label: 'Users',
    perms: [
      { key: 'users:view',   label: 'View users',   desc: 'See user list and profiles' },
      { key: 'users:edit',   label: 'Edit users',   desc: 'Change roles, plans, ban/unban' },
      { key: 'users:delete', label: 'Delete users', desc: 'Permanently delete accounts' },
    ],
  },
  {
    label: 'Content',
    perms: [
      { key: 'content:manage', label: 'Manage content', desc: 'Create, edit, delete posts' },
      { key: 'content:publish', label: 'Publish content', desc: 'Publish to production' },
    ],
  },
  {
    label: 'Intelligence',
    perms: [
      { key: 'intel:view', label: 'View intelligence', desc: 'Run AI analyses' },
    ],
  },
  {
    label: 'Finance',
    perms: [
      { key: 'finance:view', label: 'View revenue data', desc: 'See subscription and payment data' },
    ],
  },
];

const G = 'var(--ledger-gold)';
const mono: React.CSSProperties = { fontFamily:"var(--ledger-font-mono)", fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase' as const, color:'var(--ledger-ink-faint)' };
const inp: React.CSSProperties  = { padding:'10px 14px', borderRadius:'var(--ledger-radius-md)', border:'1px solid var(--ledger-line-strong)', background:'var(--ledger-bg-card)', color:'var(--ledger-ink)', fontSize:13, fontFamily:"var(--ledger-font-ui)", outline:'none', transition:'border-color 0.2s' };
const cardSt: React.CSSProperties = { background:'var(--ledger-bg-deep)', border:'1px solid var(--ledger-line)', borderRadius:'var(--ledger-radius-lg)' };

export default function AdminUsersPage() {
  const [users,        setUsers]        = useState<User[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page,         setPage]         = useState(0);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeTab,    setActiveTab]    = useState<'details'|'permissions'>('details');
  const [actionLoading,setActionLoading]= useState(false);
  const [toast,        setToast]        = useState('');
  const [deleteConfirm,setDeleteConfirm]= useState('');
  const supabase = useMemo(() => createClient(), []);

  const showToast = (msg: string, err = false) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user: caller } } = await supabase.auth.getUser();
      if (!caller) return;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return;
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', String(page));
      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [search, roleFilter, statusFilter, page, supabase]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const doAction = async (userId: string, action: string, value?: string | string[]) => {
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
        body: JSON.stringify({ targetUserId: userId, action, value }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        if (action === 'delete') { setSelectedUser(null); }
        fetchUsers();
      } else {
        showToast(`Error: ${data.error}`, true);
      }
    } catch { showToast('Action failed', true); }
    setActionLoading(false);
  };

  // C-04: Permissions are now updated through the API route (not directly via browser Supabase client)
  // so that the audit log is always written and server-side permission validation is enforced.
  const setPermissions = async (userId: string, permissions: string[]) => {
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
        body: JSON.stringify({ targetUserId: userId, action: 'set_permissions', value: permissions }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Permissions updated');
        setSelectedUser(prev => prev ? { ...prev, permissions } : null);
        fetchUsers();
      } else {
        showToast(`Failed: ${data.error}`, true);
      }
    } catch {
      showToast('Failed to update permissions', true);
    }
    setActionLoading(false);
  };

  const togglePerm = (userId: string, perm: string, current: string[]) => {
    const next = current.includes(perm)
      ? current.filter(p => p !== perm)
      : [...current, perm];
    setPermissions(userId, next);
  };

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '—';

  const statusBadge = (status: string | null, banned: boolean) => {
    if (banned) return { color:'var(--ledger-bad)', bg:'var(--ledger-bad-bg)', label:'Banned' };
    const map: Record<string, any> = {
      active:    { color:'var(--ledger-good)', bg:'var(--ledger-good-bg)', label:'Active' },
      trialing:  { color:G,                    bg:'var(--ledger-gold-bg)', label:'Trial' },
      cancelled: { color:'var(--ledger-ink-faint)', bg:'var(--ledger-bg-input)', label:'Cancelled' },
      past_due:  { color:'var(--ledger-bad)', bg:'var(--ledger-bad-bg)',   label:'Past Due' },
    };
    return map[status || ''] || { color:'var(--ledger-ink-faint)', bg:'var(--ledger-bg-input)', label:'Free' };
  };

  const totalPages = Math.ceil(total / 50) || 1;

  return (
    <div style={{ maxWidth:1400, margin:'0 auto' }}>
      <style>{`
        @keyframes asc-spin { to { transform:rotate(360deg); } }
        .asc-input:focus  { border-color:var(--ledger-gold) !important; }
        .asc-input:hover  { border-color:var(--ledger-ink-faint) !important; }
        .asc-tr:hover td  { background:var(--ledger-bg-card-hover) !important; }
        .asc-row-btn:hover { border-color:var(--ledger-gold) !important; color:var(--ledger-gold) !important; }
        .perm-toggle { transition:all 0.15s; }
        .perm-toggle:hover { border-color:var(--ledger-gold) !important; }
        * { box-sizing:border-box; }
        @media(max-width:767px) {
          .asc-desktop { display:none !important; }
          .asc-mobile  { display:flex !important; }
        }
        @media(min-width:768px) {
          .asc-desktop { display:block !important; }
          .asc-mobile  { display:none !important; }
        }
      `}</style>

      {/* Toast — role="alert" announces to screen readers (M-05) */}
      {toast && (
        <div role="alert" aria-atomic="true" style={{ position:'fixed', top:20, right:20, zIndex:9999, background:'var(--ledger-gold)', color:'var(--ledger-bg-deep)', padding:'10px 20px', borderRadius:'var(--ledger-radius-lg)', fontFamily:"var(--ledger-font-mono)", fontSize:12, fontWeight:600, boxShadow:'var(--ledger-shadow)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:28, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 className="ledger-h1" style={{ fontSize:28, marginBottom:6 }}>
            User Management
          </h1>
          <p style={{ ...mono }}>{total.toLocaleString()} total users</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <input type="text" placeholder="Search name, email, referral code..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          className="asc-input" style={{ ...inp, flex:1, minWidth:220 }} />
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(0); }}
          className="asc-input" style={{ ...inp, cursor:'pointer' }}>
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          className="asc-input" style={{ ...inp, cursor:'pointer' }}>
          <option value="">All Statuses</option>
          {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ ...cardSt, overflow:'hidden', marginBottom:16 }}>
        {loading ? (
          <div style={{ padding:48, textAlign:'center' }}>
            <div style={{ width:28, height:28, borderRadius:'50%', border:'2px solid var(--ledger-line-strong)', borderTopColor:'var(--ledger-gold)', animation:'asc-spin 0.9s linear infinite', margin:'0 auto 12px' }} />
            <p style={{ ...mono }}>Loading users…</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="asc-desktop" style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--ledger-line)' }}>
                    {['User','Role','Plan','Status','Permissions','Joined','Actions'].map(h => (
                      <th key={h} style={{ padding:'12px 16px', textAlign:'left', ...mono, fontWeight:500, whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const badge = statusBadge(u.subscription_status, u.banned);
                    const permCount = u.permissions?.length || 0;
                    return (
                      <tr key={u.id} className="asc-tr" style={{ borderBottom:'1px solid var(--ledger-line)', opacity:u.banned ? 0.55 : 1 }}>
                        <td style={{ padding:'13px 16px' }}>
                          <div style={{ fontFamily:"var(--ledger-font-ui)", fontWeight:600, fontSize:13, color:'var(--ledger-ink)', marginBottom:2 }}>{u.full_name || 'Unnamed'}</div>
                          <div style={{ fontFamily:"var(--ledger-font-mono)", fontSize:11, color:'var(--ledger-ink-faint)' }}>{u.email}</div>
                          {u.current_role && <div style={{ ...mono, fontSize:10, marginTop:2 }}>{u.current_role}{u.industry ? ` · ${u.industry}` : ''}</div>}
                        </td>
                        <td style={{ padding:'13px 16px' }}>
                          <select value={u.role} onChange={e => doAction(u.id, 'change_role', e.target.value)} disabled={actionLoading}
                            className="asc-input" style={{ ...inp, padding:'5px 10px', fontSize:11, cursor:'pointer' }}>
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                        <td style={{ padding:'13px 16px' }}>
                          <span style={{ ...mono, fontSize:11, color:'var(--ledger-ink-soft)' }}>{u.subscription_plan || 'free'}</span>
                        </td>
                        <td style={{ padding:'13px 16px' }}>
                          <span style={{ padding:'3px 10px', borderRadius:100, fontFamily:"var(--ledger-font-mono)", fontSize:10, fontWeight:500, letterSpacing:'0.06em', textTransform:'uppercase', background:badge.bg, color:badge.color }}>
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ padding:'13px 16px' }}>
                          <span style={{ ...mono, fontSize:11, color: permCount > 0 ? G : 'var(--ledger-ink-faint)' }}>
                            {permCount > 0 ? `${permCount} granted` : 'default'}
                          </span>
                        </td>
                        <td style={{ padding:'13px 16px', whiteSpace:'nowrap' }}>
                          <span style={{ ...mono, fontSize:11 }}>{fmtDate(u.created_at)}</span>
                        </td>
                        <td style={{ padding:'13px 16px' }}>
                          <div style={{ display:'flex', gap:6 }}>
                            <button onClick={() => { setSelectedUser(u); setActiveTab('details'); setDeleteConfirm(''); }}
                              className="asc-row-btn" style={{ ...inp, padding:'5px 12px', fontSize:11, cursor:'pointer', color:'var(--ledger-ink-soft)' }}>
                              Details
                            </button>
                            <button onClick={() => { setSelectedUser(u); setActiveTab('permissions'); }}
                              className="asc-row-btn" style={{ ...inp, padding:'5px 12px', fontSize:11, cursor:'pointer', color:'var(--ledger-ink-soft)' }}>
                              Perms
                            </button>
                            {u.banned ? (
                              <button onClick={() => doAction(u.id, 'unban')} disabled={actionLoading}
                                style={{ ...inp, padding:'5px 12px', fontSize:11, cursor:'pointer', color:'var(--ledger-good)', borderColor:'rgba(79,143,79,0.3)' }}>
                                Unban
                              </button>
                            ) : (
                              <button onClick={() => { if (confirm(`Ban ${u.full_name || u.email}?`)) doAction(u.id, 'ban'); }} disabled={actionLoading}
                                style={{ ...inp, padding:'5px 12px', fontSize:11, cursor:'pointer', color:'var(--ledger-bad)', borderColor:'rgba(200,74,56,0.3)' }}>
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
            {/* Mobile cards */}
            <div className="asc-mobile" style={{ display:'none', flexDirection:'column' }}>
              {users.map(u => {
                const badge = statusBadge(u.subscription_status, u.banned);
                return (
                  <div key={u.id} style={{ padding:16, borderBottom:'1px solid var(--ledger-line)', opacity:u.banned ? 0.6 : 1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <div>
                        <div style={{ fontFamily:"var(--ledger-font-ui)", fontWeight:600, fontSize:14, color:'var(--ledger-ink)' }}>{u.full_name || 'Unnamed'}</div>
                        <div style={{ fontFamily:"var(--ledger-font-mono)", fontSize:11, color:'var(--ledger-ink-faint)', marginTop:2 }}>{u.email}</div>
                      </div>
                      <span style={{ padding:'3px 10px', borderRadius:100, fontFamily:"var(--ledger-font-mono)", fontSize:10, fontWeight:500, textTransform:'uppercase' as const, background:badge.bg, color:badge.color }}>
                        {badge.label}
                      </span>
                    </div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <button onClick={() => { setSelectedUser(u); setActiveTab('details'); }} style={{ ...inp, padding:'6px 14px', fontSize:12, cursor:'pointer', color:'var(--ledger-ink-soft)' }}>Details</button>
                      <button onClick={() => { setSelectedUser(u); setActiveTab('permissions'); }} style={{ ...inp, padding:'6px 14px', fontSize:12, cursor:'pointer', color:'var(--ledger-ink-soft)' }}>Permissions</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:16 }}>
        <button onClick={() => setPage(p => Math.max(0,p-1))} disabled={page===0}
          className="asc-row-btn" style={{ ...inp, cursor:page===0?'not-allowed':'pointer', opacity:page===0?0.35:1, color:'var(--ledger-ink-soft)' }}>
          Previous
        </button>
        <span style={{ ...mono }}>Page {page+1} of {totalPages}</span>
        <button onClick={() => setPage(p=>p+1)} disabled={users.length<50}
          className="asc-row-btn" style={{ ...inp, cursor:users.length<50?'not-allowed':'pointer', opacity:users.length<50?0.35:1, color:'var(--ledger-ink-soft)' }}>
          Next
        </button>
      </div>

      {/* ── USER DETAIL MODAL ──────────────────────────────────────────────── */}
      {selectedUser && (
        <>
          <div onClick={() => setSelectedUser(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9998, backdropFilter:'blur(3px)' }} />
          <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', background:'var(--ledger-bg-deep)', border:'1px solid var(--ledger-line)', borderRadius:16, width:'90%', maxWidth:560, maxHeight:'85vh', overflowY:'auto', zIndex:9999 }}>
            {/* Modal header */}
            <div style={{ position:'sticky', top:0, background:'var(--ledger-bg-deep)', borderBottom:'1px solid var(--ledger-line)', padding:'18px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', zIndex:1 }}>
              <div>
                <h3 className="ledger-h2" style={{ fontSize:22, margin:0 }}>
                  {selectedUser.full_name || selectedUser.email}
                </h3>
                <div style={{ ...mono, fontSize:9, marginTop:3 }}>{selectedUser.role} · {selectedUser.subscription_plan || 'free'}</div>
              </div>
              <button onClick={() => setSelectedUser(null)} style={{ background:'none', border:'1px solid var(--ledger-line-strong)', borderRadius:'var(--ledger-radius-md)', color:'var(--ledger-ink-faint)', cursor:'pointer', fontSize:18, lineHeight:1, padding:'2px 10px', fontFamily:'monospace' }}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display:'flex', borderBottom:'1px solid var(--ledger-line)' }}>
              {(['details','permissions'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{ flex:1, padding:'12px', background:'none', border:'none', borderBottom:`2px solid ${activeTab===tab ? 'var(--ledger-gold)' : 'transparent'}`, color:activeTab===tab ? 'var(--ledger-gold)' : 'var(--ledger-ink-faint)', fontFamily:"var(--ledger-font-mono)", fontSize:11, letterSpacing:'0.08em', textTransform:'uppercase', cursor:'pointer', transition:'all 0.15s' }}>
                  {tab}
                </button>
              ))}
            </div>

            <div style={{ padding:24 }}>
              {/* DETAILS TAB */}
              {activeTab === 'details' && (
                <>
                  {/* Detail rows */}
                  {[
                    ['Name',         selectedUser.full_name || '—'],
                    ['Email',        selectedUser.email],
                    ['Role',         selectedUser.role],
                    ['Job Title',    selectedUser.current_role || '—'],
                    ['Industry',     selectedUser.industry || '—'],
                    ['Plan',         selectedUser.subscription_plan || 'free'],
                    ['Sub Status',   selectedUser.subscription_status || 'free'],
                    ['Sub End',      fmtDate(selectedUser.subscription_end)],
                    ['Referral Code',selectedUser.referral_code || '—'],
                    ['Referrals',    String(selectedUser.referral_count || 0)],
                    ['Joined',       fmtDate(selectedUser.created_at)],
                    ['Last Login',   fmtDate(selectedUser.last_sign_in)],
                    ['Banned',       selectedUser.banned ? '⛔ Yes' : '✓ No'],
                    ['User ID',      selectedUser.id],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid var(--ledger-line)' }}>
                      <span style={{ ...mono }}>{label}</span>
                      <span style={{ fontFamily:"var(--ledger-font-ui)", fontSize:13, color:'var(--ledger-ink)', fontWeight:500, textAlign:'right', maxWidth:'60%', wordBreak:'break-all' }}>{value}</span>
                    </div>
                  ))}

                  {/* Plan change */}
                  <div style={{ display:'flex', gap:8, marginTop:20 }}>
                    <select onChange={e => {
                        const plan = e.target.value;
                        if (!plan) return;
                        if (confirm(`Change plan to "${plan}" for ${selectedUser.full_name || selectedUser.email}?`)) {
                          doAction(selectedUser.id, 'change_plan', plan);
                        }
                        (e.target as HTMLSelectElement).value = '';
                      }}
                      className="asc-input" style={{ ...inp, flex:1, cursor:'pointer' }} defaultValue="">
                      <option value="" disabled>Change plan…</option>
                      {PLANS.filter(Boolean).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select onChange={e => { if (e.target.value) doAction(selectedUser.id, 'change_role', e.target.value); }}
                      className="asc-input" style={{ ...inp, flex:1, cursor:'pointer' }} value={selectedUser.role}>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>

                  {/* Ban/unban */}
                  <div style={{ marginTop:10 }}>
                    {selectedUser.banned ? (
                      <button onClick={() => { doAction(selectedUser.id, 'unban'); setSelectedUser(null); }}
                        style={{ ...inp, width:'100%', cursor:'pointer', color:'var(--ledger-good)', borderColor:'rgba(79,143,79,0.3)', textAlign:'center' }}>
                        ✓ Unban this user
                      </button>
                    ) : (
                      <button onClick={() => { if (confirm('Ban this user?')) { doAction(selectedUser.id, 'ban'); setSelectedUser(null); } }}
                        style={{ ...inp, width:'100%', cursor:'pointer', color:'var(--ledger-bad)', borderColor:'rgba(200,74,56,0.3)', textAlign:'center' }}>
                        ⛔ Ban this user
                      </button>
                    )}
                  </div>

                  {/* Danger zone */}
                  <div style={{ marginTop:24, padding:18, borderRadius:'var(--ledger-radius-lg)', background:'var(--ledger-bad-bg)', border:'1px solid rgba(200,74,56,0.25)' }}>
                    <p style={{ ...mono, color:'var(--ledger-bad)', marginBottom:8 }}>Danger zone — permanent delete</p>
                    <p style={{ fontFamily:"var(--ledger-font-ui)", fontSize:12, color:'var(--ledger-ink-soft)', margin:'0 0 12px', lineHeight:1.6 }}>
                      Erases account, profile, sessions, and all data. <strong style={{ color:'var(--ledger-ink)' }}>Cannot be undone.</strong> Type DELETE to confirm.
                    </p>
                    <div style={{ display:'flex', gap:8 }}>
                      <input type="text" placeholder="Type DELETE" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                        className="asc-input" style={{ ...inp, flex:1, fontSize:12, borderColor:'rgba(200,74,56,0.3)' }} />
                      <button
                        onClick={() => {
                          if (deleteConfirm === 'DELETE') { doAction(selectedUser.id, 'delete'); setSelectedUser(null); setDeleteConfirm(''); }
                        }}
                        disabled={deleteConfirm !== 'DELETE' || actionLoading}
                        style={{ ...inp, cursor:deleteConfirm==='DELETE'?'pointer':'default', color:'var(--ledger-bad)', borderColor:'rgba(200,74,56,0.4)', background:'var(--ledger-bad-bg)', fontWeight:700, whiteSpace:'nowrap', opacity:deleteConfirm==='DELETE'?1:0.4 }}>
                        Delete Account
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* PERMISSIONS TAB */}
              {activeTab === 'permissions' && (
                <>
                  <p style={{ fontFamily:"var(--ledger-font-ui)", fontSize:13, color:'var(--ledger-ink-soft)', marginBottom:20, lineHeight:1.6 }}>
                    Grant specific permissions beyond the user's base role. Changes take effect immediately.
                  </p>

                  {PERMISSION_GROUPS.map(group => (
                    <div key={group.label} style={{ marginBottom:20 }}>
                      <div style={{ ...mono, marginBottom:10 }}>{group.label}</div>
                      {group.perms.map(perm => {
                        const granted = (selectedUser.permissions || []).includes(perm.key);
                        return (
                          <button
                            key={perm.key}
                            className="perm-toggle"
                            onClick={() => togglePerm(selectedUser.id, perm.key, selectedUser.permissions || [])}
                            disabled={actionLoading}
                            style={{ display:'flex', alignItems:'center', gap:12, width:'100%', padding:'10px 12px', marginBottom:6, borderRadius:'var(--ledger-radius-md)', border:`1px solid ${granted ? 'var(--ledger-gold)' : 'var(--ledger-line-strong)'}`, background:granted ? 'var(--ledger-gold-bg)' : 'var(--ledger-bg-card)', cursor:'pointer', textAlign:'left' }}
                          >
                            {/* Toggle indicator */}
                            <div style={{ width:18, height:18, borderRadius:5, background:granted ? 'var(--ledger-gold)' : 'var(--ledger-bg-input)', border:`1.5px solid ${granted ? 'var(--ledger-gold)' : 'var(--ledger-line-strong)'}`, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}>
                              {granted && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--ledger-bg-deep)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                            </div>
                            <div>
                              <div style={{ fontFamily:"var(--ledger-font-ui)", fontSize:13, fontWeight:600, color:granted ? 'var(--ledger-gold)' : 'var(--ledger-ink)', marginBottom:1 }}>{perm.label}</div>
                              <div style={{ fontFamily:"var(--ledger-font-ui)", fontSize:11, color:'var(--ledger-ink-faint)' }}>{perm.desc}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))}

                  {/* Clear all */}
                  {(selectedUser.permissions?.length || 0) > 0 && (
                    <button onClick={() => setPermissions(selectedUser.id, [])} disabled={actionLoading}
                      style={{ ...inp, width:'100%', cursor:'pointer', color:'var(--ledger-ink-faint)', marginTop:8, textAlign:'center', fontSize:12, fontFamily:"var(--ledger-font-mono)", letterSpacing:'0.06em' }}>
                      Clear all custom permissions
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
