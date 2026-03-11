// ============================================================
// app/partner/members/page.tsx
// Manage community members — invite, view, status
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)', color: 'var(--text)',
  border: '1px solid var(--border)', outline: 'none',
  borderRadius: 10, padding: '10px 14px', fontSize: 13, width: '100%',
};

type Member = {
  id: string;
  email: string;
  role: string;
  status: string;
  invited_at: string;
  joined_at: string | null;
  profiles?: {
    full_name: string | null;
    subscription_plan: string | null;
    subscription_status: string | null;
    avatar_url: string | null;
  };
};

const PLAN_COLORS: Record<string, string> = {
  free:     'var(--text-dim)',
  explorer: '#14B8A6',
  builder:  '#E8A020',
  climber:  '#8B5CF6',
};

const STATUS_COLORS: Record<string, string> = {
  active:    'var(--success)',
  invited:   'var(--accent)',
  suspended: 'var(--error)',
  removed:   'var(--text-dim)',
};

export default function MembersAdminPage() {
  const [members, setMembers]         = useState<Member[]>([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [pages, setPages]             = useState(1);
  const [loading, setLoading]         = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting]       = useState(false);
  const [inviteMsg, setInviteMsg]     = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [search, setSearch]           = useState('');

  const fetchMembers = useCallback(async (p = 1) => {
    setLoading(true);
    const res = await fetch(`/api/partner/members?page=${p}`);
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members);
      setTotal(data.total);
      setPages(data.pages);
      setPage(p);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchMembers(1); }, [fetchMembers]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true); setInviteMsg(null);

    const res = await fetch('/api/partner/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim() }),
    });
    const data = await res.json();

    if (res.ok) {
      setInviteMsg({ type: 'success', text: `Invite sent to ${inviteEmail}` });
      setInviteEmail('');
      fetchMembers(page);
    } else {
      setInviteMsg({ type: 'error', text: data.error || 'Invite failed' });
    }
    setInviting(false);
  };

  const filtered = search.trim()
    ? members.filter(m =>
        m.email.toLowerCase().includes(search.toLowerCase()) ||
        (m.profiles?.full_name || '').toLowerCase().includes(search.toLowerCase())
      )
    : members;

  return (
    <div className="animate-fade-up" style={{ maxWidth: 760 }}>
      <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, color: 'var(--text)', marginBottom: 4 }}>
        Members
      </h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 28 }}>
        {total} member{total !== 1 ? 's' : ''} in your community
      </p>

      {/* ── Invite ── */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '16px 18px', marginBottom: 24,
      }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 12 }}>
          Invite Member
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleInvite()}
            placeholder="member@email.com"
            type="email"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail.trim()}
            style={{
              padding: '10px 22px', borderRadius: 10, border: 'none',
              background: 'var(--accent)', color: '#000',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              opacity: inviting ? 0.5 : 1, whiteSpace: 'nowrap',
            }}>
            {inviting ? 'Sending...' : 'Send Invite'}
          </button>
        </div>
        {inviteMsg && (
          <p style={{
            marginTop: 8, fontSize: 12, fontWeight: 600,
            color: inviteMsg.type === 'success' ? 'var(--success)' : 'var(--error)',
          }}>
            {inviteMsg.type === 'success' ? '✓ ' : '✗ '}{inviteMsg.text}
          </p>
        )}
      </div>

      {/* ── Search ── */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search members..."
        style={{ ...inputStyle, marginBottom: 16 }}
      />

      {/* ── Table ── */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 100px 90px 90px',
          padding: '10px 18px', borderBottom: '1px solid var(--border)',
        }}>
          {['Member', 'Plan', 'Status', 'Joined'].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)' }}>
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
            {search ? 'No members match your search.' : 'No members yet. Send your first invite above.'}
          </div>
        ) : (
          filtered.map((m, i) => {
            const plan   = m.profiles?.subscription_plan || 'free';
            const name   = m.profiles?.full_name;
            const initials = (name || m.email).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            const joinDate = m.joined_at
              ? new Date(m.joined_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: '2-digit' })
              : '—';

            return (
              <div key={m.id}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 100px 90px 90px',
                  padding: '12px 18px', alignItems: 'center',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                {/* Member identity */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {m.profiles?.avatar_url ? (
                    <img src={m.profiles.avatar_url} alt={name || ''} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'rgba(245,158,11,0.12)', color: 'var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                    }}>
                      {initials}
                    </div>
                  )}
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{name || '—'}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{m.email}</p>
                  </div>
                </div>

                {/* Plan */}
                <span style={{
                  fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                  color: PLAN_COLORS[plan] || 'var(--text-dim)',
                }}>
                  {plan}
                </span>

                {/* Status */}
                <span style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'capitalize',
                  color: STATUS_COLORS[m.status] || 'var(--text-dim)',
                }}>
                  {m.status}
                </span>

                {/* Joined */}
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{joinDate}</span>
              </div>
            );
          })
        )}
      </div>

      {/* ── Pagination ── */}
      {pages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <button
            onClick={() => fetchMembers(page - 1)}
            disabled={page <= 1}
            style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text)', cursor: 'pointer',
              fontSize: 12, opacity: page <= 1 ? 0.3 : 1,
            }}>
            ← Prev
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', alignSelf: 'center' }}>
            Page {page} of {pages}
          </span>
          <button
            onClick={() => fetchMembers(page + 1)}
            disabled={page >= pages}
            style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text)', cursor: 'pointer',
              fontSize: 12, opacity: page >= pages ? 0.3 : 1,
            }}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
