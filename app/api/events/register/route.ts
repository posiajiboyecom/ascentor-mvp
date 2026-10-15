// app/api/events/register/route.ts
// Public POST - registers a visitor for any public event.
// Body: { eventId, full_name, email, whatsapp?, country?, ...optional fields }

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { brandedEmailLayout, esc, p, goldButton, summaryRow, summaryBox } from '@/lib/emailTemplate';
import { sendEmail } from '@/lib/nodemailer';
import { parseJson, parseQuery } from '@/lib/validation/http';
import * as publicSchemas from '@/lib/validation/schemas/public';

function confirmationHtml(opts: {
  firstName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  confirmationBody: string;
  recipient: string;
}) {
  return brandedEmailLayout({
    preheader: `You're registered for ${opts.eventTitle}.`,
    eyebrow: esc(opts.eventTitle),
    heading: `You're registered, ${esc(opts.firstName)}.`,
    recipient: opts.recipient,
    content:
      summaryBox(
        summaryRow('Event', esc(opts.eventTitle)) +
        summaryRow('Date', esc(opts.eventDate)) +
        summaryRow('Location', esc(opts.eventLocation))
      ) +
      p(esc(opts.confirmationBody).replace(/\n/g, '<br>')) +
      goldButton('View all events →', 'https://joinascentor.com/events'),
  });
}

export async function POST(req: Request) {
  const parsed = await parseJson(req, publicSchemas.eventRegister);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const { eventId, full_name, email } = body;

  // Fetch event
  const { data: event } = await supabaseAdmin
    .from('public_events')
    .select('id, title, event_date, location, registration_open, confirmation_subject, confirmation_body')
    .eq('id', eventId)
    .eq('is_published', true)
    .single();

  if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
  if (!event.registration_open)
    return NextResponse.json({ error: 'Registration for this event is closed.' }, { status: 400 });

  // Insert
  const { error: dbError } = await supabaseAdmin
    .from('event_registrations')
    .insert({
      event_id:      eventId,
      full_name:     (full_name as string).trim(),
      email:         (email as string).trim().toLowerCase(),
      whatsapp:      body.whatsapp   || null,
      phone:         body.phone      || null,
      country:       body.country    || null,
      city:          body.city       || null,
      current_role:  body.current_role || null,
      organisation:  body.organisation || null,
      industry:      body.industry   || null,
      what_building: body.what_building || null,
      why_attend:    body.why_attend || null,
      how_heard:     body.how_heard  || null,
      dietary_needs: body.dietary_needs || null,
      accessibility: body.accessibility || null,
      status: 'pending',
    });

  if (dbError) {
    if (dbError.code === '23505')
      return NextResponse.json({ error: "You've already registered for this event." }, { status: 409 });
    console.error('[events/register]', dbError.message);
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
  }

  // Send confirmation email (non-fatal)
  try {
    const firstName = (full_name as string).trim().split(/\s+/)[0];
    await sendEmail({
      from:    'Ascentor <hello@joinascentor.com>',
      to:      (email as string).trim().toLowerCase(),
      subject: event.confirmation_subject || `You're registered, ${event.title}`,
      html:    confirmationHtml({
        firstName,
        eventTitle:        event.title,
        eventDate:         event.event_date || '',
        eventLocation:     event.location   || '',
        confirmationBody:  event.confirmation_body || "We have your details and will be in touch closer to the event.",
        recipient:         (email as string).trim().toLowerCase(),
      }),
    });
  } catch (err: any) { console.warn('[events/register] email non-fatal:', err.message); }

  return NextResponse.json({ ok: true });
}
