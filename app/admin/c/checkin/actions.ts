'use server';

// Entrance check-in. Admitting someone needs Edit on "Entrance check-in"; the check runs here, not in the page.
import { staffForAction } from '@/lib/admin/access';
import { auditAdmin } from '@/lib/admin/audit';
import { checkIn, checkInStats, registrationIdFromScan, searchAttendees, undoCheckIn, type Attendee, type CheckInResult, type CheckInStats } from '@/lib/summitCheckin';

const AREA = 'Entrance check-in';
const msg = (e: unknown) => (e instanceof Error && e.message ? e.message : 'That did not work. Please try again.');

export type ScanResult = CheckInResult | { status: 'not_ticket' } | { status: 'error'; error: string };

/** A code read by the camera. */
export async function scanTicketAction(raw: string): Promise<ScanResult> {
  try {
    const staff = await staffForAction();
    staff.require('checkin', 'edit');
    const id = registrationIdFromScan(String(raw ?? '').slice(0, 300));
    if (!id) return { status: 'not_ticket' };
    const r = await checkIn(id, staff.userId, 'qr');
    if (r.status === 'admitted') void auditAdmin(staff, 'Checked in (QR)', r.attendee.name, AREA);
    return r;
  } catch (e) { return { status: 'error', error: msg(e) }; }
}

/** Someone found by name, email or phone. */
export async function checkInByIdAction(id: string): Promise<ScanResult> {
  try {
    const staff = await staffForAction();
    staff.require('checkin', 'edit');
    const clean = registrationIdFromScan(String(id ?? ''));
    if (!clean) return { status: 'not_found' };
    const r = await checkIn(clean, staff.userId, 'search');
    if (r.status === 'admitted') void auditAdmin(staff, 'Checked in (search)', r.attendee.name, AREA);
    return r;
  } catch (e) { return { status: 'error', error: msg(e) }; }
}

export async function undoCheckInAction(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await staffForAction();
    staff.require('checkin', 'edit');
    const clean = registrationIdFromScan(String(id ?? ''));
    if (!clean) return { ok: false, error: 'Unknown attendee.' };
    const ok = await undoCheckIn(clean);
    if (ok) void auditAdmin(staff, 'Undid a check-in', clean, AREA);
    return ok ? { ok } : { ok, error: 'We could not undo that. Try again.' };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

export async function searchAction(query: string): Promise<{ rows: Attendee[]; error?: string }> {
  try {
    const staff = await staffForAction();
    staff.require('checkin', 'view');
    return { rows: await searchAttendees(String(query ?? '')) };
  } catch (e) { return { rows: [], error: msg(e) }; }
}

export async function statsAction(): Promise<CheckInStats | null> {
  try {
    const staff = await staffForAction();
    staff.require('checkin', 'view');
    return await checkInStats();
  } catch { return null; }
}
