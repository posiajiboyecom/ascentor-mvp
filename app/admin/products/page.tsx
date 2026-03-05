'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─────────────────────────────────────────────────────────────────
// /admin/products — Manage the public products page
// Create, edit, publish, reorder and delete products.
// Images upload to Supabase Storage bucket: 'product-images'
// ─────────────────────────────────────────────────────────────────

const brand = {
  fontDisplay: "'Cormorant Garamond', Georgia, serif",
  fontUI:      "'Syne', system-ui, sans-serif",
  fontMono:    "'DM Mono', monospace",
  gold:        '#E8A020',
  goldMuted:   'rgba(232,160,32,0.08)',
  goldBorder:  'rgba(232,160,32,0.22)',
  dark:        '#0C0B08',
  dark700:     '#1E1C17',
  dark600:     '#2E2A22',
  dark500:     '#4A4438',
  dark400:     '#7A7260',
  dark200:     '#D4CFC3',
  dark50:      '#F7F6F3',
  card:        '#141310',
  border:      'rgba(212,207,195,0.1)',
  teal:        '#14B8A6',
  red:         '#EF4444',
};

const CATEGORIES = ['Playbook', 'Course', 'Template', 'Masterclass', 'Bundle', 'Other'];
const CURRENCIES  = ['USD', 'NGN', 'GBP', 'EUR', 'GHS', 'KES', 'ZAR'];

type Product = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  price: number;
  currency: string;
  image_url: string | null;
  category: string;
  badge: string | null;
  cta_label: string;
  cta_url: string;
  is_featured: boolean;
  published: boolean;
  sort_order: number;
  created_at: string;
};

const EMPTY_FORM: Omit<Product, 'id' | 'created_at'> = {
  name:        '',
  tagline:     '',
  description: '',
  price:       0,
  currency:    'USD',
  image_url:   null,
  category:    'Playbook',
  badge:       '',
  cta_label:   '',
  cta_url:     '',
  is_featured: false,
  published:   false,
  sort_order:  0,
};

