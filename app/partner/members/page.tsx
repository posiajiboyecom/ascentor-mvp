'use client';

// ============================================================
// PARTNER MEMBERS — app/partner/members/page.tsx
//
// Full rebuild:
//   - Stats bar: total / active / invited / suspended
//   - Tab filter: All | Active | Invited | Suspended
//   - Live search across name + email
//   - Single invite + Bulk invite (paste list of emails)
//   - Per-row action menu: Suspend | Remove | Reinstate | Resend invite
//   - Empty states per tab
//   - Pagination
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────
type Member = {
  id: string;
  email: string;
  role: string;
  status: 'active' | 'invited' | 'suspended' | 'removed';
  invited_at: string;
  joined_at: string | null;
  profiles?: {
    full_name: string | null;
    subscription_plan: string | null;
    subscription_status: string | null;
    subscription_end: string | null;
    avatar_url: string | null;
    last_sign_in_at?: string | null;
  };
};

type Breakdown = { active?: number; invited?: number; suspended?: number; removed?: number };
type Tab = 'all' | 'active' | 'invited' | 'suspended';

// ── Constants ─────────────────────────────────────────────
const PLAN_COLORS: Record<string, string> = {
  free:     'var(--text-dim)',
  explorer: '#14B8A6',
  builder:  '#E8A020',
  climber:  '#8B5CF6',
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  active:    { color: 'var(--success)',   label: 'Active'    },
  invited:   { color: '#E8A020',          label: 'Invited'   },
  suspended: { color: 'var(--error)',     label: 'Suspended' },
  removed:   { color: 'var(--text-dim)',  label: 'Removed'   },
};

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  outline: 'none',
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: 13,
  width: '100%',
};

