// ============================================================
// ADMIN PROMO CODES API — /api/admin/promo-codes
// GET: list all promo codes
// POST: create new code
// PATCH: enable/disable code
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ codes: data });
}

export async function POST(req: NextRequest) {
  const adminId = await isAdmin(req);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { code, discount, label, applies_to, max_uses, expires_at } = await req.json();

  if (!code || discount === undefined) {
    return NextResponse.json({ error: 'Code and discount are required' }, { status: 400 });
  }

  const { data, error } = await supabase.from('promo_codes').insert({
    code: code.toUpperCase().trim(),
    discount: Math.min(1, Math.max(0, parseFloat(discount))),
    label: label || `${Math.round(parseFloat(discount) * 100)}% Off`,
    applies_to: applies_to || ['basic', 'standard', 'premium'],
    max_uses: max_uses || null,
    current_uses: 0,
    expires_at: expires_at || null,
    active: true,
    created_by: adminId,
  }).select().single();

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Code already exists' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // FIXED: Replaced .catch() with a try...catch block
  try {
    await supabase.from('audit_logs').insert({
      user_id: adminId, action: 'promo_code_created', entity_type: 'promo_code',
      entity_id: code.toUpperCase(), details: { discount, label },
    });
  } catch (auditError) {
    // Silently ignore audit log failures so it doesn't break the response
  }

  return NextResponse.json({ success: true, code: data });
}

export async function PATCH(req: NextRequest) {
  const adminId = await isAdmin(req);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { id, active } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { error } = await supabase.from('promo_codes').update({ active }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const adminId = await isAdmin(req);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { error } = await supabase.from('promo_codes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}