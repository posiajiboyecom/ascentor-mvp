// app/partner/settings/page.tsx
'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';

export default function PartnerSettingsPage() {
  const [subdomain, setSubdomain] = useState('');
  const [originalSubdomain, setOriginalSubdomain] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [danger, setDanger] = useState(false);

  useEffect(() => {
    fetch('/api/partner/config')
      .then((r) => r.json())
      .then((data) => {
        setSubdomain(data.subdomain || '');
        setOriginalSubdomain(data.subdomain || '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/partner/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain: subdomain.toLowerCase().trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to save.');
        return;
      }
      setOriginalSubdomain(subdomain);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      alert('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const subdomainChanged = subdomain !== originalSubdomain;

  if (loading) return <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: '520px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 500, color: '#f8fafc', marginBottom: '6px' }}>Settings</h1>
      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '28px' }}>Platform configuration and advanced options.</p>

      {/* Subdomain */}
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '20px', marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Subdomain
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
          <input
            value={subdomain}
            onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRight: 'none', borderRadius: '8px 0 0 8px', padding: '10px 14px', color: '#f8fafc', fontSize: '13px', outline: 'none' }}
            placeholder="yourcompany"
          />
          <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderLeft: 'none', borderRadius: '0 8px 8px 0', padding: '10px 14px', color: 'rgba(255,255,255,0.4)', fontSize: '13px', whiteSpace: 'nowrap' }}>
            .ascentor.co
          </div>
        </div>
        {subdomainChanged && (
          <p style={{ fontSize: '11px', color: '#fbbf24', marginTop: '6px' }}>
            ⚠ Changing your subdomain will break any existing links shared with your users.
          </p>
        )}
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '6px' }}>
          Only lowercase letters, numbers, and hyphens. Cannot start or end with a hyphen.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
        <button
          onClick={handleSave}
          disabled={saving || !subdomainChanged}
          style={{ padding: '10px 24px', background: '#14b8a6', color: '#000', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: (saving || !subdomainChanged) ? 'not-allowed' : 'pointer', opacity: (saving || !subdomainChanged) ? 0.5 : 1 }}
        >
          {saving ? 'Saving...' : 'Save settings'}
        </button>
        {saved && <span style={{ fontSize: '13px', color: '#4ade80' }}>✓ Saved</span>}
      </div>

      {/* Danger zone */}
      <div style={{ border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '20px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 500, color: '#f87171', marginBottom: '4px' }}>Danger zone</h2>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>
          These actions are irreversible. Please be certain before proceeding.
        </p>

        {!danger ? (
          <button
            onClick={() => setDanger(true)}
            style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '7px', color: '#f87171', fontSize: '12px', cursor: 'pointer' }}
          >
            Deactivate platform
          </button>
        ) : (
          <div style={{ background: 'rgba(239,68,68,0.06)', borderRadius: '8px', padding: '14px' }}>
            <p style={{ fontSize: '13px', color: '#f87171', marginBottom: '12px' }}>
              Are you sure? This will immediately disable access for all your users.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={async () => {
                  await fetch('/api/partner/config', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_active: false }),
                  });
                  alert('Platform deactivated. Contact support to reactivate.');
                }}
                style={{ padding: '8px 16px', background: '#ef4444', border: 'none', borderRadius: '7px', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                Yes, deactivate
              </button>
              <button
                onClick={() => setDanger(false)}
                style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: 'rgba(255,255,255,0.6)', fontSize: '12px', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
