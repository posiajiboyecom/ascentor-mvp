import { NextRequest, NextResponse } from 'next/server';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendRegistrationReceivedEmail } from '@/lib/summitEmails';
import { summitRegisterLimiter, getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  // Rate limit: 5 submissions per IP per 10 minutes (in-memory — see
  // lib/rate-limit.ts; resets on restart and is per serverless instance)
  const rateLimit = summitRegisterLimiter.check(getClientIp(req));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
    );
  }

  let data;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!data.full_name || typeof data.full_name !== 'string' || !data.full_name.trim()) {
    return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
  }
  if (!data.email || typeof data.email !== 'string' || !data.email.includes('@')) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }
  if (!data.whatsapp || typeof data.whatsapp !== 'string' || !isValidPhoneNumber(data.whatsapp.trim())) {
    return NextResponse.json({ error: 'A valid WhatsApp number is required.' }, { status: 400 });
  }
  if (!data.location || typeof data.location !== 'string' || !data.location.trim()) {
    return NextResponse.json({ error: 'Location is required.' }, { status: 400 });
  }
  if (!data.organisation || typeof data.organisation !== 'string' || !data.organisation.trim()) {
    return NextResponse.json({ error: 'Current company is required.' }, { status: 400 });
  }
  if (!data.current_role || typeof data.current_role !== 'string' || !data.current_role.trim()) {
    return NextResponse.json({ error: 'Current role is required.' }, { status: 400 });
  }
  if (data.consent !== true) {
    return NextResponse.json({ error: 'You must accept the privacy policy to register.' }, { status: 400 });
  }

  const attendanceType = data.attendance_type === 'virtual' ? 'virtual' : 'onsite';

  const { data: existing } = await supabaseAdmin
    .from('summit_registrations')
    .select('id, payment_status')
    .eq('email', data.email.trim().toLowerCase())
    .maybeSingle();

  if (existing?.payment_status === 'paid') {
    return NextResponse.json({ error: 'Already registered and confirmed' }, { status: 409 });
  }

  if (existing) {
    // Retrying with a different ticket type must change the price we charge.
    // Only touch unpaid rows, and only the ticket type (the price driver).
    await supabaseAdmin
      .from('summit_registrations')
      .update({ attendance_type: attendanceType, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .neq('payment_status', 'paid');
    return NextResponse.json({ registrationId: existing.id });
  }

  const { data: created, error } = await supabaseAdmin
    .from('summit_registrations')
    .insert({
      full_name: data.full_name.trim(),
      email: data.email.trim().toLowerCase(),
      whatsapp: data.whatsapp.trim(),
      location: data.location.trim(),
      organisation: data.organisation.trim(),
      current_role: data.current_role.trim(),
      other_messages: data.other_messages?.trim() || null,
      consent: data.consent === true,
      attendance_type: attendanceType,
      status: 'pending',
      payment_status: 'pending',
      source: 'web',
    })
    .select('id')
    .single();

  if (error || !created) {
    console.error('[summit/register] DB error:', error?.message);
    return NextResponse.json({ error: 'Registration failed.' }, { status: 500 });
  }

  try {
    await sendRegistrationReceivedEmail(data.email.trim().toLowerCase(), data.full_name.trim());
  } catch (err: any) {
    console.error('Failed to send registration received email', err);
  }

  return NextResponse.json({ registrationId: created.id });
}
