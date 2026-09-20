// /api/admin/payments
//   GET ?list=1            recent checkout attempts (Payments page)
//   GET ?detail=<ref>      one attempt + who it belongs to (off-canvas)
//   GET ?ledger=1          every PAID item that counts toward revenue, so the
//                          dashboard total can be audited line by line
//   GET                    payment health for the admin dashboard
//   POST (no body)         "Reconcile now"
//   POST {action, reference}  'verify' (ask Paystack + settle) | 'resend' (ticket email)
//   DELETE                 remove test data, admin only, audit-logged:
//                          {kind:'attempt', reference} | {kind:'attempts', references[]}
//                          {kind:'summit_registration', id} | {kind:'payment', id}
//                          Attempts that were paid can never be deleted here.
//
// Auth: cookie session + role/permission check (payments.view). Writes need role admin.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { userHasPermission, type Permission, type UserRole } from '@/lib/permissions';
import { reconcilePayments } from '@/lib/paymentReconciliation';
import { getAttemptByReference, settleReference } from '@/lib/paymentSettlement';
import { deliverPaidEmails } from '@/lib/summitEmails';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UNPAID = ['pending', 'abandoned', 'failed'];

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
  return { user, isAdmin: profile!.role === 'admin' };
}

const adminOnly = () => NextResponse.json({ error: 'Only an admin can do this' }, { status: 403 });

async function audit(userId: string, action: string, entityId: string, details: Record<string, unknown>) {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: userId, action, entity_type: 'payments', entity_id: entityId, details,
    });
  } catch { /* non-fatal */ }
}

