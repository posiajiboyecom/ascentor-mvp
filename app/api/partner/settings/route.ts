// ============================================================
// app/api/partner/revenue/route.ts
//
// FILE LOCATION: app/api/partner/revenue/route.ts
//
// FIX (W-14):
//   The "Month vs Last" summary card always showed last_month_ngn
//   regardless of which period the coach had selected (This Month /
//   This Year / All Time). The fix adds two new fields:
//
//   - last_year_ngn: earnings from the same calendar year as
//     last year (Jan 1 → Dec 31 of previous year). Shown on
//     "This Year" view so the coach can compare YoY.
//
//   - avg_per_month_ngn: average monthly earnings across all
//     transactions. Shown on "All Time" view as a meaningful
//     summary stat instead of a misleading last-month figure.
//
//   The revenue page (see page.tsx fix) reads these fields and
//   switches which stat it shows based on the active period.
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

    const now = new Date();
    let fromDate: Date | null = null;
    if (period === 'month') {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'year') {
      fromDate = new Date(now.getFullYear(), 0, 1);
    }

    // Fetch filtered transactions (for table display)
    let query = supabase
      .from('partner_transactions')
      .select('*')
      .eq('partner_id', partner.id)
      .order('paid_at', { ascending: false });

    if (fromDate) query = query.gte('paid_at', fromDate.toISOString());

    const { data: transactions } = await query;
    const txs = transactions || [];

    const total_ngn          = txs.reduce((s, t) => s + Number(t.amount_ngn), 0);
    const partner_total_ngn  = txs.reduce((s, t) => s + Number(t.partner_share_ngn), 0);
    const ascentor_total_ngn = txs.reduce((s, t) => s + Number(t.ascentor_fee_ngn), 0);

    // ── This month vs last month ──
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const { data: recentTx } = await supabase
      .from('partner_transactions')
      .select('partner_share_ngn, paid_at')
      .eq('partner_id', partner.id)
      .gte('paid_at', lastMonthStart.toISOString());

    const recentTxs = recentTx || [];
    const this_month_ngn = recentTxs
      .filter(t => new Date(t.paid_at) >= thisMonthStart)
      .reduce((s, t) => s + Number(t.partner_share_ngn), 0);
    const last_month_ngn = recentTxs
      .filter(t => new Date(t.paid_at) < thisMonthStart)
      .reduce((s, t) => s + Number(t.partner_share_ngn), 0);

    // FIX W-14: last_year_ngn — same year last year (for YoY on "This Year" view)
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const lastYearEnd   = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
    const { data: lastYearTx } = await supabase
      .from('partner_transactions')
      .select('partner_share_ngn')
      .eq('partner_id', partner.id)
      .gte('paid_at', lastYearStart.toISOString())
      .lte('paid_at', lastYearEnd.toISOString());

    const last_year_ngn = (lastYearTx || []).reduce((s, t) => s + Number(t.partner_share_ngn), 0);

    // FIX W-14: avg_per_month_ngn — for "All Time" view
    // Compute from first transaction date to now
    const { data: allTimeTx } = await supabase
      .from('partner_transactions')
      .select('partner_share_ngn, paid_at')
      .eq('partner_id', partner.id)
      .order('paid_at', { ascending: true })
      .limit(1);

    let avg_per_month_ngn = 0;
    if (allTimeTx && allTimeTx.length > 0) {
      const allTotal = (await supabase
        .from('partner_transactions')
        .select('partner_share_ngn')
        .eq('partner_id', partner.id)).data || [];

      const grandTotal = allTotal.reduce((s, t) => s + Number(t.partner_share_ngn), 0);
      const firstDate  = new Date(allTimeTx[0].paid_at);
      const monthsDiff = Math.max(1,
        (now.getFullYear() - firstDate.getFullYear()) * 12 +
        (now.getMonth() - firstDate.getMonth()) + 1
      );
      avg_per_month_ngn = Math.round(grandTotal / monthsDiff);
    }

    return NextResponse.json({
      transactions: txs,
      summary: {
        total_ngn,
        partner_total_ngn,
        ascentor_total_ngn,
        count: txs.length,
        this_month_ngn,
        last_month_ngn,
        last_year_ngn,       // FIX W-14
        avg_per_month_ngn,   // FIX W-14
      },
    });

  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
