// /api/admin/payments
//   GET  -> payment health for the admin dashboard (abandoned / pending / failed)
//   POST -> "Reconcile now": runs the same sweep as the daily cron on demand
//
// Auth: cookie session + role/permission check (payments.view).

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { userHasPermission, type Permission, type UserRole } from '@/lib/permissions';
import { reconcilePayments } from '@/lib/paymentReconciliation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function requirePaymentsAccess() {
  const auth = await createAuthClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, permissions')
    .eq('id', user.id)
    .single();

  const allowed = !!profile && userHasPermission(
    profile.role as UserRole,
    profile.permissions as Permission[] | null,
    'payments.view',
  );
  if (!allowed) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user };
}

export async function GET(req: NextRequest) {
  const gate = await requirePaymentsAccess();
  if (gate.error) return gate.error;

  // ?list=1 -> recent checkout attempts for the Payments page
  if (req.nextUrl.searchParams.get('list') === '1') {
    const status = req.nextUrl.searchParams.get('status') ?? 'all';
    const term = (req.nextUrl.searchParams.get('q') ?? '').replace(/[%*,()"':]/g, ' ').trim().slice(0, 60);

    let query = supabaseAdmin
      .from('payment_attempts')
      .select('reference, kind, status, email, amount_kobo, currency, created_at, paid_at, abandoned_at, provider_status, failure_reason, recovery_sent_at')
      .order('created_at', { ascending: false })
      .limit(300);
    if (status !== 'all') query = query.eq('status', status);
    if (term) query = query.or(`email.ilike.%${term}%,reference.ilike.%${term}%`);

    const { data, error } = await query;
    if (error) {
      console.error('[admin/payments] list failed:', error.message);
      return NextResponse.json({ error: 'Could not load payments' }, { status: 500 });
    }
    return NextResponse.json({ attempts: data ?? [] });
  }

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('payment_attempts')
    .select('status, kind, amount_kobo, created_at')
    .gte('created_at', since)
    .limit(5000);

  if (error) {
    console.error('[admin/payments] query failed:', error.message);
    return NextResponse.json({ error: 'Could not load payment data' }, { status: 500 });
  }

  const bucket = () => ({ count: 0, valueKobo: 0 });
  const stats = {
    windowDays: 30,
    abandoned:  bucket(),
    pending:    bucket(),
    failed:     bucket(),
    success:    bucket(),
    duplicate:  bucket(),
    abandonedByKind: { summit: 0, subscription: 0 },
  };

  for (const row of data ?? []) {
    const key = row.status as keyof typeof stats;
    const b = stats[key];
    if (b && typeof b === 'object' && 'count' in b) {
      b.count++;
      b.valueKobo += Number(row.amount_kobo ?? 0);
    }
    if (row.status === 'abandoned') {
      stats.abandonedByKind[row.kind === 'summit' ? 'summit' : 'subscription']++;
    }
  }

  const startedTerminal = stats.success.count + stats.abandoned.count + stats.failed.count;
  return NextResponse.json({
    ...stats,
    completionRate: startedTerminal ? Math.round((stats.success.count / startedTerminal) * 100) : null,
  });
}

export async function POST() {
  const gate = await requirePaymentsAccess();
  if (gate.error) return gate.error;

  try {
    const summary = await reconcilePayments();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error('[admin/payments] reconcile failed:', err);
    return NextResponse.json({ error: 'Reconciliation failed' }, { status: 500 });
  }
}
