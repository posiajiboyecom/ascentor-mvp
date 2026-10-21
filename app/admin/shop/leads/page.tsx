'use client';

import { useEffect, useState } from 'react';

// /admin/shop/leads: name + email captured on free items, with CSV export.

const brand = {
  font: "'Metropolis', system-ui, sans-serif",
  gold: '#E8A020', goldMuted: 'rgba(232,160,32,0.08)', goldBorder: 'rgba(232,160,32,0.22)', red: '#EF4444',
  card: 'var(--admin-bg-deep)', border: 'var(--admin-border)',
  text: 'var(--admin-text)', heading: 'var(--admin-text-heading)', muted: 'var(--admin-text-muted)', faint: 'var(--admin-text-faint)',
};

type Lead = { id: string; email: string; full_name: string | null; item: string; created_at: string };

export default function AdminShopLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/shop/leads');
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Failed to load leads');
        setLeads(j.leads || []);
        setNotice(j.migrationNeeded ? j.notice : '');
      } catch (e: any) { setError(e.message); }
      setLoading(false);
    })();
  }, []);

  const needle = q.trim().toLowerCase();
  const shown = needle ? leads.filter(l => `${l.full_name || ''} ${l.email} ${l.item}`.toLowerCase().includes(needle)) : leads;

  return (
    <>
      <style>{`
        .sl-table th { text-align: left; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--admin-text-muted); font-weight: 500; padding: 10px 14px; border-bottom: 1px solid var(--admin-border); white-space: nowrap; }
        .sl-table td { padding: 12px 14px; border-bottom: 1px solid var(--admin-border); font-size: 13px; color: var(--admin-text); }
        .sl-table tr:last-child td { border-bottom: none; }
      `}</style>
      <div style={{ fontFamily: brand.font }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontWeight: 700, fontSize: 'clamp(24px, 3vw, 32px)', color: brand.heading, margin: 0 }}>Shop leads</h1>
              <p style={{ fontSize: 11, color: brand.muted, marginTop: 6, letterSpacing: '0.04em' }}>{leads.length} SIGN-UPS FROM FREE ITEMS</p>
            </div>
            <a href="/api/admin/shop/leads?format=csv" style={{ fontFamily: brand.font, fontSize: 12, fontWeight: 700, padding: '9px 20px', borderRadius: 9, textDecoration: 'none', background: brand.gold, color: 'var(--admin-bg)' }}>
              Export CSV
            </a>
          </div>
          <div style={{ height: 1, background: `linear-gradient(90deg, ${brand.gold} 0%, transparent 60%)`, marginTop: 18 }} />
        </div>

        {notice && <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 16, background: brand.goldMuted, border: `1px solid ${brand.goldBorder}`, color: brand.text, fontSize: 13 }}>{notice}</div>}
        {error && <p style={{ color: brand.red, fontSize: 12, marginBottom: 12 }}>{error}</p>}

        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email or item" style={{ fontFamily: brand.font, fontSize: 13, padding: '10px 14px', borderRadius: 9, width: '100%', maxWidth: 360, marginBottom: 16, background: 'var(--admin-bg-card)', color: 'var(--admin-text)', border: `1px solid ${brand.border}`, outline: 'none' }} />

        {loading ? (
          <p style={{ textAlign: 'center', padding: '60px 0', fontSize: 11, color: brand.faint }}>Loading leads…</p>
        ) : shown.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '60px 0', fontSize: 13, color: brand.faint }}>No leads yet.</p>
        ) : (
          <div style={{ borderRadius: 12, background: brand.card, border: `1px solid ${brand.border}`, overflowX: 'auto' }}>
            <table className="sl-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead><tr><th>Name</th><th>Email</th><th>Item</th><th>Date</th></tr></thead>
              <tbody>
                {shown.map(l => (
                  <tr key={l.id}>
                    <td>{l.full_name || '-'}</td>
                    <td>{l.email}</td>
                    <td>{l.item || '-'}</td>
                    <td style={{ color: brand.muted }}>{new Date(l.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
