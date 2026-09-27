'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SummitDonation } from '@/database/database';

const B = {
  bg:       '#0F0F0E',
  card:     '#161614',
  border:   'rgba(255,255,255,0.08)',
  gold:     '#C8A96E',
  text:     '#FAFAF8',
  muted:    '#6B7280',
  dim:      '#4B5563',
  fontUI:   "'Metropolis', 'Plus Jakarta Sans', sans-serif",
  fontMono: "Metropolis, 'Inter', sans-serif",
};

const STATE_META: Record<string, { label: string; color: string; bg: string }> = {
  paid:      { label: 'Paid',      color: '#065F46', bg: '#D1FAE5' },
  pending:   { label: 'Pending',   color: '#1E40AF', bg: '#DBEAFE' },
  abandoned: { label: 'Abandoned', color: '#991B1B', bg: '#FEE2E2' },
  failed:    { label: 'Failed',    color: '#991B1B', bg: '#FEE2E2' },
};

const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`;

export default function SummitDonationsClient() {
  const supabase = createClient();
  const [donations, setDonations] = useState<SummitDonation[]>([]);
  const [stats, setStats] = useState({ total: 0, paid: 0, pending: 0, abandoned: 0, gross: 0, fees: 0, net: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setLoading(false); return; }
      const res = await fetch('/api/admin/summit-donations', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load donations');
        setLoading(false);
        return;
      }
      setDonations(data.donations || []);
      setStats(data.stats);
    } catch (err) {
      setError('Failed to load donations');
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return donations.filter((d) => {
      const matchStatus = filterStatus === 'all' || d.status === filterStatus;
      const q = search.toLowerCase();
      const matchSearch = !q ||
        d.full_name.toLowerCase().includes(q) ||
        d.email.toLowerCase().includes(q) ||
        (d.phone || '').toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [donations, filterStatus, search]);

  async function resend(id: string) {
    setBusyId(id);
    setActionMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/summit-donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ id, action: 'resend' }),
      });
      const data = await res.json().catch(() => ({}));
      setActionMsg(data.message || data.error || (res.ok ? 'Done.' : 'Action failed.'));
    } catch {
      setActionMsg('Action failed.');
    }
    setBusyId(null);
  }

  function exportCSV() {
    const cols = ['full_name', 'email', 'phone', 'status', 'amount', 'currency', 'paid_at', 'payment_reference', 'message', 'created_at'];
    const rows = filtered.map((d) => cols.map((c) => JSON.stringify((d as any)[c] ?? '')).join(','));
    const csv = [cols.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `summit-donations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div style={{ padding: '32px', fontFamily: B.fontUI }}>
      <div style={{ marginBottom: '28px' }}>
        <p style={{ fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: B.gold, margin: '0 0 6px' }}>
          Events · Ascentor / The Elevation Summit
        </p>
        <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 700, color: B.text }}>Donations</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '28px' }}>
        {[
          { label: 'Total attempts', value: stats.total },
          { label: 'Paid', value: stats.paid },
          { label: 'Pending', value: stats.pending },
          { label: 'Abandoned', value: stats.abandoned },
          { label: 'Gross', value: naira(stats.gross) },
          { label: 'Fees', value: naira(stats.fees) },
          { label: 'Net', value: naira(stats.net) },
        ].map((s) => (
          <div key={s.label} style={{ background: B.card, border: `1px solid ${B.border}`, borderRadius: '10px', padding: '16px 20px' }}>
            <p style={{ margin: '0 0 4px', fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: B.muted }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: B.text }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
        <input
          placeholder="Search name, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px 14px', background: B.card, border: `1px solid ${B.border}`, borderRadius: '8px', color: B.text, fontSize: '13px', fontFamily: B.fontUI, width: '260px', outline: 'none' }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: '8px 14px', background: B.card, border: `1px solid ${B.border}`, borderRadius: '8px', color: B.text, fontSize: '13px', fontFamily: B.fontUI, cursor: 'pointer', outline: 'none' }}
        >
          <option value="all">All statuses</option>
          {Object.keys(STATE_META).map((k) => <option key={k} value={k}>{STATE_META[k].label}</option>)}
        </select>
        <span style={{ fontFamily: B.fontMono, fontSize: '11px', color: B.muted }}>
          {filtered.length} of {donations.length}
        </span>
        <button
          onClick={exportCSV}
          style={{ marginLeft: 'auto', padding: '8px 16px', background: 'transparent', border: `1px solid ${B.border}`, borderRadius: '8px', color: B.gold, fontSize: '12px', fontFamily: B.fontUI, cursor: 'pointer', fontWeight: 600 }}
        >
          CSV
        </button>
      </div>

      {actionMsg && (
        <p style={{ margin: '0 0 14px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(200,169,110,0.12)', color: B.gold, fontFamily: B.fontMono, fontSize: '12px' }}>{actionMsg}</p>
      )}

      {error ? (
        <p style={{ color: '#EF4444', fontFamily: B.fontMono, fontSize: '13px' }}>{error}</p>
      ) : loading ? (
        <p style={{ color: B.muted, fontFamily: B.fontMono, fontSize: '12px' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: B.muted, fontFamily: B.fontUI, fontSize: '14px' }}>No donations match your filters.</p>
      ) : (
        <div style={{ background: B.card, border: `1px solid ${B.border}`, borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${B.border}` }}>
                {['Name', 'Email', 'Phone', 'Status', 'Amount', 'Message', 'Received', ''].map((h) => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: B.muted, fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const sc = STATE_META[d.status] || STATE_META.pending;
                return (
                  <tr key={d.id} style={{ borderBottom: `1px solid ${B.border}` }}>
                    <td style={{ padding: '12px 14px', color: B.text, fontSize: '13px', whiteSpace: 'nowrap' }}>{d.full_name}</td>
                    <td style={{ padding: '12px 14px', fontFamily: B.fontMono, fontSize: '11px', color: B.muted }}>{d.email}</td>
                    <td style={{ padding: '12px 14px', fontFamily: B.fontMono, fontSize: '11px', whiteSpace: 'nowrap' }}>{d.phone || '-'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: '6px', background: sc.bg, color: sc.color, fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>{sc.label}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: B.fontMono, fontSize: '11px', color: B.muted }}>{d.amount ? naira(Number(d.amount)) : '-'}</td>
                    <td style={{ padding: '12px 14px', fontSize: '12px', color: B.muted, maxWidth: '220px' }}>{d.message || '-'}</td>
                    <td style={{ padding: '12px 14px', fontFamily: B.fontMono, fontSize: '10px', color: B.dim, whiteSpace: 'nowrap' }}>
                      {new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {d.status === 'paid' && (
                        <button onClick={() => resend(d.id)} disabled={busyId === d.id}
                          style={{ padding: '4px 10px', borderRadius: '6px', border: `1px solid ${B.gold}`, background: 'transparent', color: B.gold, fontSize: '11px', cursor: 'pointer', fontFamily: B.fontUI }}>
                          {busyId === d.id ? 'Sending…' : 'Resend receipt'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
