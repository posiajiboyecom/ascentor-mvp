'use client';

// ============================================================
// ADMIN PARTNERS — /admin/partners
//
// Full partner management for Ascentor root admin:
//   - Tab filter: All | Pending | Active | Suspended | Rejected
//   - Search by name or subdomain
//   - Per-row: Approve (with revenue share input) | Suspend | Reject | Reinstate
//   - Inline revenue share editor
//   - Stats: member counts, total revenue per partner
//   - Approval sends email to partner owner
// ============================================================

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────
type PartnerStatus = 'pending' | 'active' | 'suspended' | 'rejected';

type Partner = {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  custom_domain: string | null;
  status: PartnerStatus;
  revenue_share_percent: number;
  created_at: string;
  owner_id: string;
  features: Record<string, boolean>;
  profiles: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    subscription_plan: string | null;
  } | null;
  member_counts: { active?: number; invited?: number; suspended?: number };
  total_revenue_ngn: number;
};

type Breakdown = Record<string, number>;
type Tab = 'all' | PartnerStatus;

// ── Style constants ───────────────────────────────────────
const STATUS_CONFIG: Record<PartnerStatus, { color: string; bg: string; label: string }> = {
  pending:   { color: '#E8A020', bg: 'rgba(232,160,32,0.08)',   label: 'Pending'   },
  active:    { color: 'var(--admin-success, #10B981)', bg: 'rgba(16,185,129,0.08)', label: 'Active' },
  suspended: { color: '#EF4444', bg: 'rgba(239,68,68,0.08)',   label: 'Suspended' },
  rejected:  { color: 'var(--admin-text-faint)', bg: 'rgba(255,255,255,0.04)', label: 'Rejected' },
};

const inputStyle: React.CSSProperties = {
  background: 'var(--admin-bg-input)',
  color: 'var(--admin-text)',
  border: '1px solid var(--admin-border)',
  outline: 'none',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 13,
};

function fmt(n: number) {
  return `₦${Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0 })}`;
}

function relDate(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: '2-digit' });
}

// ── Action menu ───────────────────────────────────────────
function ActionMenu({
  partner,
  onAction,
  onEditRevenue,
}: {
  partner: Partner;
  onAction: (id: string, action: string) => void;
  onEditRevenue: (partner: Partner) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const actions: { label: string; action?: string; special?: string; color?: string; show: boolean }[] = [
    { label: 'Approve',           action: 'approve',   show: partner.status === 'pending'   },
    { label: 'Reinstate',         action: 'reinstate', show: partner.status === 'suspended' || partner.status === 'rejected' },
    { label: 'Suspend',           action: 'suspend',   show: partner.status === 'active'    },
    { label: 'Reject',            action: 'reject',    color: '#EF4444', show: partner.status === 'pending' },
    { label: 'Edit Revenue Share', special: 'revenue', show: true },
    { label: 'View Subdomain ↗',  special: 'link',     show: true },
  ].filter(a => a.show);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '5px 10px', borderRadius: 7,
          border: '1px solid var(--admin-border)',
          background: 'transparent', color: 'var(--admin-text-muted)',
          cursor: 'pointer', fontSize: 16, lineHeight: 1,
        }}
      >
        ···
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 100,
          background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)',
          borderRadius: 10, overflow: 'hidden', minWidth: 168,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={() => {
                setOpen(false);
                if (a.special === 'revenue') { onEditRevenue(partner); return; }
                if (a.special === 'link') { window.open(`https://${partner.subdomain}.ascentorbi.com`, '_blank'); return; }
                if (a.action) onAction(partner.id, a.action);
              }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px', border: 'none', background: 'transparent',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                color: a.color || 'var(--admin-text)',
                borderTop: i > 0 && (a.special === 'revenue') ? '1px solid var(--admin-border)' : 'none',
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

// ── Approve modal (sets revenue share on first approval) ──
function ApproveModal({
  partner,
  onConfirm,
  onCancel,
  loading,
}: {
  partner: Partner;
  onConfirm: (share: number) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [share, setShare] = useState(partner.revenue_share_percent || 70);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)',
        borderRadius: 14, padding: 28, width: '100%', maxWidth: 400,
      }}>
        <h3 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 22, color: 'var(--admin-text-heading)', marginBottom: 6,
        }}>
          Approve {partner.name}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--admin-text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
          Set the revenue share percentage for this partner. They receive this % of every member subscription payment.
        </p>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--admin-text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
            Revenue Share (%)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="range"
              min={30} max={90} step={5}
              value={share}
              onChange={e => setShare(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#E8A020' }}
            />
            <span style={{
              fontSize: 22, fontWeight: 700,
              color: '#E8A020',
              fontFamily: "'Cormorant Garamond', serif",
              minWidth: 48, textAlign: 'right',
            }}>
              {share}%
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--admin-text-faint)' }}>Partner: {share}%</span>
            <span style={{ fontSize: 11, color: 'var(--admin-text-faint)' }}>Ascentor: {100 - share}%</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => onConfirm(share)}
            disabled={loading}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 9, border: 'none',
              background: '#E8A020', color: '#000',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? 'Approving...' : 'Approve Partner'}
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: '11px 18px', borderRadius: 9,
              border: '1px solid var(--admin-border)',
              background: 'transparent', color: 'var(--admin-text-muted)',
              fontSize: 13, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Revenue share edit modal ──────────────────────────────
