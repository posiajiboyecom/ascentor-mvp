// lib/admin/screens/donations.ts
// Spec copied from the admin prototype (Elevation Summit · Donations). The loader below is a placeholder until it reads real data.
// Prototype KPI tiles to compute for real: Gross (sample "₦[TOTAL]"); Fees (sample "₦[TOTAL]"); Net (sample "₦[TOTAL]"); Attempts (sample "[COUNT]")
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { naira, money, count, shortDate } from '@/lib/admin/revenue-util';
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "donations",
  group: "Elevation Summit",
  title: "Donations",
  sub: "Donations through Paystack, with fees and net.",
  cols: [
    "Donor",
    "Amount",
    "Fees",
    "Net",
    "Status",
    "Date"
  ],
  statusCol: 4,
  actions: [],
  buttons: [
    {
      id: "export",
      label: "Export",
      needs: "full"
    }
  ],
  note: "Real totals live in your finance sheet. Your own spending counts as personal support there, not here."
};

const STATUS: Record<string, string> = { paid: 'Paid', abandoned: 'Abandoned', failed: 'Failed', pending: 'Pending' };

const screen: ScreenModule = {
  spec,
  async load() {
    const { data, error } = await supabaseAdmin
      .from('summit_donations')
      .select('id, full_name, amount, currency, paystack_fee, status, paid_at, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    const all = data ?? [];
    const paid = all.filter((d) => d.status === 'paid');
    // Donors abroad give in US dollars. Totals are per currency: naira in the tiles, dollars added beside them when there are any.
    const isUsd = (d: { currency?: string | null }) => (d.currency || 'NGN').toUpperCase() === 'USD';
    const sumOf = (rows: typeof paid, k: 'amount' | 'paystack_fee') => rows.reduce((t, d) => t + (d[k] != null ? Number(d[k]) || 0 : 0), 0);
    const ngn = paid.filter((d) => !isUsd(d));
    const usd = paid.filter(isUsd);
    const gross = sumOf(ngn, 'amount');
    const fees = sumOf(ngn, 'paystack_fee');
    const grossUsd = sumOf(usd, 'amount');
    const feesUsd = sumOf(usd, 'paystack_fee');
    const both = (n: number, u: number) => (usd.length ? `${naira(n)} · ${money(u, 'USD')}` : naira(n));
    return {
      rows: all.slice(0, 200).map((d) => {
        const isPaid = d.status === 'paid';
        const fee = isPaid && d.paystack_fee != null ? Number(d.paystack_fee) : null;
        return {
          id: d.id,
          cells: [
            d.full_name || '-',
            money(d.amount != null ? Number(d.amount) : null, d.currency),
            money(fee, d.currency),
            isPaid && fee != null ? money(Number(d.amount) - fee, d.currency) : '-',
            STATUS[d.status] ?? 'Pending',
            shortDate(d.paid_at || d.created_at),
          ],
        };
      }),
      kpis: [
        { label: 'Gross', value: both(gross, grossUsd) },
        { label: 'Fees', value: both(fees, feesUsd) },
        { label: 'Net', value: both(gross - fees, grossUsd - feesUsd) },
        { label: 'Attempts', value: count(all.length) },
      ],
      note: all.length > 200
        ? 'Showing the 200 newest. Real totals live in your finance sheet. Your own spending counts as personal support there, not here.'
        : undefined,
    };
  },
};

export default screen;
