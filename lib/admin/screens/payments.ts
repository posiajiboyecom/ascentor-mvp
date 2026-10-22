// lib/admin/screens/payments.ts
// Revenue · Payments. Every Paystack charge: payment_attempts (subscriptions, Summit, donations, shop) plus older
// subscription records in payments that have no checkout attempt.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { settleReference } from '@/lib/paymentSettlement';
import { refundReference } from '@/lib/admin/refunds';
import { naira, count, shortDate, lagosMonthStartIso } from '@/lib/admin/revenue-util';
import type { ScreenModule, ScreenSpec, ActionResult } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "payments",
  group: "Revenue",
  title: "Payments",
  sub: "Every Paystack charge: subscriptions, Summit tickets and shop orders.",
  cols: [
    "Reference",
    "Member",
    "Type",
    "Amount",
    "Status",
    "Date"
  ],
  statusCol: 4,
  actions: [
    {
      id: "retry-charge",
      label: "Retry charge",
      col: 4,
      to: "Paid",
      when: "Failed",
      done: "Charge retried and paid."
    },
    {
      id: "refund",
      label: "Refund",
      col: 4,
      to: "Refunded",
      when: "Paid",
      admin: true,
      danger: true,
      confirm: "Refund this payment through Paystack? The member gets an email."
    }
  ],
  quick: 0,
  buttons: [
    { id: "subscriptions", label: "Subscriptions", needs: "view", href: "/admin/c/payments/subscriptions" }
  ]
};

const TYPE: Record<string, string> = { subscription: 'Subscription', summit: 'Summit ticket', donation: 'Donation', shop: 'Shop order' };
const STATUS: Record<string, string> = { success: 'Paid', failed: 'Failed', abandoned: 'Abandoned', pending: 'Pending', duplicate: 'Duplicate' };
const STALE_MS = 60 * 60_000;

type Attempt = { reference: string; kind: string; status: string; user_id: string | null; email: string | null; amount_kobo: number | null; created_at: string; paid_at: string | null; plan_id: string | null; refunded_at?: string | null };

function statusOf(a: Attempt): string {
  if (a.refunded_at) return 'Refunded';
  if (a.status === 'pending' && Date.now() - new Date(a.created_at).getTime() > STALE_MS) return 'Abandoned';
  return STATUS[a.status] ?? 'Pending';
}

async function loadAttempts(): Promise<{ rows: Attempt[]; refundCols: boolean }> {
  const base = 'reference, kind, status, user_id, email, amount_kobo, created_at, paid_at, plan_id';
  const r = await supabaseAdmin.from('payment_attempts').select(`${base}, refunded_at`).order('created_at', { ascending: false }).limit(200);
  if (!r.error) return { rows: (r.data ?? []) as Attempt[], refundCols: true };
  const r2 = await supabaseAdmin.from('payment_attempts').select(base).order('created_at', { ascending: false }).limit(200);
  if (r2.error) throw new Error(r2.error.message);
  return { rows: (r2.data ?? []) as Attempt[], refundCols: false };
}

