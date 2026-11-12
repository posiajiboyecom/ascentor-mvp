'use server';

// Volunteer check-in at /door. Every action needs a valid volunteer session (lib/summitDoor.ts), which an admin can end
// for everyone at once by turning volunteer access off or making a new code. Volunteers see masked emails and phones.
import { headers } from 'next/headers';
import { rateLimit } from '@/lib/auth/rate-limit-shared';
import { endDoorSession, maskEmail, maskPhone, requireDoorSession, startDoorSession } from '@/lib/summitDoor';
import { checkIn, checkInStats, registrationIdFromScan, searchAttendees, undoCheckIn, type Attendee, type CheckInStats } from '@/lib/summitCheckin';
import type { ScanResult } from '@/app/admin/c/checkin/actions';

const msg = (e: unknown) => (e instanceof Error && e.message ? e.message : 'That did not work. Please try again.');
const volunteer = (name: string) => `${name} (volunteer)`;

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-vercel-forwarded-for') ?? h.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
}

export async function enterDoorAction(name: string, code: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const limit = await rateLimit(await clientIp(), { scope: 'summit-door', max: 10, windowSeconds: 600 });
    if (!limit.allowed) return { ok: false, error: 'Too many tries. Wait a few minutes and try again.' };
    const err = await startDoorSession(String(name ?? ''), String(code ?? ''));
    return err ? { ok: false, error: err } : { ok: true };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

export async function leaveDoorAction(): Promise<void> { await endDoorSession(); }

const masked = (a: Attendee): Attendee => ({ ...a, email: maskEmail(a.email), whatsapp: maskPhone(a.whatsapp) });
const maskResult = (r: ScanResult): ScanResult => ('attendee' in r ? { ...r, attendee: masked(r.attendee) } : r);

export async function doorScanAction(raw: string): Promise<ScanResult> {
  try {
    const s = await requireDoorSession();
    const id = registrationIdFromScan(String(raw ?? '').slice(0, 300));
    if (!id) return { status: 'not_ticket' };
    return maskResult(await checkIn(id, { userId: null, name: volunteer(s.name) }, 'qr'));
  } catch (e) { return { status: 'error', error: msg(e) }; }
}

export async function doorCheckInByIdAction(id: string): Promise<ScanResult> {
  try {
    const s = await requireDoorSession();
    const clean = registrationIdFromScan(String(id ?? ''));
    if (!clean) return { status: 'not_found' };
    return maskResult(await checkIn(clean, { userId: null, name: volunteer(s.name) }, 'search'));
  } catch (e) { return { status: 'error', error: msg(e) }; }
}

export async function doorUndoAction(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const s = await requireDoorSession();
    const clean = registrationIdFromScan(String(id ?? ''));
    if (!clean) return { ok: false, error: 'Unknown attendee.' };
    const ok = await undoCheckIn(clean, volunteer(s.name));
    return ok ? { ok } : { ok, error: 'You can only undo your own check-ins from the last 15 minutes. Ask the Summit team.' };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

export async function doorSearchAction(query: string): Promise<{ rows: Attendee[]; error?: string }> {
  try {
    await requireDoorSession();
    return { rows: (await searchAttendees(String(query ?? ''))).map(masked) };
  } catch (e) { return { rows: [], error: msg(e) }; }
}

export async function doorStatsAction(): Promise<CheckInStats | null> {
  try { await requireDoorSession(); return await checkInStats(); } catch { return null; }
}
