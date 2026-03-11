// ============================================================
// app/api/partner/revenue/route.ts
// GET: Partner's transaction history + earnings summary
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error } = await authClient.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: partner } = await supabase
      .from('partners').select('id').eq('owner_id', user.id).single();
    if (!partner) return NextResponse.json({ error: 'No partner account' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'month';

    // Build date filter
    const now = new Date();
    let fromDate: Date | null = null;
    if (period === 'month') {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'year') {
      fromDate = new Date(now.getFullYear(), 0, 1);
    }

    // Fetch transactions
    let query = supabase
      .from('partner_transactions')
      .select('*')
      .eq('partner_id', partner.id)
      .order('paid_at', { ascending: false });

    if (fromDate) query = query.gte('paid_at', fromDate.toISOString());

    const { data: transactions } = await query;
    const txs = transactions || [];

    // Build summary
    const total_ngn         = txs.reduce((s, t) => s + Number(t.amount_ngn), 0);
    const partner_total_ngn = txs.reduce((s, t) => s + Number(t.partner_share_ngn), 0);
    const ascentor_total_ngn = txs.reduce((s, t) => s + Number(t.ascentor_fee_ngn), 0);

    // This month vs last month
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const { data: allTx } = await supabase
      .from('partner_transactions')
      .select('partner_share_ngn, paid_at')
      .eq('partner_id', partner.id)
      .gte('paid_at', lastMonthStart.toISOString());

    const allTxs = allTx || [];
    const this_month_ngn = allTxs
      .filter(t => new Date(t.paid_at) >= thisMonthStart)
      .reduce((s, t) => s + Number(t.partner_share_ngn), 0);
    const last_month_ngn = allTxs
      .filter(t => new Date(t.paid_at) < thisMonthStart)
      .reduce((s, t) => s + Number(t.partner_share_ngn), 0);

    return NextResponse.json({
      transactions: txs,
      summary: {
        total_ngn,
        partner_total_ngn,
        ascentor_total_ngn,
        count: txs.length,
        this_month_ngn,
        last_month_ngn,
      },
    });

  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
