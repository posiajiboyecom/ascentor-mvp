// ============================================================
// PARTNER BRAND ADMIN — app/partner/brand/page.tsx
// (Rendered at: john.ascentorbi.com/partner/brand)
//
// The coach's admin panel for:
//  - Logo upload (to Supabase storage)
//  - Colour picker for all brand vars
//  - Font selection
//  - Live preview
//  - Save → invalidates CDN cache
// ============================================================

'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PartnerBrand, FontOption } from '@/types/partner';

const FONT_OPTIONS: FontOption[] = [
  'Cormorant Garamond', 'Playfair Display', 'Merriweather',
  'Syne', 'Inter', 'DM Sans',
];

const COLOR_FIELDS: { key: keyof PartnerBrand; label: string; hint: string }[] = [
  { key: 'primary_color', label: 'Primary / Accent',  hint: 'Buttons, links, highlights'   },
  { key: 'accent_color',  label: 'Accent Dark',        hint: 'Hover states, secondary CTAs' },
  { key: 'bg_color',      label: 'Background',         hint: 'Page background'              },
  { key: 'card_color',    label: 'Card Background',    hint: 'Cards, panels, inputs'        },
  { key: 'text_color',    label: 'Text',               hint: 'Primary text colour'          },
];

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  outline: 'none',
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: 13,
  width: '100%',
};

