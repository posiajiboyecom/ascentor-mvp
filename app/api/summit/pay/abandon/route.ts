import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAttemptByReference, settleReference } from '@/lib/paymentSettlement';
import { sendAdminAbandonedNotification } from '@/lib/summitEmails';
import { paymentLimiter, getClientIp } from '@/lib/rate-limit';

// Called by the browser the moment the payment window / confirm overlay is
// closed or the tab is left, so the admin hears about it immediately instead
// of waiting for the daily sweep. Never trusts the browser:
//   * the reference must be a Summit attempt issued for that registration
//   * Paystack is asked first; if the customer actually paid, nothing is sent
//   * at most one alert per attempt (admin_notified_at is claimed atomically)
//   * at most one alert per registration per 30 minutes
// The daily reconciliation remains the backstop for tabs that die silently.
export async function POST(req: NextRequest) {
  const limit = paymentLimiter.check(getClientIp(req));
  if (!limit.allowed) return NextResponse.json({ ok: true });

  try {
    const body = await req.json().catch(() => null);
    const reference      = body?.reference;
    const registrationId = body?.registrationId;
    if (typeof reference !== 'string' || typeof registrationId !== 'string') {
      return NextResponse.json({ ok: true });
    }

    const attempt = await getAttemptByReference(reference);
    if (!attempt || attempt.kind !== 'summit' || attempt.registration_id !== registrationId) {
      return NextResponse.json({ ok: true });
    }
    if (attempt.status === 'success' || attempt.status === 'duplicate' || attempt.admin_notified_at) {
      return NextResponse.json({ ok: true });
    }

    // If they paid (callback slow, closed tab right after paying), settle instead of alerting.
    const result = await settleReference(reference);
    if (result.state === 'settled') return NextResponse.json({ ok: true });

    const { data: reg } = await supabaseAdmin
      .from('summit_registrations')
      .select('full_name, email, whatsapp, attendance_type, payment_status')
      .eq('id', registrationId)
      .maybeSingle();
    if (!reg || reg.payment_status === 'paid') return NextResponse.json({ ok: true });

    // One alert per registration per 30 minutes (retries create new attempts).
    const since = new Date(Date.now() - 30 * 60_000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from('payment_attempts')
      .select('id')
      .eq('registration_id', registrationId)
      .gte('admin_notified_at', since)
      .limit(1);
    if (recent?.length) {
      await supabaseAdmin.from('payment_attempts')
        .update({ admin_notified_at: new Date().toISOString() })
        .eq('reference', reference).is('admin_notified_at', null);
      return NextResponse.json({ ok: true });
    }

    // Claim the alert atomically so concurrent calls (close + pagehide) send once.
    const nowIso = new Date().toISOString();
    const { data: claimed } = await supabaseAdmin
      .from('payment_attempts')
      .update({ admin_notified_at: nowIso })
      .eq('reference', reference)
      .is('admin_notified_at', null)
      .select('id');
    if (!claimed?.length) return NextResponse.json({ ok: true });

    try {
      await sendAdminAbandonedNotification({
        fullName: reg.full_name,
        email: reg.email,
        phone: reg.whatsapp ?? '',
        attendanceType: reg.attendance_type,
        amount: (attempt.amount_kobo ?? 0) / 100,
        reference,
      });
    } catch (err) {
      // Release the claim so the daily sweep still tells the admin.
      console.error('[summit/pay/abandon] admin email failed:', err);
      await supabaseAdmin.from('payment_attempts')
        .update({ admin_notified_at: null }).eq('reference', reference);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[summit/pay/abandon] error:', err);
    return NextResponse.json({ ok: true });
  }
}