export async function GET(req: NextRequest) {
  const gate = await requirePaymentsAccess();
  if (gate.error) return gate.error;
  const sp = req.nextUrl.searchParams;

  // ── One attempt, with the person behind it ────────────────────────────────
  const detailRef = sp.get('detail');
  if (detailRef) {
    const { data: attempt } = await supabaseAdmin
      .from('payment_attempts').select('*').eq('reference', detailRef).maybeSingle();
    if (!attempt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let registration = null;
    if (attempt.registration_id) {
      const { data } = await supabaseAdmin
        .from('summit_registrations')
        .select('id, full_name, email, whatsapp, attendance_type, organisation, payment_status, amount_paid, paystack_fee, confirmation_email_sent_at, confirmation_email_error')
        .eq('id', attempt.registration_id).maybeSingle();
      registration = data;
      // Older schema without the tracking columns: retry with the base columns.
      if (!data) {
        const { data: base } = await supabaseAdmin
          .from('summit_registrations')
          .select('id, full_name, email, whatsapp, attendance_type, organisation, payment_status, amount_paid')
          .eq('id', attempt.registration_id).maybeSingle();
        registration = base;
      }
    }
    let profile = null;
    if (attempt.user_id) {
      const { data } = await supabaseAdmin
        .from('profiles').select('full_name, email').eq('id', attempt.user_id).maybeSingle();
      profile = data;
    }
    return NextResponse.json({ attempt, registration, profile });
  }

  // ── Revenue ledger: exactly what feeds the dashboard revenue figure ───────
  if (sp.get('ledger') === '1') {
    const [summit, subs] = await Promise.all([
      supabaseAdmin.from('summit_registrations')
        .select('id, full_name, email, attendance_type, amount_paid, paid_at, payment_reference, payment_provider_tx_id')
        .eq('payment_status', 'paid').order('paid_at', { ascending: false }).limit(500),
      supabaseAdmin.from('payments')
        .select('*')
        .eq('status', 'success').limit(500),
    ]);

    const userIds = Array.from(new Set((subs.data ?? []).map((p: any) => p.user_id).filter(Boolean)));
    const emails: Record<string, string> = {};
    if (userIds.length) {
      const { data: profs } = await supabaseAdmin.from('profiles').select('id, email').in('id', userIds);
      for (const p of profs ?? []) emails[p.id] = p.email;
    }

    const items = [
      ...(summit.data ?? []).map((r: any) => ({
        source: 'summit' as const, id: r.id, name: r.full_name, email: r.email,
        detail: r.attendance_type === 'virtual' ? 'Virtual ticket' : 'Physical ticket',
        amount: Number(r.amount_paid ?? 0), paid_at: r.paid_at,
        reference: r.payment_reference, verified_at_paystack: !!r.payment_provider_tx_id,
      })),
      ...(subs.data ?? []).map((p: any) => ({
        source: 'subscription' as const, id: p.id, name: null, email: emails[p.user_id] ?? null,
        detail: `${p.plan_id ?? 'plan'} subscription`,
        amount: Number(p.amount ?? p.amount_paid ?? p.amount_naira ?? (p.amount_kobo != null ? p.amount_kobo / 100 : 0)) || 0,
        paid_at: p.paid_at ?? p.created_at,
        reference: p.reference, verified_at_paystack: true,
      })),
    ].sort((a, b) => String(b.paid_at ?? '').localeCompare(String(a.paid_at ?? '')));

    return NextResponse.json({ items });
  }

  // ── Attempts list ─────────────────────────────────────────────────────────
  if (sp.get('list') === '1') {
    const status = sp.get('status') ?? 'all';
    const kind = sp.get('kind') ?? 'all';
    const term = (sp.get('q') ?? '').replace(/[%*,()"':]/g, ' ').trim().slice(0, 60);

    let query = supabaseAdmin
      .from('payment_attempts')
      .select('reference, kind, status, email, amount_kobo, currency, created_at, paid_at, abandoned_at, provider_status, failure_reason, recovery_sent_at')
      .order('created_at', { ascending: false })
      .limit(300);
    if (status !== 'all') query = query.eq('status', status);
    if (kind === 'summit' || kind === 'subscription') query = query.eq('kind', kind);
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

  const staleBefore = Date.now() - 60 * 60_000;
  for (const row of data ?? []) {
    // A checkout still "pending" after an hour is not in progress, it is abandoned
    // (the daily sweep just has not formally marked it yet).
    const effective = row.status === 'pending' && new Date(row.created_at).getTime() < staleBefore
      ? 'abandoned'
      : row.status;
    const key = effective as keyof typeof stats;
    const b = stats[key];
    if (b && typeof b === 'object' && 'count' in b) {
      b.count++;
      b.valueKobo += Number(row.amount_kobo ?? 0);
    }
    if (effective === 'abandoned') {
      stats.abandonedByKind[row.kind === 'summit' ? 'summit' : 'subscription']++;
    }
  }

  const startedTerminal = stats.success.count + stats.abandoned.count + stats.failed.count;
  return NextResponse.json({
    ...stats,
    completionRate: startedTerminal ? Math.round((stats.success.count / startedTerminal) * 100) : null,
  });
}

export async function POST(req: NextRequest) {
  const gate = await requirePaymentsAccess();
  if (gate.error) return gate.error;

  const body = await req.json().catch(() => null);

  // Per-attempt actions from the off-canvas
  if (body?.action === 'verify' || body?.action === 'resend') {
    if (!gate.isAdmin) return adminOnly();
    const reference = typeof body.reference === 'string' ? body.reference : '';
    try {
      const attempt = await getAttemptByReference(reference);
      if (!attempt) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

      if (body.action === 'verify') {
        const r = await settleReference(reference);
        const state = r.state === 'rejected' ? `rejected: ${r.reason}` : r.state;
        return NextResponse.json({
          ok: true, state,
          message: r.state === 'settled'
            ? 'Payment confirmed at Paystack. Registration confirmed and ticket emailed.'
            : `Paystack says: ${state}. No completed payment found.`,
        });
      }

      // resend: summit only, paid only
      if (attempt.kind !== 'summit' || !attempt.registration_id) {
        return NextResponse.json({ error: 'Ticket emails only apply to Summit payments' }, { status: 400 });
      }
      const { data: reg } = await supabaseAdmin
        .from('summit_registrations').select('*').eq('id', attempt.registration_id).maybeSingle();
      if (!reg || reg.payment_status !== 'paid') {
        return NextResponse.json({ error: 'This registration is not paid yet. Use Verify first.' }, { status: 409 });
      }
      const out = await deliverPaidEmails(
        reg, Number(reg.amount_paid ?? 0), reg.currency ?? 'NGN', reg.payment_reference ?? reference, { customer: true },
      );
      if (!out.customer) return NextResponse.json({ error: 'Email failed to send. Check the SMTP settings.' }, { status: 502 });
      return NextResponse.json({ ok: true, message: `Confirmation and ticket sent to ${reg.email}` });
    } catch (err) {
      console.error('[admin/payments] action failed:', err);
      return NextResponse.json({ error: 'Action failed' }, { status: 500 });
    }
  }

  try {
    const summary = await reconcilePayments();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error('[admin/payments] reconcile failed:', err);
    return NextResponse.json({ error: 'Reconciliation failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const gate = await requirePaymentsAccess();
  if (gate.error) return gate.error;
  if (!gate.isAdmin) return adminOnly();

  const body = await req.json().catch(() => null);
  const userId = gate.user!.id;

  try {
    // One or many UNPAID attempts (test checkouts, abandoned junk)
    if (body?.kind === 'attempt' || body?.kind === 'attempts') {
      const refs: string[] = body.kind === 'attempt' ? [body.reference] : (body.references ?? []);
      const clean = refs.filter((r): r is string => typeof r === 'string' && r.length > 0 && r.length <= 200).slice(0, 500);
      if (!clean.length) return NextResponse.json({ error: 'Nothing to delete' }, { status: 400 });

      const { data: deleted, error } = await supabaseAdmin
        .from('payment_attempts')
        .delete()
        .in('reference', clean)
        .in('status', UNPAID)        // paid / duplicate attempts are never deletable here
        .select('reference');
      if (error) throw error;
      await audit(userId, 'payment_attempts_deleted', clean[0], { references: deleted?.map(d => d.reference), requested: clean.length });
      return NextResponse.json({ ok: true, deleted: deleted?.length ?? 0, skipped: clean.length - (deleted?.length ?? 0) });
    }

    // A PAID Summit registration (test ticket) - removes it from every total
    if (body?.kind === 'summit_registration' && typeof body.id === 'string') {
      const { data: reg } = await supabaseAdmin
        .from('summit_registrations').select('id, full_name, email, amount_paid, payment_reference').eq('id', body.id).maybeSingle();
      if (!reg) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await supabaseAdmin.from('payment_attempts').delete().eq('registration_id', body.id);
      const { error } = await supabaseAdmin.from('summit_registrations').delete().eq('id', body.id);
      if (error) throw error;
      await audit(userId, 'summit_registration_deleted', body.id, { name: reg.full_name, email: reg.email, amount: reg.amount_paid, reference: reg.payment_reference });
      return NextResponse.json({ ok: true, deleted: 1 });
    }

    // A recorded subscription payment (test). Does not change anyone's access.
    if (body?.kind === 'payment' && typeof body.id === 'string') {
      const { data: pay } = await supabaseAdmin
        .from('payments').select('*').eq('id', body.id).maybeSingle();
      if (!pay) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const { error } = await supabaseAdmin.from('payments').delete().eq('id', body.id);
      if (error) throw error;
      await audit(userId, 'payment_record_deleted', body.id, { reference: pay.reference, amount: pay.amount ?? pay.amount_paid ?? null, user_id: pay.user_id });
      return NextResponse.json({ ok: true, deleted: 1 });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (err) {
    console.error('[admin/payments] delete failed:', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
