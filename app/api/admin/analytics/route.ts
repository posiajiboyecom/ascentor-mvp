// GET /api/admin/analytics
// Aggregates for the admin overview charts. Computed server-side in one
// request (the previous dashboard fired ~11 browser-side count queries).
// Revenue figures are only returned to callers holding payments.view.

import { NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { userHasPermission, type Permission, type UserRole } from '@/lib/permissions';
import { getPlanPricingMap } from '@/lib/plans-config';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const DAY = 86_400_000;
const DAYS = 30;

const dayKey = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '');

export async function GET() {
  const auth = await createAuthClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: me } = await supabaseAdmin
    .from('profiles').select('role, permissions').eq('id', user.id).single();
  const can = (p: Permission) =>
    !!me && userHasPermission(me.role as UserRole, me.permissions as Permission[] | null, p);

  if (!me || !['admin', 'moderator'].includes(me.role) || !can('admin.view_stats')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const canRevenue = can('payments.view');

  const now = Date.now();
  const since = new Date(now - DAYS * DAY).toISOString();
  const d7 = now - 7 * DAY;

  const [
    totalUsers, signups, sessions, activeProfiles, subPayments, summitPaid, attempts,
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('profiles').select('created_at').gte('created_at', since).limit(10000),
    supabaseAdmin.from('coaching_sessions').select('created_at').gte('created_at', since).limit(20000),
    supabaseAdmin.from('profiles')
      .select('subscription_plan, billing_cycle, payment_method, subscription_end')
      .in('subscription_status', ['active', 'trialing']).limit(20000),
    canRevenue
      ? supabaseAdmin.from('payments').select('*').eq('status', 'success').limit(10000)
      : Promise.resolve({ data: [] as any[] }),
    canRevenue
      ? supabaseAdmin.from('summit_registrations').select('amount_paid, paid_at').eq('payment_status', 'paid').gte('paid_at', since).limit(10000)
      : Promise.resolve({ data: [] as any[] }),
    canRevenue
      ? supabaseAdmin.from('payment_attempts').select('status, kind, amount_kobo').gte('created_at', since).limit(20000)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  // ── 30-day series ─────────────────────────────────────────────────────────
  const series: Record<string, { date: string; signups: number; sessions: number; subscriptions: number; summit: number }> = {};
  for (let i = DAYS - 1; i >= 0; i--) {
    const date = new Date(now - i * DAY).toISOString().slice(0, 10);
    series[date] = { date, signups: 0, sessions: 0, subscriptions: 0, summit: 0 };
  }
  for (const r of signups.data ?? [])  { const s = series[dayKey(r.created_at)]; if (s) s.signups++; }
  for (const r of sessions.data ?? []) { const s = series[dayKey(r.created_at)]; if (s) s.sessions++; }
  // The live payments table's amount column has varied; accept any known name.
  const payAmount = (r: any) => Number(r.amount ?? r.amount_paid ?? r.amount_naira ?? (r.amount_kobo != null ? r.amount_kobo / 100 : 0)) || 0;
  for (const r of subPayments.data ?? []) {
    const when = r.paid_at ?? r.created_at;
    if (!when || new Date(when).toISOString() < since) continue;
    const s = series[dayKey(when)]; if (s) s.subscriptions += payAmount(r);
  }
  for (const r of summitPaid.data ?? [])  { const s = series[dayKey(r.paid_at)]; if (s) s.summit += Number(r.amount_paid ?? 0); }

  // ── Subscribers, plan mix, MRR ────────────────────────────────────────────
  const planCounts: Record<string, number> = {};
  let mrr = 0;
  let activeSubs = 0;
  for (const p of activeProfiles.data ?? []) {
    if (p.subscription_end && new Date(p.subscription_end).getTime() < now) continue; // lapsed
    activeSubs++;
    const plan = String(p.subscription_plan ?? 'free');
    planCounts[plan] = (planCounts[plan] ?? 0) + 1;

    // Admin-granted and promo access is not recurring revenue.
    if (p.billing_cycle === 'manual' || p.payment_method === 'promo') continue;
    const pricing = getPlanPricingMap()[plan];
    if (!pricing) continue;
    mrr += p.billing_cycle === 'annual' ? pricing.yearlyPrice / 12 : pricing.monthlyPrice;
  }

  // ── Checkout funnel ───────────────────────────────────────────────────────
  const funnel = { started: 0, completed: 0, abandoned: 0, pending: 0, failed: 0, duplicate: 0, abandonedValue: 0 };
  for (const a of attempts.data ?? []) {
    funnel.started++;
    if (a.status === 'success')        funnel.completed++;
    else if (a.status === 'abandoned') { funnel.abandoned++; funnel.abandonedValue += Number(a.amount_kobo ?? 0) / 100; }
    else if (a.status === 'pending')   funnel.pending++;
    else if (a.status === 'failed')    funnel.failed++;
    else if (a.status === 'duplicate') funnel.duplicate++;
  }

  const days = Object.values(series);
  const sum = (k: 'subscriptions' | 'summit') => days.reduce((t, d) => t + d[k], 0);
  const settled = funnel.completed + funnel.abandoned + funnel.failed;

  return NextResponse.json({
    canRevenue,
    generatedAt: new Date(now).toISOString(),
    kpis: {
      totalUsers:     totalUsers.count ?? 0,
      newUsers7d:     (signups.data ?? []).filter(r => new Date(r.created_at).getTime() >= d7).length,
      newUsers30d:    (signups.data ?? []).length,
      sessions7d:     (sessions.data ?? []).filter(r => new Date(r.created_at).getTime() >= d7).length,
      sessions30d:    (sessions.data ?? []).length,
      activeSubs,
      mrr:            canRevenue ? Math.round(mrr) : null,
      revenue30d:     canRevenue ? Math.round(sum('subscriptions') + sum('summit')) : null,
      revenueSummit30d:       canRevenue ? Math.round(sum('summit')) : null,
      revenueSubscription30d: canRevenue ? Math.round(sum('subscriptions')) : null,
      summitPaidCount:        canRevenue ? (summitPaid.data ?? []).length : null,
      completionRate: canRevenue && settled ? Math.round((funnel.completed / settled) * 100) : null,
    },
    series: days.map(d => ({
      ...d,
      subscriptions: canRevenue ? Math.round(d.subscriptions) : 0,
      summit:        canRevenue ? Math.round(d.summit) : 0,
    })),
    plans: Object.entries(planCounts).map(([plan, count]) => ({ plan, count })).sort((a, b) => b.count - a.count),
    funnel: canRevenue ? funnel : null,
  });
}
