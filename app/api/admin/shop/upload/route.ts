// POST multipart { file }: stores a PDF in the PRIVATE shop-files bucket, returns { path }

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit-log';
import { shopAdmin, forbidden } from '../_auth';
import { guardApi } from '@/lib/admin/api-guard';

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const _g = await guardApi('products', 'edit', req);
  if ('error' in _g) return _g.res;
  const admin = await shopAdmin();
  if (!admin) return forbidden();

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (file.type !== 'application/pdf') return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 25MB)' }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') return NextResponse.json({ error: 'That file is not a valid PDF' }, { status: 400 });

  const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.pdf`;
  const { error } = await supabaseAdmin.storage.from('shop-files').upload(path, buf, { contentType: 'application/pdf', upsert: false });
  if (error) {
    console.error('[shop upload]', error);
    const missing = /bucket not found/i.test(error.message || '');
    return NextResponse.json({ error: missing ? 'The shop-files storage bucket is missing. Run the shop migration first.' : 'Upload failed' }, { status: 500 });
  }

  await logAudit(supabaseAdmin, { userId: admin.id, action: 'shop_file_uploaded', entityType: 'product', entityId: path, details: { size: file.size } });
  return NextResponse.json({ success: true, path, name: file.name });
}
