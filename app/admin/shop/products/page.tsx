'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Star } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { SHOP_CATEGORIES, SHOP_SIZES, naira, type ShopProduct } from '@/lib/shop-shared';

// /admin/shop/products: create, edit, publish and delete shop products.
// Images go to the public 'product-images' bucket; PDFs go to the private 'shop-files' bucket via the API.

const brand = {
  font: "'Metropolis', system-ui, sans-serif",
  gold: '#b6502a',
  goldMuted: 'rgba(182,80,42,0.08)',
  goldBorder: 'rgba(182,80,42,0.22)',
  teal: '#14B8A6',
  red: '#EF4444',
  card: 'var(--admin-bg-deep)',
  panel: 'var(--admin-bg-card)',
  border: 'var(--admin-border)',
  text: 'var(--admin-text)',
  heading: 'var(--admin-text-heading)',
  muted: 'var(--admin-text-muted)',
  faint: 'var(--admin-text-faint)',
};

type Form = {
  name: string; tagline: string; description: string; image_url: string | null; hover_image_url: string | null; gallery_urls: string[]; badge: string;
  shop_category: ShopProduct['shop_category']; fulfilment: ShopProduct['fulfilment'];
  price_ngn: number; unlimited: boolean; stock: number; sizes: string[]; file_path: string | null;
  lead_capture: boolean; is_featured: boolean; published: boolean; sort_order: number;
  min_plan: 'seeker' | 'builder';
};

const EMPTY: Form = {
  name: '', tagline: '', description: '', image_url: null, hover_image_url: null, gallery_urls: [], badge: '',
  shop_category: 'Apparel', fulfilment: 'ship', price_ngn: 0, unlimited: true, stock: 0, sizes: [],
  file_path: null, lead_capture: false, is_featured: false, published: false, sort_order: 0, min_plan: 'seeker',
};

const FULFILMENT_LABEL = { ship: 'Ships', digital: 'Digital download', learn: 'Learning (in app)' } as const;

