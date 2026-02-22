'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ============================================================
// ADMIN PROMO CODES — /admin/promo-codes
// Create, manage, enable/disable promotional codes
// ============================================================

interface PromoCode {
  id: string;
  code: string;
  discount: number;
  label: string;
  applies_to: string[];
  max_uses: number | null;
  current_uses: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

export default function AdminPromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [message, setMessage] = useState('');

  // Create form
  const [newCode, setNewCode] = useState('');
  const [newDiscount, setNewDiscount] = useState('50');
  const [newLabel, setNewLabel] = useState('');
  const [newMaxUses, setNewMaxUses] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [newPlans, setNewPlans] = useState(['basic', 'standard', 'premium']);
  const [creating, setCreating] = useState(false);

  const supabase = createClient();

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/admin/promo-codes', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setCodes(data.codes || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [supabase]);

  useEffect(() => { fetchCodes(); }, [fetchCodes]);

  const createCode = async () => {
    setCreating(true);
    setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
        body: JSON.stringify({
          code: newCode,
          discount: parseFloat(newDiscount) / 100,
          label: newLabel || `${newDiscount}% Off`,
          applies_to: newPlans,
          max_uses: newMaxUses ? parseInt(newMaxUses) : null,
          expires_at: newExpiry || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage('Promo code created!');
        setShowCreate(false);
        setNewCode(''); setNewDiscount('50'); setNewLabel(''); setNewMaxUses(''); setNewExpiry('');
        fetchCodes();
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch { setMessage('Failed to create code'); }
    finally { setCreating(false); }
  };

  const toggleCode = async (id: string, active: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    await fetch('/api/admin/promo-codes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
      body: JSON.stringify({ id, active: !active }),
    });
    fetchCodes();
  };

  const deleteCode = async (id: string) => {
    if (!confirm('Delete this promo code?')) return;
    const { data: { session } } = await supabase.auth.getSession();
    await fetch('/api/admin/promo-codes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
      body: JSON.stringify({ id }),
    });
    fetchCodes();
  };

  const card: React.CSSProperties = { background: 'var(--bg-card, #12151F)', border: '1px solid var(--border, #2A2D3A)', borderRadius: '12px', padding: '20px' };
  const input: React.CSSProperties = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border, #2A2D3A)', background: 'var(--bg-input, #1A1D2E)', color: 'var(--text)', fontSize: '14px', outline: 'none', width: '100%' };
  const btn: React.CSSProperties = { padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer' };

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Promo Codes</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '4px 0 0' }}>Create and manage promotional discount codes</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          style={{ ...btn, background: 'var(--accent, #F59E0B)', color: '#000' }}>
          {showCreate ? 'Cancel' : '+ New Code'}
        </button>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', background: message.startsWith('Error') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: message.startsWith('Error') ? '#EF4444' : '#10B981', fontSize: '14px', marginBottom: '16px' }}>
          {message}
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div style={{ ...card, marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', marginBottom: '16px' }}>Create Promo Code</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px', textTransform: 'uppercase' }}>Code</label>
              <input value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} placeholder="e.g. LAUNCH50" style={input} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px', textTransform: 'uppercase' }}>Discount %</label>
              <input type="number" value={newDiscount} onChange={(e) => setNewDiscount(e.target.value)} placeholder="50" min="1" max="100" style={input} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px', textTransform: 'uppercase' }}>Label (optional)</label>
              <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Launch Week Special" style={input} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px', textTransform: 'uppercase' }}>Max Uses (blank = unlimited)</label>
              <input type="number" value={newMaxUses} onChange={(e) => setNewMaxUses(e.target.value)} placeholder="100" style={input} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px', textTransform: 'uppercase' }}>Expires (optional)</label>
              <input type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} style={input} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px', textTransform: 'uppercase' }}>Applies to</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                {['basic', 'standard', 'premium'].map(p => (
                  <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={newPlans.includes(p)} onChange={(e) => {
                      setNewPlans(e.target.checked ? [...newPlans, p] : newPlans.filter(x => x !== p));
                    }} />
                    {p}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <button onClick={createCode} disabled={creating || !newCode}
            style={{ ...btn, background: 'var(--accent)', color: '#000', marginTop: '16px', opacity: creating || !newCode ? 0.5 : 1 }}>
            {creating ? 'Creating...' : 'Create Code'}
          </button>
        </div>
      )}

      {/* Codes Table */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : codes.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No promo codes yet. Create one above.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Code', 'Discount', 'Label', 'Plans', 'Uses', 'Expires', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: 'var(--text-dim)', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {codes.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', opacity: c.active ? 1 : 0.5 }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent)', letterSpacing: '1px' }}>{c.code}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text)' }}>{Math.round(c.discount * 100)}%</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>{c.label}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-dim)', fontSize: '11px' }}>{c.applies_to?.join(', ')}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>{c.current_uses}{c.max_uses ? `/${c.max_uses}` : ''}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-dim)' }}>
                      {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                        background: c.active ? 'rgba(16,185,129,0.1)' : 'rgba(107,106,101,0.1)',
                        color: c.active ? '#10B981' : '#6B6A65',
                      }}>{c.active ? 'Active' : 'Disabled'}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => toggleCode(c.id, c.active)}
                          style={{ ...btn, padding: '4px 10px', fontSize: '11px', background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                          {c.active ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => deleteCode(c.id)}
                          style={{ ...btn, padding: '4px 10px', fontSize: '11px', background: 'transparent', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
