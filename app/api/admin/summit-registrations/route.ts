// app/api/admin/summit-registrations/route.ts
//   GET   list all Summit registrations with a derived payment state
//   POST  { action: 'verify', id }  ask Paystack about this person's payments and settle
//         { action: 'resend', id }  resend the confirmation email + ticket (paid only)
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
import { deliverPaidEmails } from '@/lib/summitEmails';

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

    return NextResponse.json({ registrations });
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
    if (typeof id !== 'string' || (action !== 'verify' && action !== 'resend')) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { data: reg } = await supabaseAdmin.from('summit_registrations').select('*').eq('id', id).maybeSingle();
    if (!reg) return NextResponse.json({ error: 'Registration not found' }, { status: 404 });

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

    // verify: settle every attempt for this registration against Paystack
    if (reg.payment_status === 'paid') {
      return NextResponse.json({ ok: true, state: 'paid', message: 'Already paid.' });
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
    for (const ref of refs) {
      const r = await settleReference(ref);
      lastState = r.state === 'rejected' ? `rejected: ${r.reason}` : r.state;
      if (r.state === 'settled') { settled = true; break; }
    }

    return NextResponse.json({
      ok: true,
      state: settled ? 'paid' : lastState,
      message: settled
        ? 'Payment found at Paystack. Registration confirmed and ticket emailed.'
        : refs.size === 0
          ? 'No payment attempt exists for this person: they never reached the payment step.'
          : `Paystack shows no completed payment (${lastState}).`,
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