export default function AdminShopProductsPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [fileName, setFileName] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'' | 'cover' | 'hover' | 'gallery' | 'pdf'>('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const hoverRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/shop/products');
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to load');
      setProducts(j.products || []);
      setNotice(j.migrationNeeded ? j.notice : '');
    } catch (e: any) {
      setError(e.message || 'Failed to load products');
    }
    setLoading(false);
  }

  function openNew() {
    setEditId(null); setForm({ ...EMPTY, sort_order: products.length }); setFileName(''); setError(''); setOpen(true);
  }

  function openEdit(p: ShopProduct) {
    setEditId(p.id);
    setForm({
      name: p.name, tagline: p.tagline || '', description: p.description || '', image_url: p.image_url, hover_image_url: p.hover_image_url ?? null, gallery_urls: p.gallery_urls ?? [], badge: p.badge || '',
      shop_category: p.shop_category, fulfilment: p.fulfilment, price_ngn: p.price_ngn,
      unlimited: p.stock == null, stock: p.stock ?? 0, sizes: p.sizes || [], file_path: p.file_path,
      lead_capture: p.lead_capture, is_featured: p.is_featured, published: p.published, sort_order: p.sort_order,
      min_plan: p.min_plan === 'builder' ? 'builder' : 'seeker',
    });
    setFileName(p.file_path ? p.file_path.split('/').pop() || '' : '');
    setError(''); setOpen(true);
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));

  // Pictures and GIFs go straight to the public product-images bucket. A GIF keeps its animation because it is stored as uploaded.
  async function uploadMedia(file: File, kind: 'cover' | 'hover' | 'gallery') {
    if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) { setError('Use a JPG, PNG, WebP or GIF file'); return; }
    if (file.size > 8 * 1024 * 1024) { setError('That file is over 8MB. Use a smaller one.'); return; }
    setUploading(kind); setError('');
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `shop/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error: err } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
      if (err) throw err;
      const url = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
      if (kind === 'cover') set('image_url', url);
      else if (kind === 'hover') set('hover_image_url', url);
      else setForm(f => ({ ...f, gallery_urls: [...f.gallery_urls, url].slice(0, 6) }));
    } catch { setError('Image upload failed'); }
    setUploading('');
  }

  async function uploadPdf(file: File) {
    setUploading('pdf'); setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/admin/shop/upload', { method: 'POST', body });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Upload failed');
      set('file_path', j.path); setFileName(file.name);
    } catch (e: any) { setError(e.message || 'PDF upload failed'); }
    setUploading('');
  }

  async function save() {
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (form.fulfilment === 'digital' && !form.file_path) { setError('Upload a PDF for digital items'); return; }
    setSaving(true); setError('');
    const body = {
      name: form.name.trim(),
      tagline: form.tagline.trim(), // tagline and description are NOT NULL columns, so empty is saved as ''
      description: form.description.trim(),
      image_url: form.image_url?.trim() || null,
      hover_image_url: form.hover_image_url?.trim() || null,
      gallery_urls: form.gallery_urls.length ? form.gallery_urls : null,
      badge: form.badge.trim() || null,
      shop_category: form.shop_category,
      fulfilment: form.fulfilment,
      price_ngn: Math.max(0, Math.round(Number(form.price_ngn) || 0)),
      stock: form.fulfilment === 'ship' && !form.unlimited ? Math.max(0, Math.round(Number(form.stock) || 0)) : null,
      sizes: form.fulfilment === 'ship' && form.sizes.length ? form.sizes : null,
      file_path: form.fulfilment === 'digital' ? form.file_path : null,
      lead_capture: form.price_ngn <= 0 && form.fulfilment !== 'learn' ? form.lead_capture : false,
      min_plan: form.fulfilment === 'learn' ? form.min_plan : null,
      is_featured: form.is_featured,
      published: form.published,
      sort_order: form.sort_order,
    };
    try {
      const res = await fetch('/api/admin/shop/products', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editId ? { id: editId, ...body } : body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Save failed');
      setOpen(false);
      await load();
    } catch (e: any) { setError(e.message || 'Save failed'); }
    setSaving(false);
  }

  async function quick(p: ShopProduct, patch: Partial<Pick<ShopProduct, 'published' | 'is_featured'>>) {
    const res = await fetch('/api/admin/shop/products', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, ...patch }),
    });
    if (res.ok) setProducts(prev => prev.map(x => x.id === p.id ? { ...x, ...patch } : x));
    else setError((await res.json().catch(() => ({}))).error || 'Update failed');
  }

  async function remove(id: string) {
    const res = await fetch('/api/admin/shop/products', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    });
    if (res.ok) setProducts(prev => prev.filter(p => p.id !== id));
    else setError((await res.json().catch(() => ({}))).error || 'Delete failed');
    setDeleteId(null);
  }

  const statusOf = (p: ShopProduct) =>
    !p.published ? { label: 'Draft', color: brand.faint }
      : p.fulfilment === 'ship' && p.stock === 0 ? { label: 'Out of stock', color: brand.red }
      : { label: 'Published', color: brand.teal };

  const isFreeForm = form.price_ngn <= 0;

  return (
    <>
      <style>{`
        .sp-input { font-family: 'Metropolis', sans-serif; font-size: 13px; padding: 10px 14px; border-radius: 9px; width: 100%;
          background: var(--admin-bg-card); color: var(--admin-text); border: 1px solid var(--admin-border); outline: none; }
        .sp-input:focus { border-color: rgba(182,80,42,0.45); }
        .sp-label { font-size: 10px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--admin-text-muted); display: block; margin-bottom: 6px; }
        .sp-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media (max-width: 600px) { .sp-row { grid-template-columns: 1fr; } }
        .sp-toggle { width: 36px; height: 20px; border-radius: 999px; border: none; cursor: pointer; position: relative; flex-shrink: 0; }
        .sp-toggle::after { content: ''; position: absolute; width: 14px; height: 14px; border-radius: 50%; background: #fff; top: 3px; transition: left 0.2s; }
        .sp-on { background: #14B8A6; } .sp-on::after { left: 19px; }
        .sp-off { background: var(--admin-bg-input); } .sp-off::after { left: 3px; }
        .sp-table th { text-align: left; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--admin-text-muted); font-weight: 500; padding: 10px 14px; border-bottom: 1px solid var(--admin-border); white-space: nowrap; }
        .sp-table td { padding: 12px 14px; border-bottom: 1px solid var(--admin-border); font-size: 13px; color: var(--admin-text); vertical-align: middle; }
        .sp-table tr:last-child td { border-bottom: none; }
        /* the name column keeps a readable width on phones; the table scrolls inside its own box */
        .sp-table td:first-child, .sp-table th:first-child { min-width: 240px; }
      `}</style>

      <div style={{ fontFamily: brand.font }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontWeight: 700, fontSize: 'clamp(24px, 3vw, 32px)', color: brand.heading, margin: 0 }}>Shop products</h1>
              <p style={{ fontSize: 11, color: brand.muted, marginTop: 6, letterSpacing: '0.04em' }}>
                {products.length} TOTAL · {products.filter(p => p.published).length} PUBLISHED · {products.filter(p => p.is_featured).length} FEATURED
              </p>
            </div>
            <button onClick={openNew} style={{ fontFamily: brand.font, fontSize: 12, fontWeight: 700, padding: '9px 20px', borderRadius: 9, cursor: 'pointer', background: brand.gold, color: '#fff', border: 'none' }}>
              + Add product
            </button>
          </div>
          <div style={{ height: 1, background: `linear-gradient(90deg, ${brand.gold} 0%, transparent 60%)`, marginTop: 18 }} />
        </div>

        {notice && (
          <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 16, background: brand.goldMuted, border: `1px solid ${brand.goldBorder}`, color: brand.text, fontSize: 13 }}>{notice}</div>
        )}
        {error && !open && <p style={{ color: brand.red, fontSize: 12, marginBottom: 12 }}>{error}</p>}

        {loading ? (
          <p style={{ textAlign: 'center', padding: '60px 0', fontSize: 11, color: brand.faint }}>Loading products…</p>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '70px 20px' }}>
            <p style={{ fontSize: 24, color: brand.faint, marginBottom: 8 }}>No products yet</p>
            <p style={{ fontSize: 11, color: brand.faint }}>Click &quot;+ Add product&quot; to create your first one</p>
          </div>
        ) : (
          <div style={{ borderRadius: 12, background: brand.card, border: `1px solid ${brand.border}`, overflowX: 'auto' }}>
            <table className="sp-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Sold</th><th>Status</th><th /></tr></thead>
              <tbody>
                {products.map(p => {
                  const st = statusOf(p);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden', background: brand.panel, flexShrink: 0 }}>
                            {p.image_url && <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <span style={{ fontWeight: 700, color: brand.heading }}>{p.name}</span>
                            {p.is_featured && <Star size={10} fill={brand.gold} color={brand.gold} style={{ marginLeft: 6 }} />}
                            <div style={{ fontSize: 11, color: brand.faint }}>{FULFILMENT_LABEL[p.fulfilment]}</div>
                          </div>
                        </div>
                      </td>
                      <td>{p.shop_category}</td>
                      <td style={{ color: p.price_ngn === 0 ? brand.teal : brand.text }}>{p.price_ngn === 0 ? 'Free' : naira(p.price_ngn)}</td>
                      <td>{p.fulfilment !== 'ship' || p.stock == null ? '∞' : p.stock}</td>
                      <td>{(p as ShopProduct & { sold_count?: number }).sold_count ?? 0}</td>
                      <td><span style={{ color: st.color, fontWeight: 600, fontSize: 12 }}>{st.label}</span></td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => quick(p, { published: !p.published })} className={`sp-toggle ${p.published ? 'sp-on' : 'sp-off'}`} title={p.published ? 'Published, click to unpublish' : 'Draft, click to publish'} style={{ marginRight: 10, verticalAlign: 'middle' }} />
                        <button onClick={() => openEdit(p)} style={{ fontFamily: brand.font, fontSize: 11, fontWeight: 600, padding: '6px 14px', borderRadius: 7, cursor: 'pointer', background: brand.goldMuted, color: brand.gold, border: `1px solid ${brand.goldBorder}`, marginRight: 6 }}>Edit</button>
                        <button onClick={() => setDeleteId(p.id)} style={{ fontFamily: brand.font, fontSize: 11, fontWeight: 600, padding: '6px 14px', borderRadius: 7, cursor: 'pointer', background: 'rgba(239,68,68,0.08)', color: brand.red, border: '1px solid rgba(239,68,68,0.25)' }}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Off-canvas editor */}
        {open && (
          <>
            <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9990 }} />
            <aside style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(520px, 100vw)', background: brand.card, borderLeft: `1px solid ${brand.goldBorder}`, zIndex: 9991, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '18px 24px', background: brand.panel, borderBottom: `1px solid ${brand.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontWeight: 700, fontSize: 18, color: brand.heading, margin: 0 }}>{editId ? 'Edit product' : 'New product'}</p>
                <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: 'transparent', border: `1px solid ${brand.border}`, borderRadius: 6, color: brand.muted, cursor: 'pointer', padding: '4px 8px', display: 'flex' }}><X size={14} /></button>
              </div>

              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto', flex: 1 }}>
                <div>
                  <label className="sp-label">Cover picture</label>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div style={{ width: 96, height: 72, borderRadius: 10, background: brand.panel, border: `1px solid ${brand.border}`, overflow: 'hidden', flexShrink: 0 }}>
                      {form.image_url && <img src={form.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                      <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadMedia(f, 'cover'); e.target.value = ''; }} />
                      <button type="button" onClick={() => coverRef.current?.click()} disabled={uploading === 'cover'} style={{ fontFamily: brand.font, fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', background: brand.panel, color: brand.text, border: `1px solid ${brand.border}` }}>
                        {uploading === 'cover' ? 'Uploading…' : form.image_url ? '↑ Replace' : '↑ Upload'}
                      </button>
                      {form.image_url && <button type="button" onClick={() => set('image_url', null)} style={{ fontSize: 11, color: brand.red, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Remove</button>}
                      <span style={{ fontSize: 11, color: brand.faint }}>Shown on the shop grid. A GIF works here too.</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="sp-label">Hover picture</label>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div style={{ width: 96, height: 72, borderRadius: 10, background: brand.panel, border: `1px solid ${brand.border}`, overflow: 'hidden', flexShrink: 0 }}>
                      {form.hover_image_url && <img src={form.hover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                      <input ref={hoverRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadMedia(f, 'hover'); e.target.value = ''; }} />
                      <button type="button" onClick={() => hoverRef.current?.click()} disabled={uploading === 'hover'} style={{ fontFamily: brand.font, fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', background: brand.panel, color: brand.text, border: `1px solid ${brand.border}` }}>
                        {uploading === 'hover' ? 'Uploading…' : form.hover_image_url ? '↑ Replace' : '↑ Upload'}
                      </button>
                      {form.hover_image_url && <button type="button" onClick={() => set('hover_image_url', null)} style={{ fontSize: 11, color: brand.red, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Remove</button>}
                      <span style={{ fontSize: 11, color: brand.faint }}>Shows when someone points at the product in the shop. Optional.</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="sp-label">Gallery ({form.gallery_urls.length}/6)</label>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    {form.gallery_urls.map((u, i) => (
                      <div key={u} style={{ position: 'relative', width: 72, height: 72, borderRadius: 10, overflow: 'hidden', border: `1px solid ${brand.border}`, background: brand.panel }}>
                        <img src={u} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button type="button" aria-label="Remove this picture" onClick={() => setForm(f => ({ ...f, gallery_urls: f.gallery_urls.filter((_, j) => j !== i) }))} style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 12, lineHeight: '20px', padding: 0 }}>×</button>
                      </div>
                    ))}
                    {form.gallery_urls.length < 6 && (
                      <>
                        <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadMedia(f, 'gallery'); e.target.value = ''; }} />
                        <button type="button" onClick={() => galleryRef.current?.click()} disabled={uploading === 'gallery'} style={{ ...({ fontFamily: brand.font, fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', background: brand.panel, color: brand.text, border: `1px solid ${brand.border}` }), width: 72, height: 72, padding: 0, borderStyle: 'dashed' }}>{uploading === 'gallery' ? '…' : '+ Add'}</button>
                      </>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: brand.faint, display: 'block', marginTop: 6 }}>Extra pictures or GIFs, shown on the product page. JPG, PNG, WebP or GIF, up to 8MB each.</span>
                </div>

                <div><label className="sp-label">Name *</label><input className="sp-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Rise by Choice hoodie" /></div>
                <div><label className="sp-label">Tagline</label><input className="sp-input" value={form.tagline} onChange={e => set('tagline', e.target.value)} placeholder="One short line for the card" /></div>
                <div><label className="sp-label">Description</label><textarea className="sp-input" rows={4} value={form.description} onChange={e => set('description', e.target.value)} style={{ resize: 'vertical' }} /></div>

                <div className="sp-row">
                  <div>
                    <label className="sp-label">Category</label>
                    <select className="sp-input" value={form.shop_category} onChange={e => set('shop_category', e.target.value as Form['shop_category'])}>
                      {SHOP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="sp-label">Fulfilment</label>
                    <select className="sp-input" value={form.fulfilment} onChange={e => set('fulfilment', e.target.value as Form['fulfilment'])}>
                      {(Object.keys(FULFILMENT_LABEL) as (keyof typeof FULFILMENT_LABEL)[]).map(k => <option key={k} value={k}>{FULFILMENT_LABEL[k]}</option>)}
                    </select>
                  </div>
                </div>

                <div className="sp-row">
                  <div>
                    <label className="sp-label">Price (₦, 0 = free)</label>
                    <input className="sp-input" type="number" min={0} step={1} value={form.price_ngn} onChange={e => set('price_ngn', Number(e.target.value))} />
                  </div>
                  {form.fulfilment === 'ship' && (
                    <div>
                      <label className="sp-label">Stock</label>
                      <input className="sp-input" type="number" min={0} step={1} disabled={form.unlimited} value={form.unlimited ? '' : form.stock} placeholder={form.unlimited ? 'Unlimited' : ''} onChange={e => set('stock', Number(e.target.value))} />
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, fontSize: 11, color: brand.muted, cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.unlimited} onChange={e => set('unlimited', e.target.checked)} /> Unlimited
                      </label>
                    </div>
                  )}
                  {form.fulfilment === 'learn' && (
                    <div>
                      <label className="sp-label">Minimum plan</label>
                      <select className="sp-input" value={form.min_plan} onChange={e => set('min_plan', e.target.value as Form['min_plan'])}>
                        <option value="seeker">Seeker</option><option value="builder">Builder</option>
                      </select>
                    </div>
                  )}
                </div>

                {form.fulfilment === 'ship' && (
                  <div>
                    <label className="sp-label">Sizes (leave empty for none)</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {SHOP_SIZES.map(s => {
                        const on = form.sizes.includes(s);
                        return (
                          <button key={s} type="button" onClick={() => set('sizes', on ? form.sizes.filter(x => x !== s) : SHOP_SIZES.filter(x => x === s || form.sizes.includes(x)))}
                            style={{ fontFamily: brand.font, fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 999, cursor: 'pointer', background: on ? brand.goldMuted : 'transparent', color: on ? brand.gold : brand.muted, border: `1px solid ${on ? brand.goldBorder : brand.border}` }}>{s}</button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {form.fulfilment === 'digital' && (
                  <div>
                    <label className="sp-label">PDF file *</label>
                    <input ref={pdfRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadPdf(f); e.target.value = ''; }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => pdfRef.current?.click()} disabled={uploading === 'pdf'} style={{ fontFamily: brand.font, fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', background: brand.panel, color: brand.text, border: `1px solid ${brand.border}` }}>
                        {uploading === 'pdf' ? 'Uploading…' : form.file_path ? '↑ Replace PDF' : '↑ Upload PDF'}
                      </button>
                      <span style={{ fontSize: 12, color: form.file_path ? brand.teal : brand.faint }}>{form.file_path ? `Stored privately: ${fileName}` : 'PDF only, up to 25MB. Buyers get a private download link.'}</span>
                    </div>
                  </div>
                )}

                <div className="sp-row">
                  <div><label className="sp-label">Badge</label><input className="sp-input" value={form.badge} onChange={e => set('badge', e.target.value)} placeholder="New, Bestseller, Limited" /></div>
                  <div><label className="sp-label">Sort order</label><input className="sp-input" type="number" min={0} value={form.sort_order} onChange={e => set('sort_order', Number(e.target.value))} /></div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {([
                    { key: 'published', label: 'Published', desc: 'Visible in the shop', show: true },
                    { key: 'is_featured', label: 'Featured', desc: 'Shown first', show: true },
                    { key: 'lead_capture', label: 'Capture leads', desc: 'Free items: ask for name and email before download', show: isFreeForm && form.fulfilment !== 'learn' },
                  ] as const).filter(t => t.show).map(t => (
                    <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button type="button" onClick={() => set(t.key, !form[t.key])} className={`sp-toggle ${form[t.key] ? 'sp-on' : 'sp-off'}`} aria-label={t.label} />
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: brand.text, margin: 0 }}>{t.label}</p>
                        <p style={{ fontSize: 10, color: brand.faint, margin: 0 }}>{t.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {error && <p style={{ color: brand.red, fontSize: 12, margin: 0 }}>{error}</p>}
              </div>

              <div style={{ display: 'flex', gap: 10, padding: '14px 24px', borderTop: `1px solid ${brand.border}`, background: brand.panel }}>
                <button onClick={save} disabled={saving || !form.name.trim()} style={{ fontFamily: brand.font, fontSize: 12, fontWeight: 700, padding: '10px 24px', borderRadius: 9, cursor: saving ? 'not-allowed' : 'pointer', background: brand.gold, color: '#fff', border: 'none', opacity: saving || !form.name.trim() ? 0.5 : 1 }}>
                  {saving ? 'Saving…' : editId ? 'Save changes' : 'Create product'}
                </button>
                <button onClick={() => setOpen(false)} style={{ fontFamily: brand.font, fontSize: 12, fontWeight: 600, padding: '10px 18px', borderRadius: 9, cursor: 'pointer', background: 'transparent', color: brand.muted, border: `1px solid ${brand.border}` }}>Cancel</button>
              </div>
            </aside>
          </>
        )}

        {deleteId && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: brand.card, border: `1px solid ${brand.border}`, borderRadius: 14, padding: 28, maxWidth: 380, width: '100%' }}>
              <p style={{ fontSize: 22, fontWeight: 700, color: brand.heading, margin: '0 0 10px' }}>Delete product?</p>
              <p style={{ fontSize: 13, color: brand.muted, margin: '0 0 22px' }}>This is permanent. Past orders keep their line items.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => remove(deleteId)} style={{ flex: 1, fontFamily: brand.font, fontSize: 12, fontWeight: 700, padding: 10, borderRadius: 9, cursor: 'pointer', background: 'rgba(239,68,68,0.12)', color: brand.red, border: '1px solid rgba(239,68,68,0.3)' }}>Delete</button>
                <button onClick={() => setDeleteId(null)} style={{ flex: 1, fontFamily: brand.font, fontSize: 12, fontWeight: 600, padding: 10, borderRadius: 9, cursor: 'pointer', background: 'transparent', color: brand.muted, border: `1px solid ${brand.border}` }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