function RevenueModal({
  partner,
  onConfirm,
  onCancel,
  loading,
}: {
  partner: Partner;
  onConfirm: (share: number) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [share, setShare] = useState(partner.revenue_share_percent);
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)',
        borderRadius: 14, padding: 28, width: '100%', maxWidth: 380,
      }}>
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: 'var(--admin-text-heading)', marginBottom: 16 }}>
          Edit Revenue Share — {partner.name}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <input
            type="range" min={30} max={90} step={5}
            value={share}
            onChange={e => setShare(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#E8A020' }}
          />
          <span style={{ fontSize: 22, fontWeight: 700, color: '#E8A020', fontFamily: "'Cormorant Garamond', serif", minWidth: 48, textAlign: 'right' }}>
            {share}%
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => onConfirm(share)} disabled={loading}
            style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', background: '#E8A020', color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
            {loading ? 'Saving...' : 'Save'}
          </button>
          <button onClick={onCancel}
            style={{ padding: '10px 16px', borderRadius: 9, border: '1px solid var(--admin-border)', background: 'transparent', color: 'var(--admin-text-muted)', fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────
function AdminPartnersPageInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [partners,   setPartners]   = useState<Partner[]>([]);
  const [total,      setTotal]      = useState(0);
  const [pages,      setPages]      = useState(1);
  const [page,       setPage]       = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [breakdown,  setBreakdown]  = useState<Breakdown>({});

  const [tab,        setTab]        = useState<Tab>('all');
  const [search,     setSearch]     = useState('');
  const [debSearch,  setDebSearch]  = useState('');

  const [toast,      setToast]      = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [actionLoad, setActionLoad] = useState<string | null>(null);

  // Modals
  const [approveTarget, setApproveTarget] = useState<Partner | null>(null);
  const [revenueTarget, setRevenueTarget] = useState<Partner | null>(null);

  // ── Deep-link: ?action=approve&id=xxx opens approve modal ──
  // Triggered by the one-click link in the founder notification email
  useEffect(() => {
    const action = searchParams.get('action');
    const id     = searchParams.get('id');
    if (action === 'approve' && id) {
      // Switch to pending tab and let the list load, then auto-find partner
      setTab('pending');
    }
  }, [searchParams]);

  // After partners load, check if we need to auto-open an approve modal
  useEffect(() => {
    const action = searchParams.get('action');
    const id     = searchParams.get('id');
    if (action === 'approve' && id && partners.length > 0) {
      const target = partners.find(p => p.id === id);
      if (target && target.status === 'pending') {
        setApproveTarget(target);
        // Clean up URL so refresh doesn't re-trigger
        window.history.replaceState({}, '', '/admin/partners');
      }
    }
  }, [partners, searchParams]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchPartners = useCallback(async (p = 0) => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const params = new URLSearchParams({
      page: String(p),
      ...(tab !== 'all' ? { status: tab } : {}),
      ...(debSearch ? { search: debSearch } : {}),
    });

    const res = await fetch(`/api/admin/partners?${params}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (res.ok) {
      const data = await res.json();
      setPartners(data.partners || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      setPage(p);
      if (data.breakdown) setBreakdown(data.breakdown);
    }
    setLoading(false);
  }, [tab, debSearch]);

  useEffect(() => { fetchPartners(0); }, [tab, debSearch]);

  async function doAction(partnerId: string, action: string, extraData?: Record<string, any>) {
    setActionLoad(partnerId);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch('/api/admin/partners', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ partnerId, action, ...extraData }),
    });
    const data = await res.json();

    if (res.ok) {
      const msgs: Record<string, string> = {
        approve:              'Partner approved — email sent ✓',
        suspend:              'Partner suspended',
        reject:               'Application rejected',
        reinstate:            'Partner reinstated',
        update_revenue_share: 'Revenue share updated',
      };
      setToast({ type: 'success', text: msgs[action] || 'Done' });
      fetchPartners(page);
    } else {
      setToast({ type: 'error', text: data.error || 'Action failed' });
    }
    setActionLoad(null);
    setApproveTarget(null);
    setRevenueTarget(null);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'all',       label: 'All'       },
    { id: 'pending',   label: 'Pending'   },
    { id: 'active',    label: 'Active'    },
    { id: 'suspended', label: 'Suspended' },
    { id: 'rejected',  label: 'Rejected'  },
  ];

  return (
    <div style={{ maxWidth: 900 }}>
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .prow:hover { background: rgba(255,255,255,0.015) !important; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, color: 'var(--admin-text-heading)', marginBottom: 4 }}>
          Partners
        </h1>
        <p style={{ fontSize: 13, color: 'var(--admin-text-muted)' }}>
          Review applications, manage access, and set revenue splits
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'Total',     value: Object.values(breakdown).reduce((a, b) => a + b, 0), color: 'var(--admin-text-heading)' },
          { label: 'Pending',   value: breakdown.pending   || 0, color: '#E8A020' },
          { label: 'Active',    value: breakdown.active    || 0, color: '#10B981' },
          { label: 'Suspended', value: breakdown.suspended || 0, color: '#EF4444' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)', borderRadius: 10, padding: '14px 16px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--admin-text-faint)', marginBottom: 6 }}>{s.label}</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: s.color, fontFamily: "'Cormorant Garamond', serif" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)', borderRadius: 10, flexShrink: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                background: tab === t.id ? '#E8A020' : 'transparent',
                color: tab === t.id ? '#000' : 'var(--admin-text-muted)',
              }}>
              {t.label}
              {t.id !== 'all' && breakdown[t.id] > 0 && (
                <span style={{
                  marginLeft: 5, fontSize: 10, fontWeight: 700,
                  background: tab === t.id ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.07)',
                  color: tab === t.id ? '#000' : 'var(--admin-text-faint)',
                  padding: '1px 5px', borderRadius: 4,
                }}>
                  {breakdown[t.id]}
                </span>
              )}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or subdomain..."
          style={{ ...inputStyle, flex: 1 }}
        />
      </div>

      {/* Table */}
      <div style={{ background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 90px 100px 40px', padding: '10px 18px', borderBottom: '1px solid var(--admin-border)', background: 'rgba(255,255,255,0.02)' }}>
          {['Partner', 'Status', 'Members', 'Revenue', 'Share', ''].map((h, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--admin-text-faint)' }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--admin-text-muted)', fontSize: 13 }}>Loading...</div>
        ) : partners.length === 0 ? (
          <div style={{ padding: '52px 0', textAlign: 'center' }}>
            <p style={{ fontSize: 24, color: '#E8A020', opacity: 0.3, marginBottom: 10 }}>◈</p>
            <p style={{ fontSize: 13, color: 'var(--admin-text-muted)' }}>
              {tab === 'pending' ? 'No pending applications.' : 'No partners found.'}
            </p>
          </div>
        ) : (
          partners.map((p, i) => {
            const cfg       = STATUS_CONFIG[p.status];
            const totalMembers = (p.member_counts.active || 0) + (p.member_counts.invited || 0);
            const isLast    = i === partners.length - 1;
            const isLoading = actionLoad === p.id;

            return (
              <div key={p.id} className="prow" style={{
                display: 'grid', gridTemplateColumns: '1fr 90px 80px 90px 100px 40px',
                padding: '14px 18px', alignItems: 'center',
                borderBottom: isLast ? 'none' : '1px solid var(--admin-border)',
                opacity: isLoading ? 0.5 : 1, transition: 'opacity 0.15s',
              }}>

                {/* Partner identity */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-text-heading)' }}>{p.name}</p>
                    {p.status === 'pending' && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(232,160,32,0.12)', color: '#E8A020', border: '1px solid rgba(232,160,32,0.25)', textTransform: 'uppercase' }}>
                        NEW
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--admin-text-faint)', fontFamily: "'DM Mono', monospace" }}>
                    {p.subdomain}.ascentorbi.com
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--admin-text-muted)', marginTop: 2 }}>
                    {p.profiles?.full_name || '—'} · {p.profiles?.email}
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--admin-text-faint)', marginTop: 1 }}>
                    Applied {relDate(p.created_at)}
                  </p>
                </div>

                {/* Status */}
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30`, textTransform: 'capitalize', width: 'fit-content' }}>
                  {cfg.label}
                </span>

                {/* Members */}
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-text)' }}>{totalMembers}</p>
                  {(p.member_counts.invited || 0) > 0 && (
                    <p style={{ fontSize: 10, color: '#E8A020' }}>{p.member_counts.invited} pending</p>
                  )}
                </div>

                {/* Revenue */}
                <p style={{ fontSize: 12, fontWeight: 600, color: p.total_revenue_ngn > 0 ? '#10B981' : 'var(--admin-text-faint)' }}>
                  {p.total_revenue_ngn > 0 ? fmt(p.total_revenue_ngn) : '—'}
                </p>

                {/* Revenue share */}
                <p style={{ fontSize: 13, fontWeight: 700, color: '#E8A020', fontFamily: "'Cormorant Garamond', serif" }}>
                  {p.revenue_share_percent}%
                </p>

                {/* Actions */}
                <ActionMenu
                  partner={p}
                  onAction={(id, action) => {
                    if (action === 'approve') { setApproveTarget(p); return; }
                    doAction(id, action);
                  }}
                  onEditRevenue={setRevenueTarget}
                />
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', marginTop: 16 }}>
          <button onClick={() => fetchPartners(page - 1)} disabled={page <= 0}
            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--admin-border)', background: 'transparent', color: 'var(--admin-text)', cursor: 'pointer', fontSize: 12, opacity: page <= 0 ? 0.3 : 1 }}>
            ← Prev
          </button>
          <span style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>{page + 1} / {pages}</span>
          <button onClick={() => fetchPartners(page + 1)} disabled={page >= pages - 1}
            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--admin-border)', background: 'transparent', color: 'var(--admin-text)', cursor: 'pointer', fontSize: 12, opacity: page >= pages - 1 ? 0.3 : 1 }}>
            Next →
          </button>
        </div>
      )}

      {/* Approve modal */}
      {approveTarget && (
        <ApproveModal
          partner={approveTarget}
          loading={actionLoad === approveTarget.id}
          onConfirm={share => doAction(approveTarget.id, 'approve', { revenue_share: share })}
          onCancel={() => setApproveTarget(null)}
        />
      )}

      {/* Revenue share modal */}
      {revenueTarget && (
        <RevenueModal
          partner={revenueTarget}
          loading={actionLoad === revenueTarget.id}
          onConfirm={share => doAction(revenueTarget.id, 'update_revenue_share', { revenue_share: share })}
          onCancel={() => setRevenueTarget(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 999,
          background: toast.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
          border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          borderRadius: 12, padding: '12px 18px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          animation: 'fadeInUp 0.2s ease',
        }}>
          <span style={{ fontSize: 14 }}>{toast.type === 'success' ? '✓' : '✗'}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-text)' }}>{toast.text}</span>
        </div>
      )}
    </div>
  );
}

// Suspense boundary required for useSearchParams in Next.js App Router
export default function AdminPartnersPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, color: 'var(--admin-text-faint)', fontSize: 13 }}>Loading partners...</div>}>
      <AdminPartnersPageInner />
    </Suspense>
  );
}