const screen: ScreenModule = {
  spec,
  async load() {
    const { rows: attempts, refundCols } = await loadAttempts();
    const known = new Set(attempts.map((a) => a.reference));

    // Subscription payments recorded without a checkout attempt (older records).
    const { data: pays } = await supabaseAdmin.from('payments')
      .select('id, reference, user_id, plan_id, amount, amount_cents, status, created_at, paid_at')
      .order('created_at', { ascending: false }).limit(200);
    const orphans = (pays ?? []).filter((p: any) => p.reference && !known.has(p.reference));

    const userIds = Array.from(new Set([...attempts.map((a) => a.user_id), ...orphans.map((p: any) => p.user_id)].filter(Boolean) as string[]));
    const names: Record<string, string> = {};
    if (userIds.length) {
      const { data: profs } = await supabaseAdmin.from('profiles').select('id, full_name, email').in('id', userIds);
      for (const p of profs ?? []) names[p.id] = p.full_name || p.email || '\-';
    }

    type Item = { sort: string; id: string; cells: string[] };
    const items: Item[] = [
      ...attempts.map((a) => ({
        sort: a.created_at,
        id: `a:${a.reference}`,
        cells: [a.reference, (a.user_id && names[a.user_id]) || a.email || '\-', TYPE[a.kind] ?? a.kind, naira(a.amount_kobo != null ? a.amount_kobo / 100 : null), statusOf(a), shortDate(a.paid_at || a.created_at)],
      })),
      ...orphans.map((p: any) => ({
        sort: p.paid_at || p.created_at,
        id: `p:${p.reference}`,
        cells: [p.reference, (p.user_id && names[p.user_id]) || '\-', 'Subscription', naira(p.amount != null ? Number(p.amount) : p.amount_cents != null ? p.amount_cents / 100 : null),
          p.status === 'success' ? 'Paid' : p.status === 'refunded' ? 'Refunded' : p.status === 'failed' ? 'Failed' : 'Pending', shortDate(p.paid_at || p.created_at)],
      })),
    ].sort((a, b) => String(b.sort).localeCompare(String(a.sort)));

    const monthStart = lagosMonthStartIso();
    const [paidA, paidP, failed, abandoned, refundedA, refundedP] = await Promise.all([
      supabaseAdmin.from('payment_attempts').select('reference, amount_kobo, currency').eq('status', 'success').gte('paid_at', monthStart).limit(5000),
      supabaseAdmin.from('payments').select('reference, amount, amount_cents, currency').eq('status', 'success').gte('paid_at', monthStart).limit(5000),
      supabaseAdmin.from('payment_attempts').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      supabaseAdmin.from('payment_attempts').select('*', { count: 'exact', head: true }).eq('status', 'abandoned'),
      refundCols ? supabaseAdmin.from('payment_attempts').select('*', { count: 'exact', head: true }).not('refunded_at', 'is', null) : Promise.resolve({ count: 0 }),
      supabaseAdmin.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'refunded'),
    ]);
    const seen = new Set<string>();
    let total = 0;
    for (const a of paidA.data ?? []) { if ((a.currency || 'NGN') === 'NGN') { seen.add(a.reference); total += Number(a.amount_kobo ?? 0) / 100; } }
    for (const p of paidP.data ?? []) { if ((p.currency || 'NGN') === 'NGN' && !seen.has(p.reference)) total += p.amount != null ? Number(p.amount) : Number(p.amount_cents ?? 0) / 100; }

    return {
      rows: items.slice(0, 200).map(({ id, cells }) => ({ id, cells })),
      kpis: [
        { label: 'Paid this month', value: naira(total) },
        { label: 'Failed', value: count(failed.count ?? 0) },
        { label: 'Abandoned checkouts', value: count(abandoned.count ?? 0) },
        { label: 'Refunds', value: count((refundedA.count ?? 0) + (refundedP.count ?? 0)) },
      ],
      note: 'Showing the 200 newest. Paid this month counts successful naira payments in the current month (Lagos time).',
    };
  },

  async act(_ctx, actionId, rowId): Promise<ActionResult> {
    const reference = rowId.replace(/^[ap]:/, '');
    if (actionId === 'retry-charge') {
      // Re-verifies the reference with Paystack and settles it exactly once if it actually succeeded. It never charges a card.
      const r = await settleReference(reference);
      if (r.state === 'settled') return { ok: true, message: r.alreadySettled ? 'Already paid and settled.' : 'Paystack confirms this payment. It is now settled.' };
      if (r.state === 'rejected') return { ok: false, error: `This payment could not be settled (${r.reason}).` };
      if (r.state === 'notfound') return { ok: false, error: 'Paystack has no record of this checkout, so there is nothing to confirm. The member needs to pay again.' };
      return { ok: false, error: `Paystack says this payment is ${r.providerStatus}. No completed payment found.` };
    }
    if (actionId === 'refund') {
      if (rowId.startsWith('p:')) return { ok: false, error: 'This payment has no checkout record, so it cannot be refunded here. Use the Paystack dashboard.' };
      const r = await refundReference(reference);
      if (!r.ok) return { ok: false, error: r.error };
      return { ok: true, message: 'Refund requested through Paystack.' };
    }
    return { ok: false, error: 'Unknown action.' };
  },

  async badge() {
    const { count: n } = await supabaseAdmin.from('payment_attempts').select('*', { count: 'exact', head: true }).eq('status', 'failed');
    return n ?? 0;
  },
};

export default screen;
