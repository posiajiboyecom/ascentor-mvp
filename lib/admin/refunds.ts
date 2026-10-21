// lib/admin/refunds.ts
// Server-only. Refunds a successful Paystack transaction through the Paystack refund API with the secret key from the
// environment, then records it. It never charges anything. A refund is only asked for a reference that Paystack itself
// reports as a success transaction and that we recorded as a success.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { fetchPaystackTransaction } from '@/lib/paymentSettlement';

export type RefundResult = { ok: true; status: string } | { ok: false; error: string };

/** True when payment_attempts has the refund columns (migration 20261024p applied). */
export async function refundColumnsReady(): Promise<boolean> {
  const { error } = await supabaseAdmin.from('payment_attempts').select('refunded_at, refund_status').limit(1);
  return !error;
}

export async function refundReference(reference: string): Promise<RefundResult> {
  if (!reference || reference.length > 200) return { ok: false, error: 'This payment has no valid reference.' };
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return { ok: false, error: 'Paystack is not configured on the server.' };

  if (!(await refundColumnsReady())) {
    return { ok: false, error: 'Refunds cannot be recorded yet: the database update (20261024p_refunds_and_flags.sql) has not been applied. Nothing was refunded.' };
  }

  const { data: attempt } = await supabaseAdmin.from('payment_attempts').select('reference, status, refunded_at').eq('reference', reference).maybeSingle();
  if (!attempt) return { ok: false, error: 'We have no checkout record for this payment, so it cannot be refunded here. Use the Paystack dashboard.' };
  if (attempt.refunded_at) return { ok: false, error: 'This payment was already refunded.' };
  if (attempt.status !== 'success') return { ok: false, error: 'Only a successful payment can be refunded.' };

  let lookup;
  try { lookup = await fetchPaystackTransaction(reference); } catch { return { ok: false, error: 'Could not reach Paystack to check this payment. Nothing was refunded.' }; }
  if (!lookup.found || lookup.tx.status !== 'success') return { ok: false, error: 'Paystack does not show this as a successful payment. Nothing was refunded.' };

  let body: any = null;
  try {
    const res = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction: reference }),
    });
    body = await res.json().catch(() => null);
    if (!res.ok || !body?.status) return { ok: false, error: body?.message ? `Paystack said: ${String(body.message).slice(0, 160)}` : 'Paystack did not accept the refund.' };
  } catch {
    return { ok: false, error: 'Could not reach Paystack. Nothing was refunded, please check before trying again.' };
  }

  const refundStatus = String(body?.data?.status ?? 'pending');
  // Conditional update so a double click cannot record it twice.
  await supabaseAdmin.from('payment_attempts')
    .update({ refunded_at: new Date().toISOString(), refund_status: refundStatus })
    .eq('reference', reference).is('refunded_at', null);
  // Subscription payment record (payments.status allows 'refunded').
  await supabaseAdmin.from('payments').update({ status: 'refunded' }).eq('reference', reference).then(undefined, () => undefined);
  return { ok: true, status: refundStatus };
}
