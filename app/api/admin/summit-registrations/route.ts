// app/api/admin/summit-registrations/route.ts
//   GET   list Summit registrations with a derived registration state.
//         No params            -> everything (used by the registrations page)
//         ?paged=1&q=&type=&state=&page=&pageSize=  -> server-side search/filter/pagination
//                                plus global stats. pageSize=all returns every match (exports).
//   POST  { action: 'comp', id }     confirm a registration and email the ticket (no checkout)
//         { action: 'resend', id }   resend the confirmation email + ticket (confirmed only)
//         { action: 'remind', id }   nudge someone to finish registering (not yet confirmed)
//         { action: 'remind_all' }   nudge everyone not yet confirmed (skips anyone reminded in 24h)
//   PATCH { id, ticket_type?, notes? }  admin-editable fields only
// All behind admin auth, all writes through the service role.
//
// Registration is free (see /donate for the one remaining paid flow), so this
// route has nothing to do with Paystack: no checkout funnel, no reconciliation,
// no transaction ids. "Confirmed" here just means the admin (or the person)
// completed registration.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { deliverPaidEmails, deliverCompTicket, sendPaymentReminderEmail } from '@/lib/summitEmails';
import { parseJson, parseQuery } from '@/lib/validation/http';
import * as adminSchemas from '@/lib/validation/schemas/admin';

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
    const registrations = regs.map(r => ({ ...r, confirmed: r.payment_status === 'paid' }));

    const sp = req.nextUrl.searchParams;
    if (sp.get('paged') !== '1') return NextResponse.json({ registrations });

    // ── Global stats (never affected by search / filters) ───────────────────
    const confirmedRows = registrations.filter(r => r.confirmed);
    const stats = {
      total: registrations.length,
      confirmed: confirmedRows.length,
      notConfirmed: registrations.length - confirmedRows.length,
      physicalConfirmed: confirmedRows.filter(r => r.attendance_type !== 'virtual').length,
      virtualConfirmed: confirmedRows.filter(r => r.attendance_type === 'virtual').length,
    };

    // ── Filter ──────────────────────────────────────────────────────────────
    const q = (sp.get('q') ?? '').trim().toLowerCase().slice(0, 80);
    const type = sp.get('type') ?? 'all';
    const state = sp.get('state') ?? 'all';

    const filtered = registrations.filter(r => {
      if (type === 'onsite' && r.attendance_type === 'virtual') return false;
      if (type === 'virtual' && r.attendance_type !== 'virtual') return false;
      if (state === 'confirmed' && !r.confirmed) return false;
      if (state === 'not_confirmed' && r.confirmed) return false;
      if (!q) return true;
      return [r.full_name, r.email, r.whatsapp, r.organisation, r.location]
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

    const parsedAction = await parseJson(req, adminSchemas.summitRegistrationAction);
    if (!parsedAction.ok) return parsedAction.response;

    if (parsedAction.data.action === 'remind_all') return await remindAll();
    const id = parsedAction.data.id;
    const action = parsedAction.data.action;

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
        return NextResponse.json({ error: 'This person is already confirmed. Use Resend ticket instead.' }, { status: 409 });
      }
      try {
        await sendPaymentReminderEmail(reg.email, reg.full_name, reg.attendance_type);
      } catch (err) {
        console.error('[admin/summit-registrations] reminder failed:', err);
        return NextResponse.json({ error: 'Reminder email failed to send. Check SMTP settings.' }, { status: 502 });
      }
      await markReminded([reg.id]);
      return NextResponse.json({ ok: true, message: `Reminder sent to ${reg.email}` });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (err) {
    console.error('[admin/summit-registrations] POST error:', err);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) return forbidden();
    const parsedPatch = await parseJson(req, adminSchemas.summitRegistrationPatch);
    if (!parsedPatch.ok) return parsedPatch.response;
    const body = parsedPatch.data;

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

/** Reminds everyone not yet confirmed, skipping anyone reminded in the last 24 hours. */
async function remindAll() {
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
      await sendPaymentReminderEmail(r.email, r.full_name, r.attendance_type);
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

