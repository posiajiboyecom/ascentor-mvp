// app/api/admin/summit-registrations/route.ts
//   GET   list Summit registrations with a derived payment state.
//         No params            -> everything (used by the registrations page)
//         ?paged=1&q=&type=&state=&page=&pageSize=  -> server-side search/filter/pagination
//                                plus global stats. pageSize=all returns every match (exports).
//   POST  { action: 'verify', id }  ask Paystack about this person's payments and settle
//         { action: 'resend', id }  resend the confirmation email + ticket (paid only)
//         { action: 'remind', id }  email a payment reminder (unpaid only)
//         { action: 'remind_all' }  remind everyone unpaid (skips anyone reminded in 24h)
//   PATCH { id, ticket_type?, notes? }  admin-editable fields only
// All behind admin auth, all writes through the service role.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  createAttempt,
  getSummitPricesNaira,
  settleReference,
} from '@/lib/paymentSettlement';
import { deliverPaidEmails, deliverCompTicket, sendPaymentReminderEmail } from '@/lib/summitEmails';
import { adoptSummitPayments, findCandidateTransactions } from '@/lib/paymentReconciliation';
import { fetchPaystackTransaction } from '@/lib/paymentSettlement';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function requireAdmin(req: NextRequest): Promise<{ id: string } | null> {
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: req.headers.get('authorization') || '' } } },
  );
  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return null;
  const { data } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
  return data?.role === 'admin' ? { id: user.id } : null;
}

const forbidden = () => NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 });

