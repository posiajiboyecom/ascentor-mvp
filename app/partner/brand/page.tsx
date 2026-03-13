// app/partner/brand/page.tsx
'use client';

import { useState, useEffect } from 'react';

export const dynamic = 'force-dynamic';

export default function PartnerBrandPage() {
  const [form, setForm] = useState({
    name: '',
    logo_url: '',
    favicon_url: '',
    accent_color: '#14b8a6',
    accent_hover: '#0f9488',
    accent_text: '#000000',
    bg_color: '#0a0a0a',
    surface_color: '#111111',
    text_color: '#f5f5f5',
    text_muted: '#a3a3a3',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/partner/config')
      .then((r) => r.json())
      .then((data) => {
        setForm({
          name: data.name || '',
          logo_url: data.logo_url || '',
          favicon_url: data.favicon_url || '',
          accent_color: data.accent_color || '#14b8a6',
          accent_hover: data.accent_hover || '#0f9488',
          accent_text: data.accent_text || '#000000',
          bg_color: data.bg_color || '#0a0a0a',
          surface_color: data.surface_color || '#111111',
          text_color: data.text_color || '#f5f5f5',
          text_muted: data.text_muted || '#a3a3a3',
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/partner/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof typeof form, type = 'text') => (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {type === 'color' && (
          <input
            type="color"
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            style={{ width: '36px', height: '36px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'none' }}
          />
        )}
        <input
          type="text"
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 14px', color: '#f8fafc', fontSize: '13px', outline: 'none' }}
        />
      </div>
    </div>
  );

  if (loading) return <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: '560px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 500, color: '#f8fafc', marginBottom: '6px' }}>Branding</h1>
      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '28px' }}>
        Customise how your platform looks to your users.
      </p>

      {field('Platform name', 'name')}
      {field('Logo URL', 'logo_url')}
      {field('Favicon URL', 'favicon_url')}

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '24px 0' }} />
      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Colour palette</p>

      {field('Accent colour', 'accent_color', 'color')}
      {field('Accent hover', 'accent_hover', 'color')}
      {field('Accent text (on accent bg)', 'accent_text', 'color')}
      {field('Background', 'bg_color', 'color')}
      {field('Surface / card', 'surface_color', 'color')}
      {field('Text primary', 'text_color', 'color')}
      {field('Text muted', 'text_muted', 'color')}

      {/* Live preview */}
      <div style={{ marginTop: '24px', marginBottom: '28px' }}>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preview</p>
        <div style={{ background: form.bg_color, borderRadius: '10px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ background: form.surface_color, borderRadius: '8px', padding: '16px' }}>
            <p style={{ color: form.text_color, fontSize: '15px', fontWeight: 500, marginBottom: '4px' }}>{form.name || 'Your Platform'}</p>
            <p style={{ color: form.text_muted, fontSize: '12px', marginBottom: '12px' }}>Sample subtitle text</p>
            <button style={{ background: form.accent_color, color: form.accent_text, border: 'none', borderRadius: '6px', padding: '8px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              Get Started
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '10px 24px', background: '#14b8a6', color: '#000', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving...' : 'Save branding'}
        </button>
        {saved && <span style={{ fontSize: '13px', color: '#4ade80' }}>✓ Saved</span>}
      </div>
    </div>
  );
}
