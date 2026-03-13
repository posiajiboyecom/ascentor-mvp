// ============================================================
// app/partner/members/page.tsx  (also used via re-export at
// app/p/[subdomain]/admin/members/page.tsx)
//
// Partner member management — invite, search, status management.
// Calls /api/partner/members (GET, POST, PATCH, DELETE).
// ============================================================

'use client';

import { useState, useEffect, useRef } from 'react';

interface Member {
  id: string;
  email: string;
  full_name: string | null;
  status: 'invited' | 'active' | 'suspended' | 'removed';
  joined_at: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  active:    { bg: 'rgba(16,185,129,0.09)',  color: '#10B981', border: 'rgba(16,185,129,0.2)'  },
  invited:   { bg: 'rgba(232,160,32,0.09)',  color: '#E8A020', border: 'rgba(232,160,32,0.2)'  },
  suspended: { bg: 'rgba(239,68,68,0.09)',   color: '#EF4444', border: 'rgba(239,68,68,0.2)'   },
  removed:   { bg: 'rgba(100,100,100,0.09)', color: '#6B7280', border: 'rgba(100,100,100,0.2)' },
};

export default function MembersAdminPage() {
  const [members,    setMembers]    = useState<Member[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [statusFilter, setStatus]   = useState('all');
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total,      setTotal]      = useState(0);
  const [inviteEmail, setInvite]    = useState('');
  const [inviting,   setInviting]   = useState(false);
  const [inviteMsg,  setInviteMsg]  = useState('');
  const [actionId,   setActionId]   = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setPage(1); fetchMembers(1); }, 350);
  }, [search, statusFilter]);

  useEffect(() => { fetchMembers(page); }, [page]);

  async function fetchMembers(p = 1) {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(p), limit: '20',
      ...(search ? { search } : {}),
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    });
    const res  = await fetch(`/api/partner/members?${params}`);
    const data = await res.json();
    setMembers(data.members || []);
    setTotal(data.total || 0);
    setTotalPages(data.pages || 1);
    setLoading(false);
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true); setInviteMsg('');
    const res  = await fetch('/api/partner/members', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim() }),
    });
    const data = await res.json();
    if (res.ok) { setInviteMsg(`✓ Invite sent to ${inviteEmail}`); setInvite(''); fetchMembers(1); }
    else { setInviteMsg(`Error: ${data.error || 'Failed to invite'}`); }
    setInviting(false);
  }

  async function handleAction(memberId: string, action: 'suspend' | 'reactivate' | 'remove') {
    setActionId(memberId);
    await fetch('/api/partner/members', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, action }),
    });
    setActionId(null);
    fetchMembers(page);
  }

  const card: React.CSSProperties = {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '16px 20px', marginBottom: 10,
  };
  const inp: React.CSSProperties = {
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    color: 'var(--text)', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none',
  };
  const btn = (accent = false): React.CSSProperties => ({
    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    border: 'none', background: accent ? 'var(--accent)' : 'var(--bg-input)',
    color: accent ? '#000' : 'var(--text-dim)',
  });

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 28, color: 'var(--text)', marginBottom: 4 }}>Members</h1>
      <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24 }}>Invite and manage your platform members</p>

      <div style={{ ...card, display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
        <input style={{ ...inp, flex: 1 }} placeholder="email@example.com" value={inviteEmail}
          onChange={e => setInvite(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleInvite()} />
        <button style={btn(true)} onClick={handleInvite} disabled={inviting}>{inviting ? 'Sending…' : 'Send Invite'}</button>
      </div>
      {inviteMsg && <p style={{ fontSize: 12, marginBottom: 16, color: inviteMsg.startsWith('✓') ? 'var(--success)' : 'var(--error)' }}>{inviteMsg}</p>}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input style={{ ...inp, width: 220 }} placeholder="Search name or email…" value={search} onChange={e => setSearch(e.target.value)} />
        <select style={inp} value={statusFilter} onChange={e => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="invited">Invited</option>
          <option value="suspended">Suspended</option>
          <option value="removed">Removed</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-dim)', alignSelf: 'center' }}>{total} member{total !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--text-dim)', padding: '20px 0' }}>Loading…</p>
      ) : members.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>{search ? 'No members match your search.' : 'No members yet. Send your first invite above.'}</p>
        </div>
      ) : members.map(m => {
        const sc = STATUS_COLORS[m.status] || STATUS_COLORS.active;
        return (
          <div key={m.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: 'rgba(232,160,32,0.1)', border: '1.5px solid rgba(232,160,32,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
              {(m.full_name || m.email)[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{m.full_name || '—'}</p>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</p>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{m.status}</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0, minWidth: 70, textAlign: 'right' }}>
              {m.joined_at ? new Date(m.joined_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : 'Pending'}
            </span>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {m.status === 'active'    && <button style={btn()} onClick={() => handleAction(m.id, 'suspend')}    disabled={actionId === m.id}>Suspend</button>}
              {m.status === 'suspended' && <button style={btn()} onClick={() => handleAction(m.id, 'reactivate')} disabled={actionId === m.id}>Reactivate</button>}
              {m.status !== 'removed'   && <button style={{ ...btn(), color: 'var(--error)' }} onClick={() => handleAction(m.id, 'remove')} disabled={actionId === m.id}>Remove</button>}
            </div>
          </div>
        );
      })}

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
          <button style={btn()} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', alignSelf: 'center' }}>{page} / {totalPages}</span>
          <button style={btn()} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next →</button>
        </div>
      )}
    </div>
  );
}