// ── Helpers ───────────────────────────────────────────────
function initials(name: string | null, email: string) {
  const src = name || email;
  return src.split(/[\s@]/).map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

function relativeDate(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30)  return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ── Avatar ────────────────────────────────────────────────
function Avatar({ member }: { member: Member }) {
  const name = member.profiles?.full_name || null;
  const init = initials(name, member.email);
  const avatarUrl = member.profiles?.avatar_url;
  return avatarUrl ? (
    <img
      src={avatarUrl}
      alt={name || member.email}
      style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
    />
  ) : (
    <div style={{
      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
      background: 'rgba(232,160,32,0.1)', color: 'var(--accent)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700, border: '1px solid rgba(232,160,32,0.2)',
    }}>
      {init}
    </div>
  );
}

// ── Action Menu ───────────────────────────────────────────
function ActionMenu({
  member,
  onAction,
}: {
  member: Member;
  onAction: (id: string, action: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const actions: { label: string; action: string; color?: string; show: boolean }[] = [
    { label: 'Resend Invite',  action: 'resend_invite', show: member.status === 'invited' },
    { label: 'Suspend',        action: 'suspend',       show: member.status === 'active'  },
    { label: 'Reinstate',      action: 'reinstate',     show: member.status === 'suspended' },
    { label: 'Remove',         action: 'remove',        color: 'var(--error)', show: member.status !== 'removed' },
  ].filter(a => a.show);

  if (actions.length === 0) return null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '4px 10px', borderRadius: 7, border: '1px solid var(--border)',
          background: 'transparent', color: 'var(--text-dim)',
          cursor: 'pointer', fontSize: 16, lineHeight: 1,
        }}
      >
        ···
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 100,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, overflow: 'hidden', minWidth: 148,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          {actions.map(a => (
            <button
              key={a.action}
              onClick={() => { onAction(member.id, a.action); setOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px', border: 'none', background: 'transparent',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                color: a.color || 'var(--text)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '14px 18px',
    }}>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 6 }}>
        {label}
      </p>
      <p style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
        {value}
      </p>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────
function Toast({ msg, onDismiss }: { msg: { type: 'success' | 'error'; text: string }; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [msg]);

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 999,
      background: msg.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
      border: `1px solid ${msg.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
      borderRadius: 12, padding: '12px 18px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      animation: 'fadeInUp 0.2s ease',
    }}>
      <span style={{ fontSize: 14 }}>{msg.type === 'success' ? '✓' : '✗'}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{msg.text}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function MembersAdminPage() {
  const [members,   setMembers]   = useState<Member[]>([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [pages,     setPages]     = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [breakdown, setBreakdown] = useState<Breakdown>({});

  const [tab,       setTab]       = useState<Tab>('all');
  const [search,    setSearch]    = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Single invite
  const [inviteEmail,  setInviteEmail]  = useState('');
  const [inviting,     setInviting]     = useState(false);

  // Bulk invite
  const [bulkMode,   setBulkMode]   = useState(false);
  const [bulkEmails, setBulkEmails] = useState('');
  const [bulkResult, setBulkResult] = useState<null | { invited: number; skipped: number; errors: number }>(null);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Action loading state per member
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Debounce search ──────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── Fetch ────────────────────────────────────────────────
  const fetchMembers = useCallback(async (p = 1, tabOverride?: Tab, searchOverride?: string) => {
    setLoading(true);
    const activeTab    = tabOverride    ?? tab;
    const activeSearch = searchOverride ?? debouncedSearch;

    const params = new URLSearchParams({
      page:   String(p),
      limit:  '50',
      status: activeTab === 'all' ? 'all' : activeTab,
      ...(activeSearch ? { search: activeSearch } : {}),
    });

    const res = await fetch(`/api/partner/members?${params}`);
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members);
      setTotal(data.total);
      setPages(data.pages);
      setPage(p);
      if (data.breakdown) setBreakdown(data.breakdown);
    }
    setLoading(false);
  }, [tab, debouncedSearch]);

  useEffect(() => { fetchMembers(1); }, [tab, debouncedSearch]);

  // ── Invite single ────────────────────────────────────────
  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);

    const res = await fetch('/api/partner/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();

    if (res.ok && data.summary?.invited > 0) {
      setToast({ type: 'success', text: `Invite sent to ${email}` });
      setInviteEmail('');
      fetchMembers(1);
    } else if (data.summary?.skipped > 0) {
      setToast({ type: 'error', text: `${email} is already a member` });
    } else {
      setToast({ type: 'error', text: data.error || 'Invite failed' });
    }
    setInviting(false);
  };

  // ── Bulk invite ──────────────────────────────────────────
  const handleBulkInvite = async () => {
    const emails = bulkEmails
      .split(/[\n,;]+/)
      .map(e => e.trim())
      .filter(e => e.includes('@'));

    if (emails.length === 0) {
      setToast({ type: 'error', text: 'No valid emails found' });
      return;
    }
    setInviting(true);
    setBulkResult(null);

    const res = await fetch('/api/partner/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails }),
    });
    const data = await res.json();

    if (res.ok) {
      setBulkResult(data.summary);
      setToast({ type: 'success', text: `${data.summary.invited} invite${data.summary.invited !== 1 ? 's' : ''} sent` });
      setBulkEmails('');
      fetchMembers(1);
    } else {
      setToast({ type: 'error', text: data.error || 'Bulk invite failed' });
    }
    setInviting(false);
  };

  // ── Member action ─────────────────────────────────────────
  const handleAction = async (memberId: string, action: string) => {
    setActionLoading(memberId);

    const res = await fetch('/api/partner/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, action }),
    });
    const data = await res.json();

    if (res.ok) {
      const msgs: Record<string, string> = {
        suspend:      'Member suspended',
        remove:       'Member removed',
        reinstate:    'Member reinstated',
        resend_invite: 'Invite resent',
      };
      setToast({ type: 'success', text: msgs[action] || 'Done' });
      fetchMembers(page);
    } else {
      setToast({ type: 'error', text: data.error || 'Action failed' });
    }
    setActionLoading(null);
  };

  // ── Tabs ──────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'all',       label: 'All',       count: Object.values(breakdown).reduce((a, b) => a + (b || 0), 0) - (breakdown.removed || 0) },
    { id: 'active',    label: 'Active',    count: breakdown.active    || 0 },
    { id: 'invited',   label: 'Invited',   count: breakdown.invited   || 0 },
    { id: 'suspended', label: 'Suspended', count: breakdown.suspended || 0 },
  ];

  // ── Empty state text ──────────────────────────────────────
  const emptyMessages: Record<Tab, { icon: string; title: string; desc: string }> = {
    all:       { icon: '⬡', title: 'No members yet',       desc: 'Invite your first member using the form above.' },
    active:    { icon: '✦', title: 'No active members',    desc: 'Active members will appear here once they join.' },
    invited:   { icon: '◎', title: 'No pending invites',   desc: 'Everyone you\'ve invited has already joined.' },
    suspended: { icon: '◈', title: 'No suspended members', desc: 'Suspended members will appear here.' },
  };
  const empty = emptyMessages[tab];

  return (
    <div className="animate-fade-up" style={{ maxWidth: 820 }}>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        .member-row:hover { background: rgba(255,255,255,0.02) !important; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 28, color: 'var(--text)', marginBottom: 4 }}>
            Members
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
            Manage who has access to your platform
          </p>
        </div>
        <button
          onClick={() => { setBulkMode(b => !b); setBulkResult(null); }}
          style={{
            padding: '9px 16px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700,
            background: bulkMode ? 'rgba(232,160,32,0.12)' : 'var(--bg-card)',
            color: bulkMode ? 'var(--accent)' : 'var(--text-dim)',
            border: `1px solid ${bulkMode ? 'rgba(232,160,32,0.3)' : 'var(--border)'}`,
            transition: 'all 0.15s',
          }}
        >
          {bulkMode ? '✕ Cancel Bulk' : '⊕ Bulk Invite'}
        </button>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
        <StatCard label="Total"     value={(breakdown.active || 0) + (breakdown.invited || 0) + (breakdown.suspended || 0)} color="var(--text)" />
        <StatCard label="Active"    value={breakdown.active    || 0} color="var(--success)" />
        <StatCard label="Invited"   value={breakdown.invited   || 0} color="#E8A020" />
        <StatCard label="Suspended" value={breakdown.suspended || 0} color="var(--error)" />
      </div>

      {/* ── Invite area ── */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '16px 18px', marginBottom: 20,
      }}>
        {!bulkMode ? (
          <>
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
                  padding: '10px 24px', borderRadius: 10, border: 'none',
                  background: 'var(--accent)', color: '#000',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  opacity: (inviting || !inviteEmail.trim()) ? 0.5 : 1,
                  whiteSpace: 'nowrap', transition: 'opacity 0.15s',
                }}
              >
                {inviting ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 6 }}>
              Bulk Invite
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
              Paste emails separated by comma, semicolon, or newline. Max 50 at a time.
            </p>
            <textarea
              value={bulkEmails}
              onChange={e => setBulkEmails(e.target.value)}
              placeholder={`alice@company.com\nbob@company.com\nchidi@example.com`}
              rows={5}
              style={{
                ...inputStyle,
                resize: 'vertical', fontFamily: 'monospace', fontSize: 12,
                lineHeight: 1.6, marginBottom: 10,
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={handleBulkInvite}
                disabled={inviting || !bulkEmails.trim()}
                style={{
                  padding: '10px 24px', borderRadius: 10, border: 'none',
                  background: 'var(--accent)', color: '#000',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  opacity: (inviting || !bulkEmails.trim()) ? 0.5 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {inviting ? 'Sending...' : `Send ${bulkEmails.split(/[\n,;]+/).filter(e => e.trim().includes('@')).length || 0} Invites`}
              </button>
              {bulkResult && (
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  <span style={{ color: 'var(--success)', fontWeight: 700 }}>{bulkResult.invited} sent</span>
                  {bulkResult.skipped > 0 && <> · {bulkResult.skipped} already members</>}
                  {bulkResult.errors > 0  && <> · <span style={{ color: 'var(--error)' }}>{bulkResult.errors} failed</span></>}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Tabs + Search ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 2, padding: 3,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, flexShrink: 0,
        }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                background: tab === t.id ? 'var(--accent)' : 'transparent',
                color: tab === t.id ? '#000' : 'var(--text-dim)',
              }}
            >
              {t.label}
              {t.count > 0 && (
                <span style={{
                  marginLeft: 5, fontSize: 10, fontWeight: 700,
                  background: tab === t.id ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.07)',
                  color: tab === t.id ? '#000' : 'var(--text-dim)',
                  padding: '1px 5px', borderRadius: 4,
                }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            fontSize: 13, color: 'var(--text-dim)', pointerEvents: 'none',
          }}>
            ⌕
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            style={{ ...inputStyle, paddingLeft: 32 }}
          />
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        {/* Column headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 90px 90px 80px 40px',
          padding: '10px 18px', borderBottom: '1px solid var(--border)',
          background: 'rgba(255,255,255,0.015)',
        }}>
          {['Member', 'Plan', 'Status', 'Joined', ''].map((h, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)' }}>
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 20, color: 'var(--text-dim)', marginBottom: 8, animation: 'spin 1s linear infinite' }}>◌</div>
            <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Loading...</p>
          </div>
        ) : members.length === 0 ? (
          <div style={{ padding: '52px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 28, marginBottom: 12, color: 'var(--accent)', opacity: 0.4 }}>{empty.icon}</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{empty.title}</p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>{empty.desc}</p>
          </div>
        ) : (
          members.map((m, i) => {
            const plan    = m.profiles?.subscription_plan || 'free';
            const name    = m.profiles?.full_name || null;
            const joined  = relativeDate(m.joined_at || m.invited_at);
            const isLast  = i === members.length - 1;
            const loading = actionLoading === m.id;
            const cfg     = STATUS_CONFIG[m.status] || STATUS_CONFIG.active;

            return (
              <div
                key={m.id}
                className="member-row"
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 90px 90px 80px 40px',
                  padding: '12px 18px', alignItems: 'center',
                  borderBottom: isLast ? 'none' : '1px solid var(--border)',
                  opacity: loading ? 0.5 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {/* Identity */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                  <Avatar member={m} />
                  <div style={{ overflow: 'hidden' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {name || <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontWeight: 400 }}>No name</span>}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.email}
                    </p>
                  </div>
                </div>

                {/* Plan */}
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'capitalize', color: PLAN_COLORS[plan] || 'var(--text-dim)' }}>
                  {plan}
                </span>

                {/* Status badge */}
                <div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'capitalize',
                    padding: '3px 8px', borderRadius: 6,
                    background: `${cfg.color}14`,
                    color: cfg.color,
                    border: `1px solid ${cfg.color}30`,
                  }}>
                    {cfg.label}
                  </span>
                </div>

                {/* Joined */}
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{joined}</span>

                {/* Actions */}
                <ActionMenu member={m} onAction={handleAction} />
              </div>
            );
          })
        )}
      </div>

      {/* ── Pagination ── */}
      {pages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', marginTop: 16 }}>
          <button
            onClick={() => fetchMembers(page - 1)}
            disabled={page <= 1}
            style={{
              padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text)', cursor: 'pointer',
              fontSize: 12, opacity: page <= 1 ? 0.3 : 1,
            }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            {page} / {pages}
          </span>
          <button
            onClick={() => fetchMembers(page + 1)}
            disabled={page >= pages}
            style={{
              padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text)', cursor: 'pointer',
              fontSize: 12, opacity: page >= pages ? 0.3 : 1,
            }}
          >
            Next →
          </button>
        </div>
      )}

      {/* ── Total count ── */}
      {!loading && members.length > 0 && (
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-dim)', marginTop: 12 }}>
          Showing {members.length} of {total} member{total !== 1 ? 's' : ''}
        </p>
      )}

      {/* ── Toast ── */}
      {toast && <Toast msg={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
