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

import { useState, useEffect, useRef, useCallback } from 'react';

export const dynamic = 'force-dynamic';

const FONT_OPTIONS = [
  'Cormorant Garamond',
  'Playfair Display',
  'Merriweather',
  'Syne',
  'Inter',
  'DM Sans',
];

// ── ImageUpload component ─────────────────────────────────────────────────────
// Replaces raw URL text inputs for logo and favicon.
// Shows a preview of the current image, a drag-and-drop/click upload zone,
// and a fallback URL input for partners who already have a hosted image.

function ImageUpload({
  label,
  assetType,
  currentUrl,
  onUploaded,
  hint,
}: {
  label:      string;
  assetType:  'logo' | 'logo_dark' | 'favicon';
  currentUrl: string;
  onUploaded: (url: string) => void;
  hint?:      string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState(currentUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep URL input in sync when parent updates (e.g. on load)
  useEffect(() => { setUrlValue(currentUrl); }, [currentUrl]);

  const upload = useCallback(async (file: File) => {
    setUploading(true);
    setUploadError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', assetType);
      const res  = await fetch('/api/partner/storage/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error || 'Upload failed.'); return; }
      onUploaded(data.url);
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [assetType, onUploaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }, [upload]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
  };

  const isSquare = assetType === 'favicon';

  return (
    <div style={{ marginBottom: '18px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', marginBottom: '8px' }}>
        {label}
      </p>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        {/* Preview */}
        <div style={{
          width: isSquare ? 48 : 80, height: 48, borderRadius: isSquare ? 8 : 6,
          border: '1px solid var(--border)', background: 'var(--bg-card)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', flexShrink: 0,
        }}>
          {currentUrl ? (
            <img src={currentUrl} alt={label} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          )}
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            flex: 1, border: `1px dashed ${uploading ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 8, padding: '10px 14px',
            background: uploading ? 'rgba(232,160,32,0.04)' : 'var(--bg-card)',
            cursor: uploading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, transition: 'border-color 0.15s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
          </svg>
          <span style={{ fontSize: '12px', color: uploading ? 'var(--accent)' : 'var(--text-dim)' }}>
            {uploading ? 'Uploading…' : 'Click or drag to upload'}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginLeft: 'auto', opacity: 0.6 }}>
            PNG, SVG, JPG · max 2 MB
          </span>
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />

      {uploadError && (
        <p style={{ fontSize: '11px', color: '#EF4444', marginTop: '5px' }}>{uploadError}</p>
      )}

      {/* Optional URL fallback */}
      <div style={{ marginTop: '6px' }}>
        <button
          onClick={() => setShowUrlInput(v => !v)}
          style={{ fontSize: '11px', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
        >
          {showUrlInput ? 'Hide URL input' : 'Or paste an image URL'}
        </button>
        {showUrlInput && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
            <input
              value={urlValue}
              onChange={e => setUrlValue(e.target.value)}
              placeholder="https://..."
              style={{
                flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 7, padding: '7px 12px', color: 'var(--text)', fontSize: '12px', outline: 'none',
              }}
            />
            <button
              onClick={() => onUploaded(urlValue)}
              style={{
                padding: '7px 14px', background: 'var(--accent)', color: '#0C0B08',
                borderRadius: 7, border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Use URL
            </button>
          </div>
        )}
      </div>

      {hint && <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '5px', opacity: 0.7 }}>{hint}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function PartnerBrandPage() {
  const [partnerId, setPartnerId] = useState('');
  const [planTier, setPlanTier] = useState<'standard' | 'pro' | null>(null);
  const [form, setForm] = useState({
    platform_name: '',
    logo_url: '',
    logo_dark_url: '',
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

  const isProPlan = planTier === 'pro';

  useEffect(() => {
    fetch('/api/partner/brand')
      .then((r) => r.json())
      .then((data) => {
        setPartnerId(data.id || '');
        // plan_tier is returned by /api/partner/brand GET (see brand/route.ts)
        setPlanTier(data.plan_tier || null);
        const brand = data.brand || {};
        setForm({
          platform_name:          brand.platform_name          || '',
          logo_url:               brand.logo_url               || '',
          logo_dark_url:          brand.logo_dark_url          || '',
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
        <ImageUpload
          label="Logo (light background)"
          assetType="logo"
          currentUrl={form.logo_url}
          onUploaded={url => setForm(f => ({ ...f, logo_url: url }))}
          hint="Shown in the top nav. Recommended: SVG or PNG with transparent background, max 400×120px."
        />
        <ImageUpload
          label="Logo (dark background)"
          assetType="logo_dark"
          currentUrl={form.logo_dark_url}
          onUploaded={url => setForm(f => ({ ...f, logo_dark_url: url }))}
          hint="Optional. Used when your platform background is dark."
        />
        <ImageUpload
          label="Favicon"
          assetType="favicon"
          currentUrl={form.favicon_url}
          onUploaded={url => setForm(f => ({ ...f, favicon_url: url }))}
          hint="Browser tab icon. Use a square PNG or SVG, ideally 32×32px or 64×64px."
        />
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

        {isProPlan ? (
          /* Pro plan — toggle is functional */
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.hide_ascentor_branding}
              onChange={(e) => setForm({ ...form, hide_ascentor_branding: e.target.checked })}
            />
            <span style={{ fontSize: '13px', color: 'var(--text)' }}>
              Hide &ldquo;Powered by Ascentor&rdquo; branding
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block' }}>Remove the Ascentor attribution from your platform footer</span>
            </span>
          </label>
        ) : (
          /* Standard plan — locked with upgrade prompt */
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', opacity: 0.6, cursor: 'not-allowed' }}>
            <input type="checkbox" disabled checked={false} style={{ marginTop: '2px' }} />
            <span style={{ fontSize: '13px', color: 'var(--text)' }}>
              Hide &ldquo;Powered by Ascentor&rdquo; branding
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginTop: '2px' }}>
                Available on{' '}
                <span style={{
                  display: 'inline-block', padding: '1px 7px', borderRadius: '20px', fontSize: '10px',
                  fontWeight: 700, letterSpacing: '0.04em',
                  background: 'rgba(232,160,32,0.15)', color: '#E8A020', border: '1px solid rgba(232,160,32,0.3)',
                }}>
                  Partner Pro
                </span>
                {' '}— contact support to upgrade
              </span>
            </span>
          </div>
        )}
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
