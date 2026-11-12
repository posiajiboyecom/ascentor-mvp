// lib/summitCheckin.ts
// Server-only. Elevation Summit entrance check-in, used by the door scanner (/admin/c/checkin).
//
// A ticket QR holds "ELEV2026|<registration id>|<onsite|virtual>|<payment ref>". That is the format on the PDF tickets
// already sent and on the event-day email, so both scan. The registration id is a random UUID, which is what makes a
// ticket hard to fake; the one-time check-in below is what stops a ticket (or a screenshot of it) letting two people in.

import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const TICKET_TAG = 'ELEV2026';

/** What goes inside the QR code for a registration. Keep in step with lib/summitTicket.ts. */
export function ticketPayload(registrationId: string, attendanceType: string | null, reference?: string | null): string {
  return `${TICKET_TAG}|${registrationId}|${attendanceType === 'virtual' ? 'virtual' : 'onsite'}|${reference ?? ''}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The registration id inside a scanned code, or null when it isn't one of our tickets. */
export function registrationIdFromScan(raw: string): string | null {
  const text = String(raw ?? '').trim();
  if (UUID.test(text)) return text.toLowerCase();
  const parts = text.split('|');
  if (parts[0] === TICKET_TAG && parts[1] && UUID.test(parts[1])) return parts[1].toLowerCase();
  return null;
}

export interface Attendee {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  attendance: 'onsite' | 'virtual';
  paid: boolean;
  ticket: string;
  checkedInAt: string | null;
}

export type CheckInResult =
  | { status: 'admitted'; attendee: Attendee }
  | { status: 'already'; attendee: Attendee; checkedInBy: string | null }
  | { status: 'not_paid'; attendee: Attendee }
  | { status: 'not_found' };

const COLS = 'id, full_name, email, whatsapp, attendance_type, payment_status, ticket_type, checked_in_at, checked_in_by, checked_in_by_name';
type Row = { id: string; full_name: string | null; email: string | null; whatsapp: string | null; attendance_type: string | null; payment_status: string | null; ticket_type: string | null; checked_in_at: string | null; checked_in_by: string | null; checked_in_by_name: string | null };

function toAttendee(r: Row): Attendee {
  return {
    id: r.id,
    name: r.full_name?.trim() || 'Guest',
    email: r.email ?? '',
    whatsapp: r.whatsapp ?? '',
    attendance: r.attendance_type === 'virtual' ? 'virtual' : 'onsite',
    paid: r.payment_status === 'paid',
    ticket: r.ticket_type === 'complimentary' ? 'Complimentary' : r.ticket_type === 'walk_in' ? 'Walk-in' : 'Registered',
    checkedInAt: r.checked_in_at,
  };
}

async function admittedBy(r: Row): Promise<string | null> {
  if (r.checked_in_by_name) return r.checked_in_by_name;
  if (!r.checked_in_by) return null;
  const { data } = await supabaseAdmin.from('profiles').select('full_name').eq('id', r.checked_in_by).maybeSingle();
  return (data?.full_name as string | null)?.trim() || null;
}

/** Who is admitting: a staff member (their user id), or a volunteer at /door (no account, just a name). */
export interface Actor { userId: string | null; name: string }

/** Admit one registration. Safe if two scanners read the same ticket at the same moment: only one gets "admitted". */
export async function checkIn(registrationId: string, actor: Actor, method: 'qr' | 'search'): Promise<CheckInResult> {
  const { data: row } = await supabaseAdmin.from('summit_registrations').select(COLS).eq('id', registrationId).maybeSingle<Row>();
  if (!row) return { status: 'not_found' };
  if (row.payment_status !== 'paid') return { status: 'not_paid', attendee: toAttendee(row) };
  if (row.checked_in_at) return { status: 'already', attendee: toAttendee(row), checkedInBy: await admittedBy(row) };

  const { data: won } = await supabaseAdmin.from('summit_registrations')
    .update({ checked_in_at: new Date().toISOString(), checked_in_by: actor.userId, checked_in_by_name: actor.name, check_in_method: method })
    .eq('id', registrationId)
    .is('checked_in_at', null)
    .select(COLS);
  if (won?.length) return { status: 'admitted', attendee: toAttendee(won[0] as Row) };

  // Someone else admitted them a split second earlier.
  const { data: now } = await supabaseAdmin.from('summit_registrations').select(COLS).eq('id', registrationId).maybeSingle<Row>();
  return now ? { status: 'already', attendee: toAttendee(now), checkedInBy: await admittedBy(now) } : { status: 'not_found' };
}

/** Undo a check-in made by mistake. `onlyIfBy` limits it to a check-in that this person made in the last 15 minutes
 *  (volunteers can undo their own slip, not someone else's). Returns false when nothing was undone. */
export async function undoCheckIn(registrationId: string, onlyIfBy?: string): Promise<boolean> {
  let q = supabaseAdmin.from('summit_registrations')
    .update({ checked_in_at: null, checked_in_by: null, checked_in_by_name: null, check_in_method: null })
    .eq('id', registrationId);
  if (onlyIfBy) q = q.eq('checked_in_by_name', onlyIfBy).gte('checked_in_at', new Date(Date.now() - 15 * 60_000).toISOString());
  const { data, error } = await q.select('id');
  return !error && !!data?.length;
}

/** Find people by name, email or phone, for anyone without their QR code. */
export async function searchAttendees(query: string): Promise<Attendee[]> {
  const q = query.trim().replace(/[%,()]/g, ' ').replace(/\s+/g, ' ').slice(0, 80);
  if (q.length < 2) return [];
  const digits = q.replace(/\D/g, '');
  const ors = [`full_name.ilike.%${q}%`, `email.ilike.%${q}%`];
  if (digits.length >= 6) ors.push(`whatsapp_normalised.ilike.%${digits.slice(-10)}%`, `whatsapp.ilike.%${digits.slice(-10)}%`);
  const { data } = await supabaseAdmin.from('summit_registrations').select(COLS).or(ors.join(',')).order('full_name').limit(15);
  return ((data ?? []) as Row[]).map(toAttendee);
}

export interface CheckInStats { checkedIn: number; onsiteExpected: number; walkIns: number }

export async function checkInStats(): Promise<CheckInStats> {
  const [checked, onsite, walk] = await Promise.all([
    supabaseAdmin.from('summit_registrations').select('id', { count: 'exact', head: true }).not('checked_in_at', 'is', null),
    supabaseAdmin.from('summit_registrations').select('id', { count: 'exact', head: true }).eq('payment_status', 'paid').eq('attendance_type', 'onsite'),
    supabaseAdmin.from('summit_registrations').select('id', { count: 'exact', head: true }).eq('check_in_method', 'walk_in'),
  ]);
  return { checkedIn: checked.count ?? 0, onsiteExpected: onsite.count ?? 0, walkIns: walk.count ?? 0 };
}