export default function AdminProductsPage() {
  const supabase = createClient();

  const [products,   setProducts]   = useState<Product[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [editing,    setEditing]    = useState<Product | null>(null);
  const [isNew,      setIsNew]      = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [saving,     setSaving]     = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [deleteId,   setDeleteId]   = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadProducts(); }, []);

  async function loadProducts() {
    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true });
    setProducts(data || []);
    setLoading(false);
  }

  function openNew() {
    setIsNew(true);
    setEditing(null);
    setForm({ ...EMPTY_FORM, sort_order: products.length });
    setSaved(false);
  }

  function openEdit(p: Product) {
    setIsNew(false);
    setEditing(p);
    setForm({
      name: p.name, tagline: p.tagline, description: p.description,
      price: p.price, currency: p.currency, image_url: p.image_url,
      category: p.category, badge: p.badge || '', cta_label: p.cta_label,
      cta_url: p.cta_url, is_featured: p.is_featured, published: p.published,
      sort_order: p.sort_order,
    });
    setSaved(false);
  }

  function closeForm() {
    setEditing(null);
    setIsNew(false);
  }

  async function uploadImage(file: File): Promise<string | null> {
    setUploading(true);
    try {
      const ext  = file.name.split('.').pop();
      const path = `products/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('product-images')
        .upload(path, file, { upsert: true });
      if (error) { console.error('Upload error:', error); return null; }
      const { data } = supabase.storage.from('product-images').getPublicUrl(path);
      return data.publicUrl;
    } finally {
      setUploading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file);
    if (url) setForm(f => ({ ...f, image_url: url }));
  }

  async function handleSave() {
    if (!form.name.trim() || !form.cta_url.trim()) return;
    setSaving(true);
    const payload = {
      ...form,
      badge:     form.badge?.trim() || null,
      cta_label: form.cta_label.trim() || (form.price === 0 ? 'Download Free' : 'Get it now'),
    };

    if (isNew) {
      const { data, error } = await supabase.from('products').insert(payload).select().single();
      if (!error && data) setProducts(prev => [...prev, data]);
    } else if (editing) {
      const { data, error } = await supabase.from('products').update(payload).eq('id', editing.id).select().single();
      if (!error && data) setProducts(prev => prev.map(p => p.id === data.id ? data : p));
    }

    setSaving(false);
    setSaved(true);
    closeForm();
  }

  async function togglePublished(product: Product) {
    const updated = { ...product, published: !product.published };
    await supabase.from('products').update({ published: updated.published }).eq('id', product.id);
    setProducts(prev => prev.map(p => p.id === product.id ? updated : p));
  }

  async function toggleFeatured(product: Product) {
    const updated = { ...product, is_featured: !product.is_featured };
    await supabase.from('products').update({ is_featured: updated.is_featured }).eq('id', product.id);
    setProducts(prev => prev.map(p => p.id === product.id ? updated : p));
  }

  async function handleDelete(id: string) {
    await supabase.from('products').delete().eq('id', id);
    setProducts(prev => prev.filter(p => p.id !== id));
    setDeleteId(null);
  }

  async function moveOrder(product: Product, dir: 'up' | 'down') {
    const idx   = products.findIndex(p => p.id === product.id);
    const other = dir === 'up' ? products[idx - 1] : products[idx + 1];
    if (!other) return;
    await Promise.all([
      supabase.from('products').update({ sort_order: other.sort_order }).eq('id', product.id),
      supabase.from('products').update({ sort_order: product.sort_order }).eq('id', other.id),
    ]);
    loadProducts();
  }

  const field = (key: keyof typeof form) => ({
    value: form[key] as string | number | boolean,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const val = e.target.type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : e.target.type === 'number' ? Number(e.target.value) : e.target.value;
      setForm(f => ({ ...f, [key]: val }));
    },
  });

  const showForm = isNew || editing !== null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        .prod-input {
          font-family: 'Syne', sans-serif; font-size: 13px;
          padding: 10px 14px; border-radius: 9px; width: 100%;
          background: #1E1C17; color: #D4CFC3;
          border: 1px solid rgba(212,207,195,0.12); outline: none;
          transition: border-color 0.15s;
        }
        .prod-input:focus { border-color: rgba(232,160,32,0.4); }
        .prod-input::placeholder { color: #4A4438; }
        select.prod-input option { background: #1E1C17; }
        .prod-label {
          font-family: 'DM Mono', monospace; font-size: 10px;
          font-weight: 500; letter-spacing: 0.08em;
          text-transform: uppercase; color: #7A7260;
          display: block; margin-bottom: 6px;
        }
        .prod-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media (max-width: 600px) { .prod-row { grid-template-columns: 1fr; } }
        .toggle-btn {
          width: 36px; height: 20px; border-radius: 999px;
          border: none; cursor: pointer; position: relative;
          transition: background 0.2s; flex-shrink: 0;
        }
        .toggle-btn::after {
          content: ''; position: absolute;
          width: 14px; height: 14px; border-radius: 50%;
          background: #fff; top: 3px; transition: left 0.2s;
        }
        .toggle-on  { background: #14B8A6; }
        .toggle-off { background: #2E2A22; }
        .toggle-on::after  { left: 19px; }
        .toggle-off::after { left: 3px;  }
      `}</style>

      <div style={{ fontFamily: brand.fontUI }}>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 style={{ fontFamily: brand.fontDisplay, fontWeight: 700, fontSize: 'clamp(24px, 3vw, 32px)', color: brand.dark50, margin: 0 }}>
                Products
              </h1>
              <p style={{ fontFamily: brand.fontMono, fontSize: '11px', color: brand.dark400, marginTop: '6px', letterSpacing: '0.04em' }}>
                {products.length} TOTAL · {products.filter(p => p.published).length} PUBLISHED · {products.filter(p => p.is_featured).length} FEATURED
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <a
                href="/products"
                target="_blank"
                rel="noreferrer"
                style={{
                  fontFamily: brand.fontUI, fontSize: '11px', fontWeight: 600,
                  padding: '8px 16px', borderRadius: '9px', textDecoration: 'none',
                  background: 'transparent', color: brand.dark400, border: `1px solid ${brand.border}`,
                }}
              >
                ↗ View Page
              </a>
              <button
                onClick={openNew}
                style={{
                  fontFamily: brand.fontUI, fontSize: '12px', fontWeight: 700,
                  padding: '9px 20px', borderRadius: '9px', cursor: 'pointer',
                  background: brand.gold, color: brand.dark, border: 'none',
                }}
              >
                + Add Product
              </button>
            </div>
          </div>
          <div style={{ height: '1px', background: `linear-gradient(90deg, ${brand.gold} 0%, transparent 60%)`, marginTop: '18px' }} />
        </div>

        {/* Form panel */}
        {showForm && (
          <div style={{
            borderRadius: '14px', overflow: 'hidden',
            background: brand.card, border: `1px solid ${brand.goldBorder}`,
            marginBottom: '28px',
          }}>
            {/* Form header */}
            <div style={{
              padding: '18px 24px', background: brand.dark700,
              borderBottom: `1px solid ${brand.border}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <p style={{ fontFamily: brand.fontDisplay, fontWeight: 700, fontSize: '18px', color: brand.dark50, margin: 0 }}>
                {isNew ? 'New Product' : `Editing: ${editing?.name}`}
              </p>
              <button onClick={closeForm} style={{ background: 'transparent', border: `1px solid ${brand.border}`, borderRadius: '6px', color: brand.dark400, cursor: 'pointer', padding: '4px 10px', fontFamily: brand.fontUI, fontSize: '14px' }}>✕</button>
            </div>

            {/* Form body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

              {/* Image upload */}
              <div>
                <label className="prod-label">Product Image</label>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {/* Preview */}
                  <div style={{
                    width: '120px', height: '80px', borderRadius: '10px',
                    background: brand.dark700, border: `1px solid ${brand.border}`,
                    overflow: 'hidden', flexShrink: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {form.image_url ? (
                      <img src={form.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={brand.dark500} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21,15 16,10 5,21"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      style={{
                        fontFamily: brand.fontUI, fontSize: '12px', fontWeight: 600,
                        padding: '8px 16px', borderRadius: '8px', cursor: uploading ? 'not-allowed' : 'pointer',
                        background: brand.dark700, color: brand.dark200, border: `1px solid ${brand.border}`,
                        opacity: uploading ? 0.6 : 1,
                      }}
                    >
                      {uploading ? 'Uploading…' : '↑ Upload Image'}
                    </button>
                    {form.image_url && (
                      <button
                        onClick={() => setForm(f => ({ ...f, image_url: null }))}
                        style={{ fontFamily: brand.fontUI, fontSize: '11px', color: brand.red, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      >
                        Remove image
                      </button>
                    )}
                    <input
                      className="prod-input"
                      placeholder="…or paste an image URL"
                      value={form.image_url || ''}
                      onChange={e => setForm(f => ({ ...f, image_url: e.target.value || null }))}
                    />
                  </div>
                </div>
              </div>

              {/* Name + Category */}
              <div className="prod-row">
                <div>
                  <label className="prod-label">Product Name *</label>
                  <input className="prod-input" placeholder="African Leadership Playbook" {...field('name')} value={form.name} />
                </div>
                <div>
                  <label className="prod-label">Category</label>
                  <select className="prod-input" {...field('category')} value={form.category}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Tagline */}
              <div>
                <label className="prod-label">Tagline (shown on card)</label>
                <input className="prod-input" placeholder="A short, punchy description that sells the product" {...field('tagline')} value={form.tagline} />
              </div>

              {/* Description */}
              <div>
                <label className="prod-label">Full Description</label>
                <textarea
                  className="prod-input"
                  placeholder="Detailed description for the product detail page…"
                  rows={4}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Price + Currency */}
              <div className="prod-row">
                <div>
                  <label className="prod-label">Price (0 = Free)</label>
                  <input className="prod-input" type="number" min="0" step="0.01" {...field('price')} value={form.price} />
                </div>
                <div>
                  <label className="prod-label">Currency</label>
                  <select className="prod-input" {...field('currency')} value={form.currency}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* CTA */}
              <div className="prod-row">
                <div>
                  <label className="prod-label">CTA Button Label</label>
                  <input className="prod-input" placeholder="Get it now" {...field('cta_label')} value={form.cta_label} />
                </div>
                <div>
                  <label className="prod-label">CTA URL *</label>
                  <input className="prod-input" placeholder="https://selar.co/... or /checkout" {...field('cta_url')} value={form.cta_url} />
                </div>
              </div>

              {/* Badge + Sort */}
              <div className="prod-row">
                <div>
                  <label className="prod-label">Badge (optional)</label>
                  <input className="prod-input" placeholder="New · Bestseller · Limited" {...field('badge')} value={form.badge || ''} />
                </div>
                <div>
                  <label className="prod-label">Sort Order</label>
                  <input className="prod-input" type="number" min="0" {...field('sort_order')} value={form.sort_order} />
                </div>
              </div>

              {/* Toggles */}
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                {[
                  { key: 'published' as const,   label: 'Published',       desc: 'Visible on /products page' },
                  { key: 'is_featured' as const,  label: 'Featured',        desc: 'Shown first in featured row' },
                ].map(({ key, label, desc }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
                      className={`toggle-btn ${form[key] ? 'toggle-on' : 'toggle-off'}`}
                    />
                    <div>
                      <p style={{ fontFamily: brand.fontUI, fontSize: '13px', fontWeight: 600, color: brand.dark200, margin: 0 }}>{label}</p>
                      <p style={{ fontFamily: brand.fontMono, fontSize: '10px', color: brand.dark500, margin: 0 }}>{desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Save */}
              <div style={{ display: 'flex', gap: '10px', paddingTop: '8px', borderTop: `1px solid ${brand.border}` }}>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim() || !form.cta_url.trim()}
                  style={{
                    fontFamily: brand.fontUI, fontSize: '12px', fontWeight: 700,
                    padding: '10px 24px', borderRadius: '9px', cursor: saving ? 'not-allowed' : 'pointer',
                    background: brand.gold, color: brand.dark, border: 'none',
                    opacity: (saving || !form.name.trim() || !form.cta_url.trim()) ? 0.5 : 1,
                  }}
                >
                  {saving ? 'Saving…' : isNew ? 'Create Product' : 'Save Changes'}
                </button>
                <button onClick={closeForm} style={{ fontFamily: brand.fontUI, fontSize: '12px', fontWeight: 600, padding: '10px 18px', borderRadius: '9px', cursor: 'pointer', background: 'transparent', color: brand.dark400, border: `1px solid ${brand.border}` }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Products list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontFamily: brand.fontMono, fontSize: '11px', color: brand.dark500 }}>Loading products…</p>
          </div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <p style={{ fontFamily: brand.fontDisplay, fontSize: '28px', color: brand.dark500, marginBottom: '8px' }}>No products yet</p>
            <p style={{ fontFamily: brand.fontMono, fontSize: '11px', color: brand.dark500 }}>Click "+ Add Product" to create your first one</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {products.map((p, idx) => (
              <div
                key={p.id}
                style={{
                  borderRadius: '12px', overflow: 'hidden',
                  background: brand.card, border: `1px solid ${brand.border}`,
                  borderLeft: `3px solid ${p.published ? brand.teal : brand.dark600}`,
                  display: 'flex', alignItems: 'stretch', gap: 0,
                }}
              >
                {/* Image thumbnail */}
                <div style={{
                  width: '80px', flexShrink: 0,
                  background: brand.dark700, overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={brand.dark500} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21,15 16,10 5,21"/>
                    </svg>
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, padding: '14px 18px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
                        <p style={{ fontFamily: brand.fontUI, fontWeight: 700, fontSize: '14px', color: brand.dark50, margin: 0 }}>{p.name}</p>
                        <span style={{ fontFamily: brand.fontMono, fontSize: '9px', color: brand.dark500, background: brand.dark700, padding: '2px 7px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p.category}</span>
                        {p.is_featured && <span style={{ fontFamily: brand.fontMono, fontSize: '9px', color: brand.gold }}>★ Featured</span>}
                      </div>
                      <p style={{ fontFamily: brand.fontUI, fontSize: '12px', color: brand.dark400, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px' }}>{p.tagline}</p>
                    </div>

                    {/* Price + actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: brand.fontDisplay, fontSize: '18px', fontWeight: 700, color: p.price === 0 ? brand.teal : brand.dark50 }}>
                        {p.price === 0 ? 'Free' : `${p.currency} ${p.price}`}
                      </span>

                      {/* Published toggle */}
                      <button
                        onClick={() => togglePublished(p)}
                        className={`toggle-btn ${p.published ? 'toggle-on' : 'toggle-off'}`}
                        title={p.published ? 'Published — click to unpublish' : 'Draft — click to publish'}
                      />

                      {/* Order */}
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <button onClick={() => moveOrder(p, 'up')} disabled={idx === 0} style={{ background: brand.dark700, border: `1px solid ${brand.border}`, borderRadius: '5px', color: brand.dark400, cursor: idx === 0 ? 'not-allowed' : 'pointer', padding: '3px 7px', fontSize: '11px', opacity: idx === 0 ? 0.3 : 1 }}>↑</button>
                        <button onClick={() => moveOrder(p, 'down')} disabled={idx === products.length - 1} style={{ background: brand.dark700, border: `1px solid ${brand.border}`, borderRadius: '5px', color: brand.dark400, cursor: idx === products.length - 1 ? 'not-allowed' : 'pointer', padding: '3px 7px', fontSize: '11px', opacity: idx === products.length - 1 ? 0.3 : 1 }}>↓</button>
                      </div>

                      <button onClick={() => openEdit(p)} style={{ fontFamily: brand.fontUI, fontSize: '11px', fontWeight: 600, padding: '6px 14px', borderRadius: '7px', cursor: 'pointer', background: brand.goldMuted, color: brand.gold, border: `1px solid ${brand.goldBorder}` }}>Edit</button>
                      <button onClick={() => setDeleteId(p.id)} style={{ fontFamily: brand.fontUI, fontSize: '11px', fontWeight: 600, padding: '6px 14px', borderRadius: '7px', cursor: 'pointer', background: 'rgba(239,68,68,0.06)', color: brand.red, border: '1px solid rgba(239,68,68,0.2)' }}>Delete</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Delete confirm modal */}
        {deleteId && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: brand.card, border: `1px solid ${brand.border}`, borderRadius: '14px', padding: '28px', maxWidth: '380px', width: '100%' }}>
              <p style={{ fontFamily: brand.fontDisplay, fontSize: '22px', fontWeight: 700, color: brand.dark50, margin: '0 0 10px' }}>Delete product?</p>
              <p style={{ fontFamily: brand.fontUI, fontSize: '13px', color: brand.dark400, margin: '0 0 22px' }}>This is permanent and cannot be undone.</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => handleDelete(deleteId)} style={{ flex: 1, fontFamily: brand.fontUI, fontSize: '12px', fontWeight: 700, padding: '10px', borderRadius: '9px', cursor: 'pointer', background: 'rgba(239,68,68,0.12)', color: brand.red, border: '1px solid rgba(239,68,68,0.25)' }}>Delete</button>
                <button onClick={() => setDeleteId(null)} style={{ flex: 1, fontFamily: brand.fontUI, fontSize: '12px', fontWeight: 600, padding: '10px', borderRadius: '9px', cursor: 'pointer', background: 'transparent', color: brand.dark400, border: `1px solid ${brand.border}` }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
