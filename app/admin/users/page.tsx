'use client';
// app/admin/users/page.tsx, THE LEDGER
// Ascentor platform users only, i.e. people with a profiles row (member/
// moderator/admin, subscription plan free/explorer/builder/climber). This
// is NOT Elevation Summit registrants; Ascentor and the Summit are separate
// products with separate data. Summit registrations live entirely on
// /admin/summit-payments and never appear here.
//
// View-only: search, filter, and inspect user details. Role, permissions
// and ban/unban are managed exclusively from /admin/permissions (Access
// Control), never from a casual dropdown on this page. Only "change plan"
// and the already-gated "type DELETE to confirm" account deletion remain
// here as admin-support actions.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { confirmAction } from '@/components/Modal';
import { createClient } from '@/lib/supabase/client';
import { ShieldCheck, Shield, User as UserIcon, X } from 'lucide-react';

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

const G = 'var(--ledger-gold)';
const mono: React.CSSProperties = { fontFamily:"var(--ledger-font-mono)", fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase' as const, color:'var(--ledger-ink-faint)' };
const inp: React.CSSProperties  = { padding:'10px 14px', borderRadius:'var(--ledger-radius-md)', border:'1px solid var(--ledger-line-strong)', background:'var(--ledger-bg-card)', color:'var(--ledger-ink)', fontSize:13, fontFamily:"var(--ledger-font-ui)", outline:'none', transition:'border-color 0.2s' };
const cardSt: React.CSSProperties = { background:'var(--ledger-bg-deep)', border:'1px solid var(--ledger-line)', borderRadius:'var(--ledger-radius-lg)' };

const ROLE_META: Record<string, { icon: typeof ShieldCheck; color: string; bg: string; label: string }> = {
  admin:     { icon: ShieldCheck, color: G,                     bg: 'var(--ledger-gold-bg)',  label: 'Admin' },
  moderator: { icon: Shield,      color: 'var(--ledger-info)',  bg: 'var(--ledger-info-bg)',  label: 'Moderator' },
  member:    { icon: UserIcon,    color: 'var(--ledger-ink-faint)', bg: 'var(--ledger-bg-input)', label: 'Member' },
};

function RolePill({ role }: { role: string }) {
  const meta = ROLE_META[role] || ROLE_META.member;
  const Icon = meta.icon;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:100, fontFamily:"var(--ledger-font-mono)", fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', background:meta.bg, color:meta.color }}>
      <Icon size={11} /> {meta.label}
    </span>
  );
}