export default function BrandAdminPage() {
  const supabase = createClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [isPro, setIsPro]         = useState(false);
  const [brand, setBrand] = useState<PartnerBrand>({
    logo_url: null,
    logo_dark_url: null,
    favicon_url: null,
    primary_color: '#E8A020',
    accent_color: '#C8851A',
    text_color: '#D4CFC3',
    bg_color: '#0C0B08',
    card_color: '#141310',
    font_heading: 'Cormorant Garamond',
    font_body: 'Syne',
    hide_ascentor_branding: false,
    platform_name: '',
    tagline: null,
  });

  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [error, setError]               = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [previewTab, setPreviewTab]     = useState<'desktop' | 'mobile'>('desktop');

  // Load existing brand
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: partner } = await supabase
        .from('partners')
        .select('id, brand')
        .eq('owner_id', user.id)
        .single();

      if (partner) {
        setPartnerId(partner.id);
        setIsPro((partner as any).plan_tier === 'pro');
        setBrand(partner.brand || brand);
      }
    };
    load();
  }, []);

  const updateBrand = (key: keyof PartnerBrand, value: any) => {
    setBrand(prev => ({ ...prev, [key]: value }));
  };

  // ── Logo upload ──────────────────────────────────────────
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
    const file = e.target.files?.[0];
    if (!file || !partnerId) return;
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return; }
    if (file.size > 2 * 1024 * 1024) { setError('Image must be under 2MB.'); return; }

    const setter = type === 'logo' ? setLogoUploading : setFaviconUploading;
    setter(true);
    setError('');

    const ext  = file.name.split('.').pop();
    const path = `partners/${partnerId}/${type}.${ext}`;

    // Ensure bucket exists — create it if not (service role required)
    const ensureRes = await fetch('/api/partner/storage/ensure-bucket', { method: 'POST' });
    if (!ensureRes.ok) {
      const j = await ensureRes.json().catch(() => ({}));
      setError('Storage setup failed: ' + (j.error || 'unknown'));
      setter(false);
      return;
    }

    const { error: uploadError } = await supabase.storage
      .from('partner-assets')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setError('Upload failed: ' + uploadError.message);
      setter(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('partner-assets')
      .getPublicUrl(path);

    const urlWithCache = `${publicUrl}?t=${Date.now()}`;
    const key = type === 'logo' ? 'logo_url' : 'favicon_url';
    updateBrand(key, urlWithCache);
    setter(false);
    e.target.value = '';
  };

  // ── Save brand ───────────────────────────────────────────
  const handleSave = async () => {
    if (!partnerId) return;
    if (!brand.platform_name.trim()) { setError('Platform name is required'); return; }

    setSaving(true); setError(''); setSaved(false);

    const res = await fetch('/api/partner/brand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partnerId, brand }),
    });

    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Save failed'); }
    else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    setSaving(false);
  };

  const previewVars = `
    --accent: ${brand.primary_color};
    --bg: ${brand.bg_color};
    --bg-card: ${brand.card_color};
    --text: ${brand.text_color};
    --border: ${brand.primary_color}22;
  `;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 animate-fade-up">
      <h1 style={{ fontFamily: `'Cormorant Garamond', serif`, fontSize: 28, color: 'var(--text)', marginBottom: 4 }}>
        Brand Settings
      </h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 32 }}>
        Customise how your platform looks to your members.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* ── LEFT: Controls ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Platform Identity */}
          <Section title="Identity">
            <Field label="Platform Name *">
              <input
                value={brand.platform_name}
                onChange={e => updateBrand('platform_name', e.target.value)}
                placeholder="e.g. John Adeyemi Coaching"
                style={inputStyle}
              />
            </Field>
            <Field label="Tagline">
              <input
                value={brand.tagline || ''}
                onChange={e => updateBrand('tagline', e.target.value)}
                placeholder="Your coaching tagline"
                style={inputStyle}
              />
            </Field>
          </Section>

          {/* Logo */}
          <Section title="Logo & Favicon">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Logo preview */}
              <div style={{
                border: '1px dashed var(--border)', borderRadius: 10, padding: 16,
                display: 'flex', alignItems: 'center', gap: 16,
                background: 'var(--bg-input)',
              }}>
                {brand.logo_url ? (
                  <img src={brand.logo_url} alt="Logo" style={{ height: 40, maxWidth: 160, objectFit: 'contain' }} />
                ) : (
                  <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>No logo uploaded</div>
                )}
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  style={{
                    marginLeft: 'auto', padding: '8px 16px', borderRadius: 8,
                    background: 'var(--accent)', color: '#000',
                    border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>
                  {logoUploading ? 'Uploading...' : 'Upload Logo'}
                </button>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => handleLogoUpload(e, 'logo')} style={{ display: 'none' }} />
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                SVG or PNG recommended. Max 2MB. Displayed on dark background.
              </p>

              {/* Favicon */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {brand.favicon_url
                  ? <img src={brand.favicon_url} alt="Favicon" style={{ width: 24, height: 24 }} />
                  : <div style={{ width: 24, height: 24, background: 'var(--bg-input)', borderRadius: 4, border: '1px dashed var(--border)' }} />
                }
                <button
                  onClick={() => faviconInputRef.current?.click()}
                  disabled={faviconUploading}
                  style={{
                    padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                    background: 'transparent', color: 'var(--text-muted)',
                    border: '1px solid var(--border)', fontSize: 11,
                  }}>
                  {faviconUploading ? '...' : 'Upload Favicon'}
                </button>
                <input ref={faviconInputRef} type="file" accept="image/x-icon,image/png,image/svg+xml"
                  onChange={e => handleLogoUpload(e, 'favicon')} style={{ display: 'none' }} />
              </div>
            </div>
          </Section>

          {/* Colours */}
          <Section title="Brand Colours">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {COLOR_FIELDS.map(({ key, label, hint }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="color"
                    value={(brand[key] as string) || '#000000'}
                    onChange={e => updateBrand(key, e.target.value)}
                    style={{ width: 40, height: 40, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', padding: 2, background: 'none' }}
                  />
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{label}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{hint}</p>
                  </div>
                  <code style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                    {brand[key] as string}
                  </code>
                </div>
              ))}
            </div>
          </Section>

          {/* Fonts */}
          <Section title="Typography">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Heading Font">
                <select
                  value={brand.font_heading}
                  onChange={e => updateBrand('font_heading', e.target.value as FontOption)}
                  style={inputStyle}>
                  {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Body Font">
                <select
                  value={brand.font_body}
                  onChange={e => updateBrand('font_body', e.target.value as FontOption)}
                  style={inputStyle}>
                  {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
            </div>
          </Section>

          {/* Branding toggle */}
          <Section title="White-Label">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 13, color: 'var(--text)' }}>Hide "Powered by Ascentor"</p>
                <p style={{ fontSize: 11, color: isPro ? 'var(--success)' : 'var(--text-dim)' }}>
                  {isPro ? 'Available on your Partner Pro plan' : 'Requires Partner Pro plan — contact us to upgrade'}
                </p>
              </div>
              {isPro ? (
                <button
                  onClick={() => updateBrand('hide_ascentor_branding', !brand.hide_ascentor_branding)}
                  aria-label={brand.hide_ascentor_branding ? 'Branding hidden' : 'Branding visible'}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: brand.hide_ascentor_branding ? brand.primary_color : 'var(--bg-input)',
                    transition: 'all 0.2s', position: 'relative',
                  }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', position: 'absolute', top: 3,
                    transition: 'all 0.2s',
                    left: brand.hide_ascentor_branding ? 23 : 3,
                    background: brand.hide_ascentor_branding ? '#000' : 'var(--text-dim)',
                  }} />
                </button>
              ) : (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                  background: 'rgba(232,160,32,0.08)', color: '#E8A020',
                  border: '1px solid rgba(232,160,32,0.25)', whiteSpace: 'nowrap',
                }}>
                  Pro only
                </span>
              )}
            </div>
          </Section>

          {/* Save */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '12px 28px', borderRadius: 10, border: 'none',
                background: 'var(--accent)', color: '#000',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                opacity: saving ? 0.5 : 1,
              }}>
              {saving ? 'Saving...' : 'Save Brand'}
            </button>
            {saved && <span style={{ color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>✓ Saved</span>}
            {error && <span style={{ color: 'var(--error)', fontSize: 12 }}>{error}</span>}
          </div>
        </div>

        {/* ── RIGHT: Live Preview ── */}
        <div style={{ position: 'sticky', top: 20, height: 'fit-content' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {(['desktop', 'mobile'] as const).map(tab => (
              <button key={tab} onClick={() => setPreviewTab(tab)}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
                  background: previewTab === tab ? 'var(--accent)' : 'var(--bg-input)',
                  color: previewTab === tab ? '#000' : 'var(--text-dim)',
                }}>
                {tab}
              </button>
            ))}
          </div>

          <div style={{
            border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden',
            width: previewTab === 'mobile' ? 320 : '100%',
            transition: 'width 0.3s',
          }}>
            {/* Preview header */}
            <div style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${brand.primary_color}22`,
              background: brand.bg_color,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              {brand.logo_url
                ? <img src={brand.logo_url} alt="Logo" style={{ height: 28, maxWidth: 120, objectFit: 'contain' }} />
                : <span style={{ fontFamily: `'${brand.font_heading}', serif`, fontSize: 18, fontWeight: 700, color: brand.primary_color }}>
                    {brand.platform_name || 'Your Brand'}
                  </span>
              }
              <div style={{ display: 'flex', gap: 8 }}>
                {['Dashboard', 'Coach', 'Community'].map(item => (
                  <span key={item} style={{ fontSize: 11, color: brand.text_color, opacity: 0.6 }}>{item}</span>
                ))}
              </div>
            </div>

            {/* Preview body */}
            <div style={{
              padding: 20, background: brand.bg_color,
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{
                padding: 16, borderRadius: 10, border: `1px solid ${brand.primary_color}22`,
                background: brand.card_color,
              }}>
                <h3 style={{
                  fontFamily: `'${brand.font_heading}', serif`,
                  fontSize: 16, color: brand.text_color, marginBottom: 6,
                }}>
                  Welcome back, Chidi
                </h3>
                <p style={{ fontSize: 12, color: `${brand.text_color}88` }}>
                  Continue your journey to the top.
                </p>
                <button style={{
                  marginTop: 12, padding: '8px 18px', borderRadius: 8,
                  background: brand.primary_color, color: '#000',
                  border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>
                  Open Coach →
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {['Sessions', 'Goals', 'Community', 'Progress'].map(item => (
                  <div key={item} style={{
                    padding: 12, borderRadius: 8,
                    background: brand.card_color,
                    border: `1px solid ${brand.primary_color}15`,
                    fontSize: 11, color: `${brand.text_color}88`,
                  }}>
                    {item}
                  </div>
                ))}
              </div>

              {!brand.hide_ascentor_branding && (
                <p style={{ fontSize: 10, color: `${brand.text_color}44`, textAlign: 'center' }}>
                  Powered by Ascentor
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 12,
      border: '1px solid var(--border)', padding: '16px 18px',
    }}>
      <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 14 }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </label>
      {children}
    </div>
  );
}
