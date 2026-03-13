// app/partner/brand/page.tsx
//
// FIX WL-06: Migrated from /api/partner/config (reads tenants table) to
//            /api/partner/brand (reads/writes partners.brand JSONB).
//            Field names updated to match the partners schema:
//              accent_color   → primary_color
//              surface_color  → card_color
//              text_muted     → (removed — derived from text_color in getPartnerContext)
//            Added platform_name, font_heading, font_body fields.
'use client';

import { useState, useEffect } from 'react';

export const dynamic = 'force-dynamic';

const FONT_OPTIONS = [
  'Cormorant Garamond',
  'Playfair Display',
  'Merriweather',
  'Syne',
  'Inter',
  'DM Sans',
];

export default function PartnerBrandPage() {
  const [partnerId, setPartnerId] = useState('');
  const [form, setForm] = useState({
    platform_name: '',
    logo_url: '',
    favicon_url: '',
    primary_color: '#E8A020',
    accent_color: '#C8851A',
    text_color: '#D4CFC3',
    bg_color: '#0C0B08',
    card_color: '#141310',
    border_color: '#2A2720',
    font_heading: 'Cormorant Garamond',
    font_body: 'Syne',
    hide_ascentor_branding: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/partner/brand')
      .then((r) => r.json())
      .then((data) => {
        setPartnerId(data.id || '');
        const brand = data.brand || {};
        setForm({
          platform_name:          brand.platform_name          || '',
          logo_url:               brand.logo_url               || '',
          favicon_url:            brand.favicon_url            || '',
          primary_color:          brand.primary_color          || '#E8A020',
          accent_color:           brand.accent_color           || '#C8851A',
          text_color:             brand.text_color             || '#D4CFC3',
          bg_color:               brand.bg_color               || '#0C0B08',
          card_color:             brand.card_color             || '#141310',
          border_color:           brand.border_color           || '#2A2720',
          font_heading:           brand.font_heading           || 'Cormorant Garamond',
          font_body:              brand.font_body              || 'Syne',
          hide_ascentor_branding: brand.hide_ascentor_branding || false,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/partner/brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId, brand: form }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save.');
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '10px 14px', color: 'var(--text)',
    fontSize: '13px', outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', color: 'var(--text-dim)',
    marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em',
  };

  const field = (label: string, key: keyof typeof form, type = 'text') => (
    <div style={{ marginBottom: '16px' }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {type === 'color' && (
          <input
            type="color"
            value={form[key] as string}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            style={{ width: '36px', height: '36px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
          />
        )}
        <input
          type="text"
          value={form[key] as string}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          style={inputStyle}
        />
      </div>
    </div>
  );

  if (loading) return <div style={{ color: 'var(--text-dim)', fontSize: '13px' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: '560px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text)', marginBottom: '6px' }}>Brand</h1>
      <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '28px' }}>
        Customise your platform's name, logo, and colours.
      </p>

      {/* Identity */}
      <section style={{ marginBottom: '28px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: '16px' }}>Identity</p>
        {field('Platform name', 'platform_name')}
        {field('Logo URL', 'logo_url')}
        {field('Favicon URL', 'favicon_url')}
      </section>

      {/* Colours */}
      <section style={{ marginBottom: '28px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: '16px' }}>Colours</p>
        {field('Primary / accent colour', 'primary_color', 'color')}
        {field('Accent hover colour', 'accent_color', 'color')}
        {field('Text colour', 'text_color', 'color')}
        {field('Background colour', 'bg_color', 'color')}
        {field('Card / surface colour', 'card_color', 'color')}
        {field('Border colour', 'border_color', 'color')}
      </section>

      {/* Typography */}
      <section style={{ marginBottom: '28px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: '16px' }}>Typography</p>
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Heading font</label>
          <select
            value={form.font_heading}
            onChange={(e) => setForm({ ...form, font_heading: e.target.value })}
            style={{ ...inputStyle, width: '100%' }}
          >
            {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Body font</label>
          <select
            value={form.font_body}
            onChange={(e) => setForm({ ...form, font_body: e.target.value })}
            style={{ ...inputStyle, width: '100%' }}
          >
            {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </section>

      {/* Branding */}
      <section style={{ marginBottom: '28px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: '16px' }}>White-label</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.hide_ascentor_branding}
            onChange={(e) => setForm({ ...form, hide_ascentor_branding: e.target.checked })}
          />
          <span style={{ fontSize: '13px', color: 'var(--text)' }}>
            Hide "Powered by Ascentor" branding
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block' }}>Requires Partner Pro plan</span>
          </span>
        </label>
      </section>

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
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save brand'}
      </button>
    </div>
  );
}