export default function AdminUsersPage() {
  const [users,        setUsers]        = useState<User[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page,         setPage]         = useState(0);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
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

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '-';

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

      {/* Toast, role="alert" announces to screen readers (M-05) */}
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
          <p style={{ ...mono }}>{total.toLocaleString()} Ascentor platform users. View only, role and access changes happen in Access Control. Elevation Summit registrants are on a separate page.</p>
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
            <p style={{ ...mono }}>Loading users...</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="asc-desktop" style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--ledger-line)' }}>
                    {['User','Role','Plan','Status','Joined',''].map(h => (
                      <th key={h} style={{ padding:'12px 16px', textAlign:'left', ...mono, fontWeight:500, whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const badge = statusBadge(u.subscription_status, u.banned);
                    return (
                      <tr key={u.id} className="asc-tr" style={{ borderBottom:'1px solid var(--ledger-line)', opacity:u.banned ? 0.55 : 1, cursor:'pointer' }}
                        onClick={() => { setSelectedUser(u); setDeleteConfirm(''); }}>
                        <td style={{ padding:'13px 16px' }}>
                          <div style={{ fontFamily:"var(--ledger-font-ui)", fontWeight:600, fontSize:13, color:'var(--ledger-ink)', marginBottom:2 }}>{u.full_name || 'Unnamed'}</div>
                          <div style={{ fontFamily:"var(--ledger-font-mono)", fontSize:11, color:'var(--ledger-ink-faint)' }}>{u.email}</div>
                          {u.current_role && <div style={{ ...mono, fontSize:10, marginTop:2 }}>{u.current_role}{u.industry ? ` · ${u.industry}` : ''}</div>}
                        </td>
                        <td style={{ padding:'13px 16px' }}><RolePill role={u.role} /></td>
                        <td style={{ padding:'13px 16px' }}>
                          <span style={{ ...mono, fontSize:11, color:'var(--ledger-ink-soft)' }}>{u.subscription_plan || 'free'}</span>
                        </td>
                        <td style={{ padding:'13px 16px' }}>
                          <span style={{ padding:'3px 10px', borderRadius:100, fontFamily:"var(--ledger-font-mono)", fontSize:10, fontWeight:500, letterSpacing:'0.06em', textTransform:'uppercase', background:badge.bg, color:badge.color }}>
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ padding:'13px 16px', whiteSpace:'nowrap' }}>
                          <span style={{ ...mono, fontSize:11 }}>{fmtDate(u.created_at)}</span>
                        </td>
                        <td style={{ padding:'13px 16px' }}>
                          <button onClick={(e) => { e.stopPropagation(); setSelectedUser(u); setDeleteConfirm(''); }}
                            className="asc-row-btn" style={{ ...inp, padding:'5px 12px', fontSize:11, cursor:'pointer', color:'var(--ledger-ink-soft)' }}>
                            Details
                          </button>
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
                  <div key={u.id} style={{ padding:16, borderBottom:'1px solid var(--ledger-line)', opacity:u.banned ? 0.6 : 1 }}
                    onClick={() => { setSelectedUser(u); setDeleteConfirm(''); }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <div>
                        <div style={{ fontFamily:"var(--ledger-font-ui)", fontWeight:600, fontSize:14, color:'var(--ledger-ink)' }}>{u.full_name || 'Unnamed'}</div>
                        <div style={{ fontFamily:"var(--ledger-font-mono)", fontSize:11, color:'var(--ledger-ink-faint)', marginTop:2 }}>{u.email}</div>
                      </div>
                      <span style={{ padding:'3px 10px', borderRadius:100, fontFamily:"var(--ledger-font-mono)", fontSize:10, fontWeight:500, textTransform:'uppercase' as const, background:badge.bg, color:badge.color }}>
                        {badge.label}
                      </span>
                    </div>
                    <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                      <RolePill role={u.role} />
                      <button onClick={(e) => { e.stopPropagation(); setSelectedUser(u); setDeleteConfirm(''); }} style={{ ...inp, padding:'6px 14px', fontSize:12, cursor:'pointer', color:'var(--ledger-ink-soft)' }}>Details</button>
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

      {/* ── USER DETAIL MODAL (view-only, plus plan change and gated delete) ── */}
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
                <div style={{ marginTop:6 }}><RolePill role={selectedUser.role} /></div>
              </div>
              <button onClick={() => setSelectedUser(null)} aria-label="Close" style={{ background:'none', border:'1px solid var(--ledger-line-strong)', borderRadius:'var(--ledger-radius-md)', color:'var(--ledger-ink-faint)', cursor:'pointer', padding:'6px 10px', display:'flex' }}><X size={16} /></button>
            </div>

            <div style={{ padding:24 }}>
              {/* Detail rows */}
              {[
                ['Name',         selectedUser.full_name || '-'],
                ['Email',        selectedUser.email],
                ['Job Title',    selectedUser.current_role || '-'],
                ['Industry',     selectedUser.industry || '-'],
                ['Plan',         selectedUser.subscription_plan || 'free'],
                ['Sub Status',   selectedUser.subscription_status || 'free'],
                ['Sub End',      fmtDate(selectedUser.subscription_end)],
                ['Referral Code',selectedUser.referral_code || '-'],
                ['Referrals',    String(selectedUser.referral_count || 0)],
                ['Joined',       fmtDate(selectedUser.created_at)],
                ['Last Login',   fmtDate(selectedUser.last_sign_in)],
                ['Banned',       selectedUser.banned ? 'Yes' : 'No'],
                ['User ID',      selectedUser.id],
              ].map(([label, value]) => (
                <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid var(--ledger-line)' }}>
                  <span style={{ ...mono }}>{label}</span>
                  <span style={{ fontFamily:"var(--ledger-font-ui)", fontSize:13, color:'var(--ledger-ink)', fontWeight:500, textAlign:'right', maxWidth:'60%', wordBreak:'break-all' }}>{value}</span>
                </div>
              ))}

              {selectedUser.banned && (
                <p style={{ fontFamily:"var(--ledger-font-mono)", fontSize:11, color:'var(--ledger-bad)', marginTop:10 }}>
                  This account is banned. Unban it from Access Control.
                </p>
              )}

              <p style={{ fontFamily:"var(--ledger-font-mono)", fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--ledger-ink-faint)', marginTop:20 }}>
                Role, permissions and ban status are managed in <a href="/admin/permissions" style={{ color:G }}>Access Control</a>.
              </p>

              {/* Plan change (billing support action; kept here, not a role/access control) */}
              <div style={{ display:'flex', gap:8, marginTop:14 }}>
                <select onChange={async e => {
                    const plan = e.target.value;
                    if (!plan) return;
                    if ((await confirmAction(`Change plan to "${plan}" for ${selectedUser.full_name || selectedUser.email}?`))) {
                      doAction(selectedUser.id, 'change_plan', plan);
                    }
                    (e.target as HTMLSelectElement).value = '';
                  }}
                  className="asc-input" style={{ ...inp, flex:1, cursor:'pointer' }} defaultValue="">
                  <option value="" disabled>Change plan...</option>
                  {PLANS.filter(Boolean).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* Danger zone */}
              <div style={{ marginTop:24, padding:18, borderRadius:'var(--ledger-radius-lg)', background:'var(--ledger-bad-bg)', border:'1px solid rgba(200,74,56,0.25)' }}>
                <p style={{ ...mono, color:'var(--ledger-bad)', marginBottom:8 }}>Danger zone: permanent delete</p>
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}
