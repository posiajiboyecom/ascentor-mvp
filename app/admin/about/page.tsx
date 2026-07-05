'use client';

// app/admin/about/page.tsx
// ─────────────────────────────────────────────────────────────────────
// Founder section editor for the public /about page.
// Stores into the marketing CMS: page 'about' → structured section
// 'founder' with data { name, photo_url, photo_position, photo_focus,
// bio, quote, quote_attribution }.
// Photo uploads go through /api/admin/upload-media (service role,
// 'content-media' bucket, folder 'founder').
//
// Styled with the admin --ledger-* theme tokens so it renders
// correctly in BOTH light and dark admin modes.
//
// Saving publishes immediately (draft_data = published_data,
// status 'published') — the about page reads published data only.
// ─────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

const GOLD = '#C8A96E';

interface FounderData {
  name: string;
  photo_url: string;
  photo_position: 'left' | 'right';
  photo_focus: 'top' | 'center' | 'bottom';
  bio: string;
  quote: string;
  quote_attribution: string;
}

const EMPTY: FounderData = {
  name: 'Ajiboye Ayomiposi Samuel',
  photo_url: '',
  photo_position: 'left',
  photo_focus: 'top',
  bio: '',
  quote: '',
  quote_attribution: '',
};

export default function AdminAboutPage() {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FounderData>(EMPTY);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Load (or lazily create) page + section ─────────────────────────
  useEffect(() => {
    (async () => {
      try {
        let { data: page } = await supabase
          .from('marketing_pages')
          .select('id')
          .eq('slug', 'about')
          .maybeSingle();

        if (!page) {
          const { data: created, error: pageErr } = await supabase
            .from('marketing_pages')
            .insert({ slug: 'about', title: 'About', route: '/about', status: 'published' })
            .select('id')
            .single();
          if (pageErr) throw pageErr;
          page = created;
        }

        let { data: section } = await supabase
          .from('marketing_sections')
          .select('id, draft_data')
          .eq('page_id', page!.id)
          .eq('section_key', 'founder')
          .maybeSingle();

        if (!section) {
          const { data: created, error: secErr } = await supabase
            .from('marketing_sections')
            .insert({
              page_id: page!.id,
              section_key: 'founder',
              label: 'The Founder',
              section_type: 'structured',
              draft_data: EMPTY,
              status: 'draft',
            })
            .select('id, draft_data')
            .single();
          if (secErr) throw secErr;
          section = created;
        }

        setSectionId(section!.id);
        const d = (section!.draft_data || {}) as Partial<FounderData>;
        setForm({ ...EMPTY, ...d });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load founder section');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Photo upload ────────────────────────────────────────────────────
  async function handlePhoto(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'founder');
      const res = await fetch('/api/admin/upload-media', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      setForm((f) => ({ ...f, photo_url: json.url }));
      setStatus('Photo uploaded — remember to Save & Publish.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  // ── Save & publish ──────────────────────────────────────────────────
  async function handleSave() {
    if (!sectionId) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    const payload: FounderData = {
      name: form.name.trim(),
      photo_url: form.photo_url.trim(),
      photo_position: form.photo_position,
      photo_focus: form.photo_focus,
      bio: form.bio.trim(),
      quote: form.quote.trim(),
      quote_attribution: form.quote_attribution.trim(),
    };
    const { error: saveErr } = await supabase
      .from('marketing_sections')
      .update({
        draft_data: payload,
        published_data: payload,
        status: 'published',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sectionId);
    setSaving(false);
    if (saveErr) {
      setError(saveErr.message);
    } else {
      setStatus('Saved and published. The /about page is live with this content.');
    }
  }

  // ── Theme-aware field styles (work in light AND dark admin) ────────
  const label: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: GOLD, marginBottom: 6, marginTop: 22,
  };
  const input: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--ledger-line-strong)',
    background: 'var(--ledger-bg-input)',
    color: 'var(--ledger-ink)',
    fontSize: 14,
  };
  const segBtn = (active: boolean): React.CSSProperties => ({
    padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: 'pointer',
    border: active ? `1px solid ${GOLD}` : '1px solid var(--ledger-line-strong)',
    background: active ? 'rgba(200,169,110,0.14)' : 'var(--ledger-bg-input)',
    color: active ? GOLD : 'var(--ledger-ink-soft)',
  });

  if (loading) {
    return <p style={{ padding: 32, color: 'var(--ledger-ink-faint)', fontSize: 14 }}>Loading founder section…</p>;
  }

  return (
    <div style={{ maxWidth: 680, padding: '32px 24px' }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, marginBottom: 6 }}>
        About Page
      </p>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--ledger-ink)', margin: 0 }}>
        The Founder
      </h1>
      <p style={{ fontSize: 13, color: 'var(--ledger-ink-faint)', marginTop: 8, lineHeight: 1.6 }}>
        This controls the founder section on the public{' '}
        <a href="/about" target="_blank" rel="noreferrer" style={{ color: GOLD }}>/about</a> page.
        Saving publishes immediately.
      </p>

      {/* Photo */}
      <label style={label}>Photo</label>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {form.photo_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={form.photo_url}
            alt="Founder"
            style={{
              width: 120, aspectRatio: '4 / 5', objectFit: 'cover',
              objectPosition: form.photo_focus,
              borderRadius: 10, border: `1px solid ${GOLD}55`,
            }}
          />
        ) : (
          <div style={{
            width: 120, aspectRatio: '4 / 5', borderRadius: 10,
            border: '1px dashed var(--ledger-line-strong)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--ledger-ink-faint)', fontSize: 11, textAlign: 'center', padding: 8,
          }}>
            No photo yet
          </div>
        )}
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePhoto(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              background: GOLD, color: '#0F0F0E', fontWeight: 600, fontSize: 13,
              padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? 'Uploading…' : form.photo_url ? 'Replace photo' : 'Upload photo'}
          </button>
          <p style={{ fontSize: 11, color: 'var(--ledger-ink-faint)', marginTop: 8, lineHeight: 1.5 }}>
            JPG, PNG or WebP, max 8MB.<br />Portrait orientation (4:5) displays best.
          </p>
        </div>
      </div>

      {/* Photo placement */}
      <label style={label}>Photo placement on the page</label>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['left', 'right'] as const).map((pos) => (
          <button
            key={pos}
            type="button"
            style={segBtn(form.photo_position === pos)}
            onClick={() => setForm((f) => ({ ...f, photo_position: pos }))}
          >
            {pos === 'left' ? 'Photo left, text right' : 'Text left, photo right'}
          </button>
        ))}
      </div>

      <label style={label}>Photo crop focus</label>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['top', 'center', 'bottom'] as const).map((focus) => (
          <button
            key={focus}
            type="button"
            style={segBtn(form.photo_focus === focus)}
            onClick={() => setForm((f) => ({ ...f, photo_focus: focus }))}
          >
            {focus[0].toUpperCase() + focus.slice(1)}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 11, color: 'var(--ledger-ink-faint)', marginTop: 6 }}>
        Which part of the photo stays visible when it's cropped to 4:5 — for portraits, Top usually keeps the face framed.
      </p>

      {/* Name */}
      <label style={label} htmlFor="f-name">Name</label>
      <input id="f-name" style={input} value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />

      {/* Bio */}
      <label style={label} htmlFor="f-bio">Brief / bio</label>
      <textarea
        id="f-bio"
        style={{ ...input, minHeight: 200, lineHeight: 1.6, resize: 'vertical' }}
        placeholder={'Write your bio here.\n\nLeave a blank line between paragraphs — each becomes its own paragraph on the page.'}
        value={form.bio}
        onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
      />

      {/* Quote */}
      <label style={label} htmlFor="f-quote">Signature quote (optional)</label>
      <input id="f-quote" style={input} value={form.quote}
        placeholder={'"I will not drift…"'}
        onChange={(e) => setForm((f) => ({ ...f, quote: e.target.value }))} />

      <label style={label} htmlFor="f-attr">Quote attribution (optional)</label>
      <input id="f-attr" style={input} value={form.quote_attribution}
        placeholder="Ajiboye Ayomiposi Samuel · Founder, Ascentor"
        onChange={(e) => setForm((f) => ({ ...f, quote_attribution: e.target.value }))} />

      {/* Save */}
      <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || uploading}
          style={{
            background: GOLD, color: '#0F0F0E', fontWeight: 700, fontSize: 14,
            padding: '11px 22px', borderRadius: 8, border: 'none', cursor: 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Publishing…' : 'Save & Publish'}
        </button>
        {status && <p style={{ fontSize: 13, color: '#7BA37A', margin: 0 }}>{status}</p>}
        {error && <p style={{ fontSize: 13, color: '#B96A5E', margin: 0 }}>{error}</p>}
      </div>
    </div>
  );
}
