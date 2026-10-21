'use server';

import { revalidatePath } from 'next/cache';
import { staffForAction } from '@/lib/admin/access';
import { auditAdmin } from '@/lib/admin/audit';
import {
  askFacilitatorToCheckIn, createInterestGroup, findRec, loadRecState, MIGRATION_MESSAGE, openCityGroup,
  recordState, resetRecommendationBadge, computeRecommendations,
} from '@/lib/admin/recommendations';

export interface RecResult { ok: boolean; message?: string; error?: string; download?: { filename: string; mime: string; content: string } }
const AREA = 'Recommendations';
const fail = (e: unknown): RecResult => ({ ok: false, error: e instanceof Error && e.message ? e.message : 'That did not work. Please try again.' });

/** Create / Open city group / Ask the facilitator. Links are plain navigation in the browser and never reach here. */
export async function actOnRec(id: string): Promise<RecResult> {
  try {
    const staff = await staffForAction();
    staff.require('recs', 'edit');
    const st = await loadRecState();
    if (!st.available) return { ok: false, error: MIGRATION_MESSAGE };
    if (st.state[id]) return { ok: false, error: 'That one has already been dealt with.' };
    const rec = await findRec(id);
    if (!rec) return { ok: false, error: 'This recommendation is no longer current. Refresh the page.' };
    if (!rec.subject) return { ok: false, error: 'This one opens an editor instead.' };
    if (rec.act === 'create-group') await createInterestGroup(staff.userId, rec.subject);
    else if (rec.act === 'open-city') await openCityGroup(rec.subject);
    else if (rec.act === 'ask-checkin') await askFacilitatorToCheckIn(rec.subject);
    else return { ok: false, error: 'This one opens an editor instead.' };
    await recordState(id, 'created', staff.userId);
    await auditAdmin(staff, rec.cta, rec.title, AREA);
    resetRecommendationBadge();
    revalidatePath('/admin/c/recs');
    return { ok: true, message: rec.act === 'ask-checkin' ? 'Message sent to the facilitator.' : rec.act === 'open-city' ? 'Created on City groups.' : 'Created on Groups.' };
  } catch (e) { return fail(e); }
}

export async function decideRec(id: string, to: 'dismissed' | 'open'): Promise<RecResult> {
  try {
    const staff = await staffForAction();
    staff.require('recs', 'edit');
    const rec = (await computeRecommendations()).find((r) => r.id === id);
    await recordState(id, to, staff.userId);
    await auditAdmin(staff, to === 'dismissed' ? 'Dismissed recommendation' : 'Restored recommendation', rec?.title ?? id, AREA);
    resetRecommendationBadge();
    revalidatePath('/admin/c/recs');
    return { ok: true };
  } catch (e) { return fail(e); }
}

const cell = (v: string) => `"${String(v ?? '').replace(/"/g, '""').replace(/^([=+\-@\t\r])/, "'$1")}"`;

export async function exportRecs(): Promise<RecResult> {
  try {
    const staff = await staffForAction();
    staff.require('recs', 'full');
    const [recs, st] = await Promise.all([computeRecommendations(), loadRecState()]);
    const rows = recs.map((r) => [r.type, r.title, r.conf, r.why, r.evidence, r.serves, st.state[r.id] ?? 'open']);
    const csv = [['Type', 'Recommendation', 'Confidence', 'Why', 'Evidence', 'Serves', 'State'].map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))].join('\n');
    await auditAdmin(staff, 'Exported (CSV)', 'recommendations', 'Exports');
    return { ok: true, message: `Exported ${rows.length} recommendations.`, download: { filename: 'recommendations.csv', mime: 'text/csv;charset=utf-8', content: csv } };
  } catch (e) { return fail(e); }
}
