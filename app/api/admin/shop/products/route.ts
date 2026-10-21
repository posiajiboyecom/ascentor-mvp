// /api/admin/shop/products: list (incl. drafts), create, update, delete

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit-log';
import { parseJson } from '@/lib/validation/http';
import * as adminSchemas from '@/lib/validation/schemas/admin';
import { shopAdmin, forbidden, migrationMissing, MIGRATION_NOTICE } from '../_auth';
import { guardApi } from '@/lib/admin/api-guard';

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60) || 'item';

async function uniqueSlug(name: string, selfId?: string) {
  const base = slugify(name);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const { data } = await supabaseAdmin.from('products').select('id').eq('slug', candidate).maybeSingle();
    if (!data || data.id === selfId) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function failure(tag: string, error: { code?: string; message?: string }) {
  if (migrationMissing(error)) return NextResponse.json({ error: MIGRATION_NOTICE, migrationNeeded: true }, { status: 503 });
  console.error(`[shop products ${tag}]`, error);
  return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
}

export async function GET() {
  const _g = await guardApi('products', 'view');
  if ('error' in _g) return _g.res;
  if (!(await shopAdmin())) return forbidden();
  const { data, error } = await supabaseAdmin.from('products').select('*').order('sort_order', { ascending: true });
  if (error) {
    if (migrationMissing(error)) return NextResponse.json({ products: [], migrationNeeded: true, notice: MIGRATION_NOTICE });
    return failure('GET', error);
  }
  return NextResponse.json({ products: data || [] });
}

export async function POST(req: NextRequest) {
  const _g = await guardApi('products', 'edit', req);
  if ('error' in _g) return _g.res;
  const admin = await shopAdmin();
  if (!admin) return forbidden();
  const parsed = await parseJson(req, adminSchemas.shopProductCreate);
  if (!parsed.ok) return parsed.response;
  const b = parsed.data;

  const row = {
    ...b,
    slug: await uniqueSlug(b.name),
    sizes: b.fulfilment === 'ship' && b.sizes?.length ? b.sizes : null,
    file_path: b.fulfilment === 'digital' ? b.file_path ?? null : null,
    // legacy columns the older products page still reads
    price: b.price_ngn,
    currency: 'NGN',
    category: b.shop_category,
    cta_label: b.price_ngn === 0 ? 'Get it free' : 'Buy now',
    cta_url: '/shop',
  };
  const { data, error } = await supabaseAdmin.from('products').insert(row).select().single();
  if (error) return failure('POST', error);

  await logAudit(supabaseAdmin, { userId: admin.id, action: 'shop_product_created', entityType: 'product', entityId: data.id, details: { name: b.name } });
  return NextResponse.json({ success: true, product: data });
}

export async function PATCH(req: NextRequest) {
  const _g = await guardApi('products', 'edit', req);
  if ('error' in _g) return _g.res;
  const admin = await shopAdmin();
  if (!admin) return forbidden();
  const parsed = await parseJson(req, adminSchemas.shopProductUpdate);
  if (!parsed.ok) return parsed.response;
  const { id, ...fields } = parsed.data;

  const updates: Record<string, unknown> = { ...fields };
  if (fields.price_ngn !== undefined) { updates.price = fields.price_ngn; updates.currency = 'NGN'; }
  if (fields.shop_category !== undefined) updates.category = fields.shop_category;
  if (fields.fulfilment && fields.fulfilment !== 'ship') updates.sizes = null;
  if (fields.fulfilment && fields.fulfilment !== 'digital') updates.file_path = null;
  if (fields.sizes && !fields.sizes.length) updates.sizes = null;
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  if (fields.name) {
    const { data: cur } = await supabaseAdmin.from('products').select('slug').eq('id', id).maybeSingle();
    if (cur && !cur.slug) updates.slug = await uniqueSlug(fields.name, id);
  }

  const { data, error } = await supabaseAdmin.from('products').update(updates).eq('id', id).select().single();
  if (error) return failure('PATCH', error);

  await logAudit(supabaseAdmin, { userId: admin.id, action: 'shop_product_updated', entityType: 'product', entityId: id, details: { fields: Object.keys(fields) } });
  return NextResponse.json({ success: true, product: data });
}

export async function DELETE(req: NextRequest) {
  const _g = await guardApi('products', 'full', req);
  if ('error' in _g) return _g.res;
  const admin = await shopAdmin();
  if (!admin) return forbidden();
  if (admin.role !== 'admin') return NextResponse.json({ error: 'Only admins can delete products' }, { status: 403 });
  const parsed = await parseJson(req, adminSchemas.shopProductDelete);
  if (!parsed.ok) return parsed.response;
  const { id } = parsed.data;

  const { data: cur } = await supabaseAdmin.from('products').select('name, file_path').eq('id', id).maybeSingle();
  const { error } = await supabaseAdmin.from('products').delete().eq('id', id);
  if (error) return failure('DELETE', error);
  if (cur?.file_path) {
    try { await supabaseAdmin.storage.from('shop-files').remove([cur.file_path]); } catch {}
  }

  await logAudit(supabaseAdmin, { userId: admin.id, action: 'shop_product_deleted', entityType: 'product', entityId: id, details: { name: cur?.name } });
  return NextResponse.json({ success: true });
}
