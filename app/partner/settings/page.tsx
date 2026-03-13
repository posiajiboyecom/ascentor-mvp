// app/partner/settings/page.tsx
//
// FIX WL-06 / WL-10: Settings page now calls /api/partner/brand for GET
//   (to read the partner record including subdomain). Subdomain saves go
//   to /api/partner/settings (a dedicated route that handles subdomain
//   changes and calls clearPartnerCache). Custom domain field added.
'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';

export default function PartnerSettingsPage() {
  const [partnerId, setPartnerId]           = useState('');
  const [subdomain, setSubdomain]           = useState('');
  const [originalSubdomain, setOriginal]    = useState('');
  const [customDomain, setCustomDomain]     = useState('');
  const [saving, setSaving]                 = useState(false);
  const [saved, setSaved]                   = useState(false);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');

  useEffect(() => {
    fetch('/api/partner/brand')
      .then((r) => r.json())
      .then((data) => {
        setPartnerId(data.id || '');
        setSubdomain(data.subdomain || '');
        setOriginal(data.subdomain || '');
        setCustomDomain(data.custom_domain || '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/partner/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId,
          subdomain: subdomain.toLowerCase().trim(),
          custom_domain: customDomain.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save.');
        return;
      }
      setOriginal(subdomain);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const subdomainChanged = subdomain !== originalSubdomain;

  const inputStyle: React.CSSProperties = {
    flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '10px 14px', color: 'var(--text)',
    fontSize: '13px', outline: 'none',
  };

  if (loading) return <div style={{ color: 'var(--text-dim)', fontSize: '13px' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: '520px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text)', marginBottom: '6px' }}>Settings</h1>
      <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '28px' }}>
        Platform configuration and domain settings.
      </p>

      {/* Subdomain */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Subdomain
        </label>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <input
            value={subdomain}
            onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            style={{ ...inputStyle, borderRadius: '8px 0 0 8px' }}
            placeholder="yourcompany"
          />
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: 'none',
            borderRadius: '0 8px 8px 0', padding: '10px 14px', color: 'var(--text-dim)', fontSize: '13px',
          }}>
            .ascentorbi.com
          </div>
        </div>
        {subdomainChanged && (
          <p style={{ fontSize: '11px', color: '#F59E0B', marginTop: '8px' }}>
            ⚠ Changing your subdomain will break any existing links shared with your users.
          </p>
        )}
      </div>

      {/* Custom domain */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Custom domain <span style={{ opacity: 0.5 }}>(optional)</span>
        </label>
        <input
          value={customDomain}
          onChange={(e) => setCustomDomain(e.target.value.toLowerCase().trim())}
          style={{ ...inputStyle, width: '100%', borderRadius: '8px', boxSizing: 'border-box' }}
          placeholder="coaching.yourdomain.com"
        />
        <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '8px' }}>
          Point a CNAME record at <strong>ascentorbi.com</strong> then enter your domain here.
        </p>
      </div>

      {error && (
        <p style={{ color: '#EF4444', fontSize: '13px', marginBottom: '12px' }}>{error}</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: '11px 28px', background: 'var(--accent)', color: '#000',
          borderRadius: '8px', border: 'none', fontSize: '13px',
          fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save settings'}
      </button>
    </div>
  );
}