export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) return forbidden();

    const { data, error } = await supabaseAdmin
      .from('summit_registrations')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const regs = data ?? [];
    const unpaidIds = regs.filter(r => r.payment_status !== 'paid').map(r => r.id);

    // Latest checkout attempt per unpaid registration -> abandoned vs in-progress vs never started.
    const attemptsByReg: Record<string, { status: string; count: number; created_at: string; reference: string }> = {};
    if (unpaidIds.length) {
      const { data: attempts } = await supabaseAdmin
        .from('payment_attempts')
        .select('registration_id, status, reference, created_at')
        .eq('kind', 'summit')
        .in('registration_id', unpaidIds)
        .order('created_at', { ascending: false })
        .limit(5000);
      for (const a of attempts ?? []) {
        const cur = attemptsByReg[a.registration_id];
        if (!cur) attemptsByReg[a.registration_id] = { status: a.status, count: 1, created_at: a.created_at, reference: a.reference };
        else cur.count++;
      }
    }

    const registrations = regs.map(r => {
      let payment_state: 'paid' | 'in_progress' | 'abandoned' | 'not_started';
      const a = attemptsByReg[r.id];
      if (r.payment_status === 'paid') payment_state = 'paid';
      else if (!a) payment_state = 'not_started';
      else if (a.status === 'pending' && Date.now() - new Date(a.created_at).getTime() < 60 * 60_000) payment_state = 'in_progress';
      else payment_state = 'abandoned';
      return { ...r, payment_state, attempt_count: a?.count ?? 0 };
    });

    const sp = req.nextUrl.searchParams;
    if (sp.get('paged') !== '1') return NextResponse.json({ registrations });

    // ── Global stats (never affected by search / filters) ───────────────────
    const estFee = (a: number) => (a ? Math.min(a * 0.015 + (a >= 2500 ? 100 : 0), 2000) : 0);
    const paidRows = registrations.filter(r => r.payment_state === 'paid');
    const gross = paidRows.reduce((t, r) => t + (Number(r.amount_paid) || 0), 0);
    const fees = paidRows.reduce((t, r) => t + (r.paystack_fee != null ? Number(r.paystack_fee) : estFee(Number(r.amount_paid) || 0)), 0);
    const count = (st: string) => registrations.filter(r => r.payment_state === st).length;
    const stats = {
      total: registrations.length,
      paid: paidRows.length,
      unpaid: registrations.length - paidRows.length,
      abandoned: count('abandoned'),
      in_progress: count('in_progress'),
      not_started: count('not_started'),
      physicalPaid: paidRows.filter(r => r.attendance_type !== 'virtual').length,
      virtualPaid: paidRows.filter(r => r.attendance_type === 'virtual').length,
      gross, fees, net: gross - fees,
      feesEstimated: paidRows.some(r => r.paystack_fee == null),
      unverified: paidRows.filter(r => !r.payment_provider_tx_id).length,
    };

    // ── Filter ──────────────────────────────────────────────────────────────
    const q = (sp.get('q') ?? '').trim().toLowerCase().slice(0, 80);
    const type = sp.get('type') ?? 'all';
    const state = sp.get('state') ?? 'all';

    const filtered = registrations.filter(r => {
      if (type === 'onsite' && r.attendance_type === 'virtual') return false;
      if (type === 'virtual' && r.attendance_type !== 'virtual') return false;
      if (state === 'paid' && r.payment_state !== 'paid') return false;
      if (state === 'unpaid' && r.payment_state === 'paid') return false;
      if (['abandoned', 'not_started', 'in_progress'].includes(state) && r.payment_state !== state) return false;
      if (!q) return true;
      return [r.full_name, r.email, r.whatsapp, r.organisation, r.location, r.payment_reference]
        .some(v => String(v ?? '').toLowerCase().includes(q));
    });

    const sizeParam = sp.get('pageSize');
    const pageSize = sizeParam === 'all' ? filtered.length || 1 : Math.min(Math.max(Number(sizeParam) || 25, 1), 200);
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const page = Math.min(Math.max(Number(sp.get('page')) || 1, 1), pages);

    return NextResponse.json({
      registrations: filtered.slice((page - 1) * pageSize, page * pageSize),
      total: filtered.length,
      page, pages, pageSize,
      stats,
    });
  } catch (err) {
    console.error('[admin/summit-registrations] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch registrations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) return forbidden();

    const body = await req.json().catch(() => null);
    const id: unknown = body?.id;
    const action: unknown = body?.action;

    if (action === 'remind_all') return await remindAll();

    if (typeof id !== 'string' || (action !== 'verify' && action !== 'resend' && action !== 'remind' && action !== 'comp')) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { data: reg } = await supabaseAdmin.from('summit_registrations').select('*').eq('id', id).maybeSingle();
    if (!reg) return NextResponse.json({ error: 'Registration not found' }, { status: 404 });

    // Admin issues a ticket without going through Paystack (comp seat). Reuses
    // the exact same "paid" state everywhere else in the app (livestream gate,
    // reminders, notify blast) depends on, so nothing else needs to change --
    // amount_paid stays 0, which the UI shows as "Complimentary" rather than
    // an amount, and which never inflates gross/net revenue.
    if (action === 'comp') {
      if (reg.payment_status === 'paid') {
        return NextResponse.json({ error: 'Already paid or already issued a ticket.' }, { status: 409 });
      }
      const nowIso = new Date().toISOString();
      const { data: updated, error } = await supabaseAdmin
        .from('summit_registrations')
        .update({
          payment_status: 'paid',
          status: 'confirmed',
          amount_paid: 0,
          currency: reg.currency || 'NGN',
          paid_at: nowIso,
          confirmed_at: nowIso,
          ticket_type: reg.ticket_type || 'complimentary',
          updated_at: nowIso,
        })
        .eq('id', id)
        .neq('payment_status', 'paid')
        .select('*')
        .maybeSingle();
      if (error || !updated) {
        console.error('[admin/summit-registrations] comp error:', error?.message);
        return NextResponse.json({ error: 'Could not issue ticket.' }, { status: 500 });
      }
      const sent = await deliverCompTicket(updated);
      if (!sent) {
        return NextResponse.json({ error: 'Ticket issued, but the email failed to send. Check SMTP settings and use Resend.' }, { status: 502 });
      }
      return NextResponse.json({ ok: true, message: `Complimentary ticket sent to ${updated.email}` });
    }

    if (action === 'resend') {
      if (reg.payment_status !== 'paid') {
        return NextResponse.json({ error: 'Only paid registrations can be sent a ticket' }, { status: 409 });
      }
      const out = await deliverPaidEmails(
        reg, Number(reg.amount_paid ?? 0), reg.currency ?? 'NGN', reg.payment_reference ?? '', { customer: true },
      );
      if (!out.customer) return NextResponse.json({ error: 'Email failed to send. Check SMTP settings.' }, { status: 502 });
      return NextResponse.json({ ok: true, message: `Ticket sent to ${reg.email}` });
    }

    if (action === 'remind') {
      if (reg.payment_status === 'paid') {
        return NextResponse.json({ error: 'This person has already paid. Use Resend ticket instead.' }, { status: 409 });
      }
      const prices = getSummitPricesNaira();
      if (!prices) return NextResponse.json({ error: 'Ticket prices are not configured' }, { status: 500 });
      try {
        await sendPaymentReminderEmail(
          reg.email, reg.full_name, reg.attendance_type,
          reg.attendance_type === 'virtual' ? prices.virtual : prices.onsite,
        );
      } catch (err) {
        console.error('[admin/summit-registrations] reminder failed:', err);
        return NextResponse.json({ error: 'Reminder email failed to send. Check SMTP settings.' }, { status: 502 });
      }
      await markReminded([reg.id]);
      return NextResponse.json({ ok: true, message: `Payment reminder sent to ${reg.email}` });
    }

    // verify: settle every attempt for this registration against Paystack
    if (reg.payment_status === 'paid') {
      return NextResponse.json({ ok: true, state: 'paid', message: 'Already paid.' });
    }

    // An admin can paste the Paystack reference of a payment we never recorded.
    const pasted = typeof body?.reference === 'string' ? body.reference.trim() : '';
    if (pasted) {
      const outcome = await adoptPastedReference(reg, pasted);
      if (outcome) return NextResponse.json(outcome.body, { status: outcome.status });
    }

    const { data: attempts } = await supabaseAdmin
      .from('payment_attempts')
      .select('reference')
      .eq('registration_id', id)
      .order('created_at', { ascending: false });
    const refs = new Set<string>((attempts ?? []).map((a: { reference: string }) => a.reference));

    // A reference recorded on the registration by the old flow has no attempt row: adopt it.
    if (reg.payment_reference && !refs.has(reg.payment_reference)) {
      const prices = getSummitPricesNaira();
      if (prices) {
        await createAttempt({
          reference: reg.payment_reference,
          kind: 'summit',
          amountKobo: Math.round((reg.attendance_type === 'virtual' ? prices.virtual : prices.onsite) * 100),
          email: reg.email,
          registrationId: reg.id,
        }).catch(() => undefined);
        refs.add(reg.payment_reference);
      }
    }

    let settled = false;
    let lastState = 'no_attempts';
    let lastError: string | null = null;
    let anyRefChecked = false; // true once at least one reference got a real (non-throwing) answer from Paystack
    // A single bad reference (Paystack timeout, transient error) must never abort
    // checking the rest, and must never surface as an opaque "Action failed".
    for (const ref of refs) {
      try {
        const r = await settleReference(ref);
        anyRefChecked = true;
        lastState = r.state === 'rejected' ? `rejected: ${r.reason}` : r.state;
        if (r.state === 'settled') { settled = true; break; }
      } catch (err) {
        lastError = (err as Error).message;
        console.error(`[admin/summit-registrations] settleReference(${ref}) failed:`, err);
      }
    }

    // Nothing settled by reference: look for a successful Paystack payment under
    // this person's email (or a summit-<id>-… reference we lost) and adopt it.
    if (!settled) {
      try {
        if ((await adoptSummitPayments({ registrationId: id })) > 0) settled = true;
      } catch (err) {
        lastError = (err as Error).message;
        console.error('[admin/summit-registrations] adopt failed:', err);
      }
    }

    if (settled) {
      return NextResponse.json({ ok: true, state: 'paid', message: 'Payment found at Paystack. Registration confirmed and ticket emailed.' });
    }

    // Nothing matched automatically. Offer nearby unlinked Paystack transactions
    // so the admin can confirm the right one without leaving this page.
    let candidates: Awaited<ReturnType<typeof findCandidateTransactions>> = [];
    try {
      const prices = getSummitPricesNaira();
      const minKobo = Math.round((reg.attendance_type === 'virtual' ? (prices?.virtual ?? 0) : (prices?.onsite ?? 0)) * 100);
      if (minKobo > 0) candidates = await findCandidateTransactions(minKobo);
    } catch (err) {
      lastError = (err as Error).message;
      console.error('[admin/summit-registrations] candidate lookup failed:', err);
    }

    // There WERE references to check, but every single one of them threw before
    // Paystack could give a real answer (and the candidate lookup found nothing
    // either): say that plainly instead of the misleading "no completed payment".
    if (refs.size > 0 && !anyRefChecked && candidates.length === 0 && lastError) {
      return NextResponse.json({
        ok: false,
        error: `Could not reach Paystack to check this: ${lastError}. This usually means the Paystack key on the server is missing, wrong, or Paystack is unreachable right now. It is not something wrong with this registration.`,
      }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      state: lastState,
      candidates,
      message: candidates.length
        ? `Paystack shows no completed payment for ${reg.email} (${lastState}). ${candidates.length} other recent payment${candidates.length === 1 ? '' : 's'} of at least this amount ${candidates.length === 1 ? 'was' : 'were'} found unlinked to anyone below. Pick theirs if you recognise it.`
        : `Paystack shows no completed payment for ${reg.email} (${lastState}), and no other unlinked payment of this amount was found in the last ${'~300 transactions'}. Paste their Paystack reference above if you have it.${lastError ? ` (One check failed with: ${lastError})` : ''}`,
    });
  } catch (err) {
    console.error('[admin/summit-registrations] POST error:', err);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) return forbidden();
    const body = await req.json().catch(() => null);
    if (typeof body?.id !== 'string') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

    // Deliberately no status / payment fields: those are set only by verified payments.
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('ticket_type' in body) patch.ticket_type = body.ticket_type || null;
    if ('notes' in body) patch.notes = typeof body.notes === 'string' ? body.notes.slice(0, 5000) : null;

    const { error } = await supabaseAdmin.from('summit_registrations').update(patch).eq('id', body.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/summit-registrations] PATCH error:', err);
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Best-effort: silently ignored if reminder_sent_at / reminder_count are not migrated. */
async function markReminded(ids: string[]) {
  if (!ids.length) return;
  try {
    const now = new Date().toISOString();
    for (const id of ids) {
      const { data } = await supabaseAdmin.from('summit_registrations').select('reminder_count').eq('id', id).maybeSingle();
      await supabaseAdmin.from('summit_registrations')
        .update({ reminder_sent_at: now, reminder_count: (Number(data?.reminder_count) || 0) + 1 })
        .eq('id', id);
    }
  } catch { /* tracking is optional */ }
}

/** Reminds everyone who has not paid, skipping anyone reminded in the last 24 hours. */
async function remindAll() {
  const prices = getSummitPricesNaira();
  if (!prices) return NextResponse.json({ error: 'Ticket prices are not configured' }, { status: 500 });

  const { data, error } = await supabaseAdmin
    .from('summit_registrations')
    .select('*')
    .neq('payment_status', 'paid')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: 'Could not load registrations' }, { status: 500 });

  const cutoff = Date.now() - 24 * 3600_000;
  const targets = (data ?? []).filter(r => r.email && !(r.reminder_sent_at && new Date(r.reminder_sent_at).getTime() > cutoff));
  const skipped = (data ?? []).length - targets.length;

  const CAP = 40; // keeps a run inside the function time limit
  const batch = targets.slice(0, CAP);
  const sentIds: string[] = [];
  let failed = 0;
  for (const r of batch) {
    try {
      await sendPaymentReminderEmail(r.email, r.full_name, r.attendance_type, r.attendance_type === 'virtual' ? prices.virtual : prices.onsite);
      sentIds.push(r.id);
    } catch (err) {
      failed++;
      console.error('[admin/summit-registrations] reminder failed for', r.email, (err as Error).message);
    }
  }
  await markReminded(sentIds);

  const left = targets.length - batch.length;
  return NextResponse.json({
    ok: true, sent: sentIds.length, failed, skipped,
    message: `Reminders sent to ${sentIds.length} ${sentIds.length === 1 ? 'person' : 'people'}` +
      (skipped ? `, ${skipped} skipped (reminded in the last 24 hours)` : '') +
      (failed ? `, ${failed} failed` : '') +
      (left > 0 ? `. ${left} more remain, run it again.` : '.'),
  });
}

