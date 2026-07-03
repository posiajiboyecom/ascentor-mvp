// app/api/events/register/route.ts
// Public POST — registers a visitor for any public event.
// Body: { eventId, full_name, email, whatsapp?, country?, ...optional fields }

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

function confirmationHtml(opts: {
  firstName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  confirmationBody: string;
}) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0F0F0E;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F0F0E;padding:48px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#161614;border-radius:16px;overflow:hidden;border:1px solid rgba(200,169,110,0.2);">
        <tr><td style="padding:32px 36px 0;">
          <img src="https://ascentorbi.com/ascentor-color-for-dark-pages.svg" alt="Ascentor" height="26" style="display:block;margin-bottom:32px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#C8A96E;">
            ◇ ${opts.eventTitle}
          </p>
          <h2 style="margin:0 0 20px;font-size:26px;font-weight:700;color:#FAFAF8;line-height:1.25;font-family:Georgia,serif;">
            You're registered, ${opts.firstName}.
          </h2>
          <table style="background:#1E1D1B;border-radius:10px;border:1px solid rgba(200,169,110,0.15);width:100%;margin-bottom:24px;">
            <tr><td style="padding:18px 22px;">
              <p style="margin:0 0 8px;font-size:13px;color:#9CA3AF;">
                <strong style="color:#FAFAF8;">Event</strong><br>${opts.eventTitle}
              </p>
              <p style="margin:0 0 8px;font-size:13px;color:#9CA3AF;">
                <strong style="color:#FAFAF8;">Date</strong><br>${opts.eventDate}
              </p>
              <p style="margin:0;font-size:13px;color:#9CA3AF;">
                <strong style="color:#FAFAF8;">Location</strong><br>${opts.eventLocation}
              </p>
            </td></tr>
          </table>
          <p style="margin:0 0 28px;font-size:15px;color:#9CA3AF;line-height:1.75;">${opts.confirmationBody.replace(/\n/g, '<br>')}</p>
          <a href="https://ascentorbi.com/events" style="display:inline-block;padding:12px 22px;background:#C8A96E;color:#0F0F0E;text-decoration:none;border-radius:9px;font-weight:700;font-size:13px;margin-bottom:32px;">
            View all events →
          </a>
        </td></tr>
        <tr><td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:11px;color:#4B5563;font-family:'Courier New',monospace;letter-spacing:0.04em;">
            YOU REGISTERED FOR ${opts.eventTitle.toUpperCase()} · ASCENTOR
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  const { eventId, full_name, email } = body;
  if (!eventId || typeof eventId !== 'string')
    return NextResponse.json({ error: 'eventId is required.' }, { status: 400 });
  if (!full_name || typeof full_name !== 'string' || !full_name.trim())
    return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
  if (!email || typeof email !== 'string' || !email.includes('@'))
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });

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
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const firstName = (full_name as string).trim().split(/\s+/)[0];
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          from:    'Ascentor <notifications@ascentorbi.com>',
          to:      (email as string).trim().toLowerCase(),
          subject: event.confirmation_subject || `You're registered — ${event.title}`,
          html:    confirmationHtml({
            firstName,
            eventTitle:        event.title,
            eventDate:         event.event_date || '',
            eventLocation:     event.location   || '',
            confirmationBody:  event.confirmation_body || "We have your details and will be in touch closer to the event.",
          }),
        }),
      });
    }
  } catch (err: any) { console.warn('[events/register] email non-fatal:', err.message); }

  return NextResponse.json({ ok: true });
}
