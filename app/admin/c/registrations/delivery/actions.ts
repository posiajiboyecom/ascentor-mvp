'use server';

// Summit delivery. Sending needs Edit on Registrations, the CSV needs Full; both are checked here, not in the page.
import { revalidatePath } from 'next/cache';
import { staffForAction } from '@/lib/admin/access';
import { auditAdmin } from '@/lib/admin/audit';
import { loadDelivery, resendOneTicket, sendUnsentBatch, type BatchResult, type OneResult } from '@/lib/summitDelivery';
import { deliveryCsv, filterDelivery, type DeliveryFilter } from '@/lib/summitDeliveryCore';

const AREA = 'Registrations';
const msg = (e: unknown) => (e instanceof Error && e.message ? e.message : 'That did not work. Please try again.');

export async function sendBatchAction(excludeIds: string[]): Promise<BatchResult | { error: string }> {
  try {
    const staff = await staffForAction();
    staff.require('registrations', 'edit');
    const ids = Array.isArray(excludeIds) ? excludeIds.map(String).slice(0, 500) : [];
    const r = await sendUnsentBatch(ids);
    if (r.sent) await auditAdmin(staff, `Resent ${r.sent} Summit ticket${r.sent === 1 ? '' : 's'} (batch)`, 'Summit delivery', AREA);
    return r;
  } catch (e) { return { error: msg(e) }; }
}

export async function resendOneAction(id: string): Promise<OneResult> {
  try {
    const staff = await staffForAction();
    staff.require('registrations', 'edit');
    const r = await resendOneTicket(String(id ?? ''));
    if (r.ok) await auditAdmin(staff, 'Resent a Summit ticket', String(id), AREA);
    revalidatePath('/admin/c/registrations/delivery');
    return r;
  } catch (e) { return { ok: false, error: msg(e) }; }
}

export async function exportDeliveryCsv(filter: DeliveryFilter, q: string): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  try {
    const staff = await staffForAction();
    staff.require('registrations', 'full');
    const { rows } = await loadDelivery();
    const f: DeliveryFilter = ['all', 'sent', 'unsent', 'failed'].includes(filter) ? filter : 'all';
    await auditAdmin(staff, 'Exported the Summit delivery list', 'Summit delivery', AREA);
    return { ok: true, csv: deliveryCsv(filterDelivery(rows, f, String(q ?? '').slice(0, 80))) };
  } catch (e) { return { ok: false, error: msg(e) }; }
}
