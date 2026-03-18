// ============================================================
// ADMIN PROMO CODES API — /api/admin/promo-codes
// GET:    list all promo codes
// POST:   create one code OR bulk-generate for events
// PATCH:  enable/disable / update code
// DELETE: remove code
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function isAdmin(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader || '' } } }
  );
  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  return data?.role === 'admin' ? user.id : null;
}

export async function GET(req: NextRequest) {
  const adminId = await isAdmin(req);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { data, error } = await supabase
    .from('promo_codes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[promo-codes GET]', error);
    return NextResponse.json({ error: 'Failed to fetch promo codes' }, { status: 500 });
  }

  return NextResponse.json({ codes: data });
}

export async function POST(req: NextRequest) {
  const adminId = await isAdmin(req);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json();
  const { code, discount, label, applies_to, max_uses, expires_at, bulk_count, bulk_prefix } = body;

  if (discount === undefined) {
    return NextResponse.json({ error: 'Discount is required' }, { status: 400 });
  }

  const discountValue = Math.min(1, Math.max(0, parseFloat(discount)));
  const plansArr = applies_to || ['explorer', 'builder', 'climber'];
  const expiryVal = expires_at || null;
  const maxUsesVal = max_uses ? parseInt(max_uses) : null;

  // Bulk generation for events
  if (bulk_count && parseInt(bulk_count) > 1) {
    const prefix = (bulk_prefix || 'EVENT').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const count = Math.min(parseInt(bulk_count), 1000);
    const codes = [];

    for (let i = 0; i < count; i++) {
      const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
      codes.push({
        code:         `${prefix}${suffix}`,
        discount:     discountValue,
        label:        label || `${Math.round(discountValue * 100)}% Off — ${prefix}`,
        applies_to:   plansArr,
        max_uses:     1,
        current_uses: 0,
        expires_at:   expiryVal,
        active:       true,
        created_by:   adminId,
      });
    }

    const { data, error } = await supabase.from('promo_codes').insert(codes).select();
    if (error) {
      console.error('[promo-codes bulk]', error);
      return NextResponse.json({ error: 'Bulk creation failed: ' + error.message }, { status: 500 });
    }

    try {
      await supabase.from('audit_logs').insert({
        user_id: adminId, action: 'promo_bulk_created', entity_type: 'promo_code',
        entity_id: prefix, details: { count, discount: discountValue, label },
      });
    } catch {}

    return NextResponse.json({ success: true, count: data.length, prefix, codes: data });
  }

  // Single code
  if (!code) return NextResponse.json({ error: 'Code is required' }, { status: 400 });

  const { data, error } = await supabase.from('promo_codes').insert({
    code:         code.toUpperCase().trim(),
    discount:     discountValue,
    label:        label || `${Math.round(discountValue * 100)}% Off`,
    applies_to:   plansArr,
    max_uses:     maxUsesVal,
    current_uses: 0,
    expires_at:   expiryVal,
    active:       true,
    created_by:   adminId,
  }).select().single();

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Code already exists' }, { status: 409 });
    console.error('[promo-codes POST]', error);
    return NextResponse.json({ error: 'Failed to create code: ' + error.message }, { status: 500 });
  }

  try {
    await supabase.from('audit_logs').insert({
      user_id: adminId, action: 'promo_code_created', entity_type: 'promo_code',
      entity_id: code.toUpperCase(), details: { discount: discountValue, label },
    });
  } catch {}

  return NextResponse.json({ success: true, code: data });
}

export async function PATCH(req: NextRequest) {
  const adminId = await isAdmin(req);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { id, active, expires_at, max_uses, label } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const updates: any = {};
  if (active !== undefined) updates.active = active;
  if (expires_at !== undefined) updates.expires_at = expires_at;
  if (max_uses !== undefined) updates.max_uses = max_uses;
  if (label !== undefined) updates.label = label;

  const { error } = await supabase.from('promo_codes').update(updates).eq('id', id);
  if (error) {
    console.error('[promo-codes PATCH]', error);
    return NextResponse.json({ error: 'Failed to update code' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const adminId = await isAdmin(req);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { error } = await supabase.from('promo_codes').delete().eq('id', id);
  if (error) {
    console.error('[promo-codes DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete code' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
