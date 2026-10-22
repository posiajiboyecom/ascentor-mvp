'use server';

// Subscription admin actions. The level check runs here, never only in the page. Nothing here charges a card unless
// BILLING_V2_CHARGING=live, and then only through the engine's own member-safe path.
import { revalidatePath } from 'next/cache';
import { staffForAction } from '@/lib/admin/access';
import { auditAdmin } from '@/lib/admin/audit';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cancel, getSubscription, syncProfile } from '@/lib/billing/subscriptions';
import { chargeSubscriptionNow, chargingMode } from '@/lib/billing/engine';
import { logBillingEvent } from '@/lib/billing/events';
import { canRetryCharge, extendedDate } from '@/lib/admin/billing-admin';
import { loadSubscriptionEvents, type EventLine } from '@/lib/admin/billing-admin-data';

const AREA = 'Payments';
type Res = { ok: boolean; message?: string; error?: string };
const msg = (e: unknown) => (e instanceof Error && e.message ? e.message : 'That did not work. Please try again.');
const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

async function label(userId: string): Promise<string> {
  const { data } = await supabaseAdmin.from('profiles').select('full_name, email').eq('id', userId).maybeSingle();
  return ((data?.full_name as string | null) || (data?.email as string | null) || userId).trim();
}

export async function subscriptionEvents(userId: string): Promise<EventLine[]> {
  try {
    const staff = await staffForAction();
    staff.require('payments', 'view');
    if (!isId(userId)) return [];
    return await loadSubscriptionEvents(userId);
  } catch { return []; }
}

export async function retryChargeNow(userId: string): Promise<Res> {
  try {
    const staff = await staffForAction();
    staff.require('payments', 'edit');
    if (!isId(userId)) return { ok: false, error: 'Unknown member.' };
    const mode = chargingMode();
    if (mode !== 'live') return { ok: false, error: 'Charging is off, so nothing was charged.' };
    const sub = await getSubscription(userId);
    if (!sub) return { ok: false, error: 'That member has no subscription.' };
    if (!canRetryCharge(mode, sub.state)) return { ok: false, error: 'Only a failed renewal (Grace) can be retried.' };
    await logBillingEvent(userId, 'charge_retry', { by: 'admin' });
    const r = await chargeSubscriptionNow(userId);
    await auditAdmin(staff, r.ok ? 'Retried a subscription charge' : 'Tried to retry a subscription charge', await label(userId), AREA);
    revalidatePath('/admin/c/payments/subscriptions');
    return r.ok ? { ok: true, message: 'Charge retried.' } : { ok: false, error: r.error };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

export async function cancelSubscriptionAdmin(userId: string): Promise<Res> {
  try {
    const staff = await staffForAction();
    staff.require('payments', 'edit');
    if (!isId(userId)) return { ok: false, error: 'Unknown member.' };
    const r = await cancel(userId);
    if (!r.ok) return { ok: false, error: r.error };
    await auditAdmin(staff, 'Cancelled a subscription', await label(userId), AREA);
    revalidatePath('/admin/c/payments/subscriptions');
    return { ok: true, message: r.state === 'active' ? 'Cancelled. They keep access until the end of the period they paid for.' : 'Subscription cancelled.' };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

export async function extendTrial(userId: string): Promise<Res> {
  try {
    const staff = await staffForAction();
    staff.require('payments', 'full');
    if (!isId(userId)) return { ok: false, error: 'Unknown member.' };
    const sub = await getSubscription(userId);
    if (!sub) return { ok: false, error: 'That member has no subscription.' };
    if (sub.state !== 'trial') return { ok: false, error: 'Only a trial can be extended.' };
    const trialEnd = extendedDate(sub.trialEndsAt, 7);
    const nextCharge = extendedDate(sub.nextChargeAt ?? sub.trialEndsAt, 7);
    if (!trialEnd || !nextCharge) return { ok: false, error: 'This trial has no end date to extend.' };
    const stamp = new Date().toISOString();
    const { error } = await supabaseAdmin.from('member_subscriptions')
      .update({ trial_ends_at: trialEnd.toISOString(), next_charge_at: nextCharge.toISOString(), updated_at: stamp })
      .eq('user_id', userId).eq('state', 'trial');
    if (error) return { ok: false, error: 'We could not extend the trial. Please try again.' };
    await logBillingEvent(userId, 'trial_extended' as never, { days: 7, by: 'admin', trial_ends_at: trialEnd.toISOString(), next_charge_at: nextCharge.toISOString() });
    await syncProfile(userId);
    await auditAdmin(staff, 'Extended a trial by 7 days', await label(userId), AREA);
    revalidatePath('/admin/c/payments/subscriptions');
    return { ok: true, message: 'Trial extended by 7 days.' };
  } catch (e) { return { ok: false, error: msg(e) }; }
}
