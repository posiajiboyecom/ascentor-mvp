// /api/admin/shop/leads: free-item sign-ups. ?format=csv downloads them.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit-log';
import { shopAdmin, forbidden, migrationMissing, MIGRATION_NOTICE } from '../_auth';

// Quote every cell and neutralise spreadsheet formulas.
const cell = (v: unknown) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET(req: NextRequest) {
  const admin = await shopAdmin();
  if (!admin) return forbidden();

  const { data, error } = await supabaseAdmin
    .from('shop_leads')
    .select('id, email, full_name, created_at, product:products(name)')
    .order('created_at', { ascending: false })
    .limit(10000);
  if (error) {
    if (migrationMissing(error)) return NextResponse.json({ leads: [], migrationNeeded: true, notice: MIGRATION_NOTICE });
    console.error('[shop leads GET]', error);
    return NextResponse.json({ error: 'Failed to load leads' }, { status: 500 });
  }

  const leads = (data || []).map((l: any) => ({
    id: l.id, email: l.email, full_name: l.full_name, created_at: l.created_at,
    item: (Array.isArray(l.product) ? l.product[0]?.name : l.product?.name) || '',
  }));

  if (req.nextUrl.searchParams.get('format') === 'csv') {
    const csv = ['Name,Email,Item,Date', ...leads.map(l => [l.full_name, l.email, l.item, l.created_at].map(cell).join(','))].join('\n');
    await logAudit(supabaseAdmin, { userId: admin.id, action: 'data_exported', entityType: 'shop_leads', details: { count: leads.length } });
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="shop-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }
  return NextResponse.json({ leads });
}