/**
 * Admin pasted a Paystack reference. Verify it with Paystack, require a successful
 * payment that covers the ticket and is not already used, then settle it.
 * Returns a response to send back, or null to carry on with the normal check.
 */
async function adoptPastedReference(reg: any, reference: string): Promise<{ status: number; body: Record<string, unknown> } | null> {
  const prices = getSummitPricesNaira();
  if (!prices) return { status: 500, body: { error: 'Ticket prices are not configured' } };

  const { data: existing } = await supabaseAdmin.from('payment_attempts').select('registration_id').eq('reference', reference).maybeSingle();
  if (existing && existing.registration_id !== reg.id) {
    return { status: 409, body: { error: 'That reference belongs to a different registration.' } };
  }

  const lookup = await fetchPaystackTransaction(reference);
  if (!lookup.found) return { status: 404, body: { error: 'Paystack has no transaction with that reference.' } };
  if (lookup.tx.status !== 'success') return { status: 409, body: { error: `That payment is "${lookup.tx.status}" at Paystack, not successful.` } };

  const expectedKobo = Math.round((reg.attendance_type === 'virtual' ? prices.virtual : prices.onsite) * 100);
  if (lookup.tx.amount < expectedKobo) {
    return { status: 409, body: { error: `That payment (₦${lookup.tx.amount / 100}) is less than this ticket (₦${expectedKobo / 100}).` } };
  }

  if (!existing) {
    await createAttempt({ reference, kind: 'summit', amountKobo: expectedKobo, email: reg.email, registrationId: reg.id });
  }
  const r = await settleReference(reference);
  if (r.state === 'settled') {
    return { status: 200, body: { ok: true, state: 'paid', message: 'Payment confirmed at Paystack. Registration confirmed and ticket emailed.' } };
  }
  return { status: 409, body: { error: `Could not confirm that payment (${r.state === 'rejected' ? r.reason : r.state}).` } };
}
