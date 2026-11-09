import { NextRequest, NextResponse } from 'next/server';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { deliverPaidEmails } from '@/lib/summitEmails';
import { ticketView } from '@/lib/summitTicketLookup';
import { attributeReferral, deviceHash, generateCode, ipHash, networkBusy, normaliseEmail, normalisePhone, referralLink } from '@/lib/summitReferral';
import { summitRegisterLimiter, getClientIp } from '@/lib/rate-limit';
import { parseJson, parseQuery } from '@/lib/validation/http';
import * as publicSchemas from '@/lib/validation/schemas/public';

// Registration is free. There is no payment step: submitting this form is
// the whole flow, so every registration is confirmed immediately and the
// ticket is emailed right away (amount_paid = 0, same "paid" status the rest
// of the app already checks for the livestream gate, admin views, etc, so
// nothing else needed to change to support this).
export async function POST(req: NextRequest) {
  // Rate limit: 5 submissions per IP per 10 minutes (in-memory - see
  // lib/rate-limit.ts; resets on restart and is per serverless instance)
  const rateLimit = summitRegisterLimiter.check(getClientIp(req));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
    );
  }

  const parsed = await parseJson(req, publicSchemas.summitRegister);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;
  if (!isValidPhoneNumber(data.whatsapp.trim())) {
    return NextResponse.json({ error: 'A valid WhatsApp number is required.' }, { status: 400 });
  }

  // A durable limit on top of the in-memory one above: it survives restarts and is shared by every server instance.
  const ipH = ipHash(req);
  if (await networkBusy(ipH)) {
    return NextResponse.json({ error: 'Too many registrations from this network. Please wait a while and try again.' }, { status: 429, headers: { 'Retry-After': '600' } });
  }
  const devH = deviceHash(data.device);
  const antiAbuse = { email_normalised: normaliseEmail(data.email), whatsapp_normalised: normalisePhone(data.whatsapp), signup_ip_hash: ipH, signup_device_hash: devH };

  const attendanceType = data.attendance_type === 'virtual' ? 'virtual' : 'onsite';
  const email = data.email.trim().toLowerCase();
  const fullName = data.full_name.trim();
  const nowIso = new Date().toISOString();

  const { data: existing } = await supabaseAdmin
    .from('summit_registrations')
    .select('id, payment_status, referral_code')
    .eq('email', email)
    .maybeSingle();

  if (existing?.payment_status === 'paid') {
    return NextResponse.json({ error: 'Already registered and confirmed' }, { status: 409 });
  }

  let registration: Record<string, any> | null = null;

  if (existing) {
    // A row from before registration was free (they never finished the old
    // payment step), or a genuine resubmit. Refresh their details and
    // confirm them now - registering is the only step there is.
    const { data: updated, error } = await supabaseAdmin
      .from('summit_registrations')
      .update({
        full_name: fullName,
        whatsapp: data.whatsapp.trim(),
        location: data.location.trim(),
        organisation: data.organisation.trim(),
        current_role: data.current_role.trim(),
        other_messages: data.other_messages?.trim() || null,
        consent: true,
        attendance_type: attendanceType,
        ...antiAbuse,
        referral_code: existing.referral_code ?? generateCode(),
        payment_status: 'paid',
        status: 'confirmed',
        amount_paid: 0,
        currency: 'NGN',
        paid_at: nowIso,
        confirmed_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', existing.id)
      .neq('payment_status', 'paid')
      .select('*')
      .maybeSingle();
    if (error || !updated) {
      console.error('[summit/register] DB error:', error?.message);
      return NextResponse.json({ error: 'Registration failed.' }, { status: 500 });
    }
    registration = updated;
  } else {
    const { data: created, error } = await supabaseAdmin
      .from('summit_registrations')
      .insert({
        full_name: fullName,
        email,
        whatsapp: data.whatsapp.trim(),
        location: data.location.trim(),
        organisation: data.organisation.trim(),
        current_role: data.current_role.trim(),
        other_messages: data.other_messages?.trim() || null,
        consent: data.consent === true,
        attendance_type: attendanceType,
        ...antiAbuse,
        referral_code: generateCode(),
        status: 'confirmed',
        payment_status: 'paid',
        amount_paid: 0,
        currency: 'NGN',
        paid_at: nowIso,
        confirmed_at: nowIso,
        source: 'web',
      })
      .select('*')
      .single();
    if (error || !created) {
      console.error('[summit/register] DB error:', error?.message);
      return NextResponse.json({ error: 'Registration failed.' }, { status: 500 });
    }
    registration = created;
  }

  if (!registration) {
    return NextResponse.json({ error: 'Registration failed.' }, { status: 500 });
  }

  // Record who referred this person (never throws, never blocks the registration). It counts straight away unless the fraud checks hold it for review.
  await attributeReferral({ id: registration.id, email, whatsapp: data.whatsapp, signup_ip_hash: ipH, signup_device_hash: devH }, data.ref);

  // Ticket PDF + confirmation email, and the admin new-registration alert.
  // Never throws; delivery failures are tracked on the row, not surfaced
  // here - the registration itself has already succeeded.
  const out = await deliverPaidEmails(registration, 0, 'NGN', '');
  const emailSent = out.customer === true;

  // The visitor gets their ticket on screen straight away, so a failed email never leaves them without one, and the page can say
  // honestly whether the email went out.
  let ticket = null;
  try { ticket = await ticketView({ ...registration, confirmation_email_sent_at: emailSent ? nowIso : null }); } catch (e) { console.error('[summit/register] ticket view failed:', (e as Error).message); }
  return NextResponse.json({ registrationId: registration.id, emailSent, ticket, referralLink: registration.referral_code ? referralLink(registration.referral_code) : null });
}
