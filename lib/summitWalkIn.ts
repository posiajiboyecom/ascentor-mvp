// lib/summitWalkIn.ts
// Server-only. Walk-in self check-in at /walk-in: people who never registered scan the poster at the entrance, give
// their name, email and WhatsApp number, and are checked in on the spot. They land in summit_registrations like everyone
// else (source 'walk_in'), so the admin lists, exports and counts include them. If the email is already registered, it
// checks that existing registration in instead of making a second one.
//
// Open on the Summit day (WAT) by default; an admin can force it open (for testing) or closed in Entrance check-in.

import 'server-only';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { generateCode, normaliseEmail, normalisePhone } from '@/lib/summitReferral';
import { isSummitDayInWat } from '@/lib/summitEventDay';

export type WalkInMode = 'auto' | 'open' | 'closed';

export async function getWalkInMode(): Promise<WalkInMode> {
  const { data } = await supabaseAdmin.from('summit_door_access').select('walkin_mode').eq('id', 1).maybeSingle();
  const m = data?.walkin_mode as string | undefined;
  return m === 'open' || m === 'closed' ? m : 'auto';
}

export async function setWalkInMode(mode: WalkInMode, staffId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('summit_door_access')
    .upsert({ id: 1, walkin_mode: mode, updated_at: new Date().toISOString(), updated_by: staffId }, { onConflict: 'id' });
  if (error) throw new Error('We could not save that. Please try again.');
}

export async function walkInOpen(): Promise<boolean> {
  const mode = await getWalkInMode();
  return mode === 'open' || (mode === 'auto' && isSummitDayInWat());
}

export interface WalkInInput { fullName: string; email: string; whatsapp: string; ipHash?: string | null }
export type WalkInResult =
  | { ok: true; name: string; checkedInAt: string; ref: string; registered: boolean; earlier: boolean }
  | { ok: false; error: string; field?: 'fullName' | 'email' | 'whatsapp' };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SELF = 'Walk-in (self check-in)';

function cleanPhone(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  // Nigerian numbers are usually typed locally ("0803 ..."), so read them as Nigerian unless they start with +.
  const p = parsePhoneNumberFromString(t, 'NG');
  return p && p.isValid() ? p.number : null;
}

const refOf = (id: string) => id.replace(/-/g, '').slice(-5).toUpperCase();

export async function walkIn(input: WalkInInput): Promise<WalkInResult> {
  const fullName = input.fullName.replace(/\s+/g, ' ').trim().slice(0, 120);
  const email = input.email.trim().toLowerCase().slice(0, 200);
  if (fullName.length < 2) return { ok: false, error: 'Enter your full name.', field: 'fullName' };
  if (!EMAIL.test(email)) return { ok: false, error: 'Enter a valid email address.', field: 'email' };
  const whatsapp = cleanPhone(input.whatsapp);
  if (!whatsapp) return { ok: false, error: 'Enter a valid WhatsApp number.', field: 'whatsapp' };

  const now = new Date().toISOString();
  const emailNorm = normaliseEmail(email);

  const findExisting = async () => {
    const byEmail = await supabaseAdmin.from('summit_registrations')
      .select('id, full_name, payment_status, checked_in_at, whatsapp, attendance_type, referral_code').eq('email', email).maybeSingle();
    if (byEmail.data) return byEmail.data;
    const byNorm = await supabaseAdmin.from('summit_registrations')
      .select('id, full_name, payment_status, checked_in_at, whatsapp, attendance_type, referral_code').eq('email_normalised', emailNorm).limit(1).maybeSingle();
    return byNorm.data;
  };

  let existing = await findExisting();

  if (!existing) {
    const { data: created, error } = await supabaseAdmin.from('summit_registrations').insert({
      full_name: fullName,
      email,
      whatsapp,
      // Required by the table; walk-ins aren't asked for these to keep the form to 20 seconds.
      location: '',
      organisation: '',
      current_role: '',
      email_normalised: emailNorm,
      whatsapp_normalised: normalisePhone(whatsapp),
      signup_ip_hash: input.ipHash ?? null,
      attendance_type: 'onsite',
      ticket_type: 'walk_in',
      source: 'walk_in',
      consent: true,
      status: 'confirmed',
      payment_status: 'paid',
      amount_paid: 0,
      currency: 'NGN',
      paid_at: now,
      confirmed_at: now,
      referral_code: generateCode(),
      checked_in_at: now,
      checked_in_by_name: SELF,
      check_in_method: 'walk_in',
    }).select('id, full_name, checked_in_at').single();
    if (created) return { ok: true, name: created.full_name as string, checkedInAt: created.checked_in_at as string, ref: refOf(created.id as string), registered: false, earlier: false };
    // Same email submitted twice at once (unique email): fall through and treat it as existing.
    if (error?.code !== '23505') {
      console.error('[walk-in] insert failed:', error?.message);
      return { ok: false, error: 'We could not check you in. Please try again, or go to the help desk.' };
    }
    existing = await findExisting();
    if (!existing) return { ok: false, error: 'We could not check you in. Please try again, or go to the help desk.' };
  }

  // Already on the list (registered online, or a walk-in who reopened the page).
  const patch: Record<string, unknown> = { updated_at: now };
  if (existing.payment_status !== 'paid') Object.assign(patch, { payment_status: 'paid', status: 'confirmed', amount_paid: 0, currency: 'NGN', paid_at: now, confirmed_at: now, attendance_type: 'onsite', referral_code: existing.referral_code ?? generateCode() });
  if (!existing.whatsapp) Object.assign(patch, { whatsapp, whatsapp_normalised: normalisePhone(whatsapp) });
  if (Object.keys(patch).length > 1) await supabaseAdmin.from('summit_registrations').update(patch).eq('id', existing.id);

  if (existing.checked_in_at) {
    return { ok: true, name: existing.full_name as string, checkedInAt: existing.checked_in_at as string, ref: refOf(existing.id as string), registered: true, earlier: true };
  }
  const { data: won } = await supabaseAdmin.from('summit_registrations')
    .update({ checked_in_at: now, checked_in_by: null, checked_in_by_name: SELF, check_in_method: 'self' })
    .eq('id', existing.id).is('checked_in_at', null).select('checked_in_at');
  const at = (won?.[0]?.checked_in_at as string | undefined) ?? now;
  return { ok: true, name: existing.full_name as string, checkedInAt: at, ref: refOf(existing.id as string), registered: true, earlier: !won?.length };
}
