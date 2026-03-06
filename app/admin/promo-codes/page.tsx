'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ============================================================
// ADMIN PROMO CODES — /admin/promo-codes
// Create, manage, enable/disable promotional codes
// Ascentor brand: Dark var(--admin-bg) · Gold #E8A020 · Syne · DM Mono · Cormorant Garamond
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
        setMessage('Promo code created.');
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

  // ─── Shared style tokens ──────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: 'var(--admin-bg-deep)',
    border: '1px solid var(--admin-bg-input)',
    borderRadius: '12px',
  };

  const inputBase: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid var(--admin-bg-input)',
    background: 'var(--admin-bg-card)',
    color: 'var(--admin-text)',
    fontSize: '13px',
    fontFamily: "'Syne', sans-serif",
    outline: 'none',
    width: '100%',
    transition: 'border-color 0.2s',
  };

  const monoLabel: React.CSSProperties = {
    fontFamily: "'DM Mono', monospace",
    fontSize: '10px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--admin-text-faint)',
  };

  const fieldLabel: React.CSSProperties = {
    display: 'block',
    fontFamily: "'DM Mono', monospace",
    fontSize: '10px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--admin-text-faint)',
    marginBottom: '6px',
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');

        .asc-input:focus       { border-color: #E8A020 !important; }
        .asc-input:hover       { border-color: var(--admin-text-faint) !important; }
        .asc-tr:hover td       { background: var(--admin-bg-deep) !important; }
        .asc-btn-ghost:hover   { border-color: #E8A020 !important; color: #E8A020 !important; }
        .asc-btn-danger:hover  { background: rgba(239,68,68,0.08) !important; }
        .asc-btn-gold:hover    { background: #C87820 !important; }
        .asc-btn-outline:hover { border-color: #E8A020 !important; color: #E8A020 !important; }
        .asc-checkbox          { accent-color: #E8A020; width: 14px; height: 14px; cursor: pointer; }
        @keyframes asc-spin    { to { transform: rotate(360deg); } }
      `}</style>

      {/* ─── Page Header ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '28px',
            fontWeight: 700,
            color: var(--admin-text-heading),
            margin: 0,
            lineHeight: 1.1,
            marginBottom: '6px',
          }}>
            Promo Codes
          </h1>
          <p style={{ ...monoLabel }}>Create and manage promotional discount codes</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="asc-btn-gold"
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: showCreate ? 'var(--admin-bg-input)' : '#E8A020',
            color: showCreate ? 'var(--admin-text-muted)' : 'var(--admin-bg)',
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            letterSpacing: '0.02em',
            transition: 'background 0.2s',
          }}
        >
          {showCreate ? 'Cancel' : 'New Code'}
        </button>
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

      {/* ─── Create Form ─────────────────────────────────────────────────── */}
      {showCreate && (
        <div style={{ ...card, padding: '24px', marginBottom: '20px' }}>
          <h3 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '20px',
            fontWeight: 700,
            color: var(--admin-text-heading),
            margin: '0 0 20px',
          }}>
            Create Promo Code
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ ...fieldLabel }}>Code</label>
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="e.g. LAUNCH50"
                className="asc-input"
                style={{
                  ...inputBase,
                  fontFamily: "'DM Mono', monospace",
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              />
            </div>
            <div>
              <label style={{ ...fieldLabel }}>Discount %</label>
              <input
                type="number"
                value={newDiscount}
                onChange={(e) => setNewDiscount(e.target.value)}
                placeholder="50"
                min="1"
                max="100"
                className="asc-input"
                style={{ ...inputBase }}
              />
            </div>
            <div>
              <label style={{ ...fieldLabel }}>Label (optional)</label>
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Launch Week Special"
                className="asc-input"
                style={{ ...inputBase }}
              />
            </div>
            <div>
              <label style={{ ...fieldLabel }}>Max Uses — blank for unlimited</label>
              <input
                type="number"
                value={newMaxUses}
                onChange={(e) => setNewMaxUses(e.target.value)}
                placeholder="100"
                className="asc-input"
                style={{ ...inputBase }}
              />
            </div>
            <div>
              <label style={{ ...fieldLabel }}>Expires (optional)</label>
              <input
                type="date"
                value={newExpiry}
                onChange={(e) => setNewExpiry(e.target.value)}
                className="asc-input"
                style={{ ...inputBase, colorScheme: 'dark' }}
              />
            </div>
            <div>
              <label style={{ ...fieldLabel }}>Applies to</label>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '8px' }}>
                {['basic', 'standard', 'premium'].map(p => (
                  <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newPlans.includes(p)}
                      onChange={(e) => setNewPlans(e.target.checked ? [...newPlans, p] : newPlans.filter(x => x !== p))}
                      className="asc-checkbox"
                    />
                    <span style={{ fontFamily: "'Syne', sans-serif", fontSize: '12px', color: 'var(--admin-text)', textTransform: 'capitalize' }}>{p}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={createCode}
            disabled={creating || !newCode}
            className="asc-btn-gold"
            style={{
              marginTop: '20px',
              padding: '11px 24px',
              borderRadius: '8px',
              border: 'none',
              background: '#E8A020',
              color: 'var(--admin-bg)',
              fontFamily: "'Syne', sans-serif",
              fontWeight: 700,
              fontSize: '13px',
              cursor: creating || !newCode ? 'not-allowed' : 'pointer',
              opacity: creating || !newCode ? 0.45 : 1,
              transition: 'background 0.2s, opacity 0.2s',
              letterSpacing: '0.02em',
            }}
          >
            {creating ? 'Creating...' : 'Create Code'}
          </button>
        </div>
      )}

      {/* ─── Codes Table ─────────────────────────────────────────────────── */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              border: '2px solid var(--admin-bg-input)', borderTopColor: '#E8A020',
              animation: 'asc-spin 0.9s linear infinite',
              margin: '0 auto 12px',
            }} />
            <p style={{ ...monoLabel }}>Loading codes...</p>
          </div>
        ) : codes.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: '14px', color: 'var(--admin-text-faint)', marginBottom: '4px' }}>No promo codes yet.</p>
            <p style={{ ...monoLabel }}>Create one above to get started.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--admin-bg-input)' }}>
                  {['Code', 'Discount', 'Label', 'Plans', 'Uses', 'Expires', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontFamily: "'DM Mono', monospace",
                      fontSize: '10px',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--admin-text-faint)',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {codes.map(c => (
                  <tr key={c.id} className="asc-tr" style={{ borderBottom: '1px solid var(--admin-bg-input)', opacity: c.active ? 1 : 0.45 }}>

                    {/* Code */}
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#E8A020',
                        letterSpacing: '0.12em',
                      }}>
                        {c.code}
                      </span>
                    </td>

                    {/* Discount */}
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '17px', fontWeight: 700, color: 'var(--admin-text)' }}>
                        {Math.round(c.discount * 100)}%
                      </span>
                    </td>

                    {/* Label */}
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ fontFamily: "'Syne', sans-serif", fontSize: '12px', color: 'var(--admin-text-muted)' }}>{c.label}</span>
                    </td>

                    {/* Plans */}
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ ...monoLabel, fontSize: '10px' }}>{c.applies_to?.join(', ')}</span>
                    </td>

                    {/* Uses */}
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '12px', color: 'var(--admin-text-muted)' }}>
                        {c.current_uses}{c.max_uses ? `/${c.max_uses}` : ''}
                      </span>
                    </td>

                    {/* Expires */}
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ ...monoLabel, fontSize: '10px' }}>
                        {c.expires_at ? new Date(c.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
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
                        background: c.active ? 'rgba(20,184,166,0.1)' : 'var(--admin-border)',
                        color: c.active ? '#14B8A6' : 'var(--admin-text-faint)',
                      }}>
                        {c.active ? 'Active' : 'Disabled'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => toggleCode(c.id, c.active)}
                          className="asc-btn-ghost"
                          style={{
                            padding: '5px 12px',
                            borderRadius: '7px',
                            border: '1px solid var(--admin-bg-input)',
                            background: 'transparent',
                            color: 'var(--admin-text-muted)',
                            fontFamily: "'Syne', sans-serif",
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'border-color 0.15s, color 0.15s',
                          }}
                        >
                          {c.active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => deleteCode(c.id)}
                          className="asc-btn-danger"
                          style={{
                            padding: '5px 12px',
                            borderRadius: '7px',
                            border: '1px solid rgba(239,68,68,0.25)',
                            background: 'transparent',
                            color: '#EF4444',
                            fontFamily: "'Syne', sans-serif",
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                          }}
                        >
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
