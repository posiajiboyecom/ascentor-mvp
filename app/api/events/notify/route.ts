// app/api/events/notify/route.ts
// Admin-only. Sends personalised email to all registrants of a given event
// with a given status. Body: { eventId, status, subject, message }

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { brandedEmailLayout, esc, goldButton } from '@/lib/emailTemplate';
import { sendEmail, getMailer } from '@/lib/nodemailer';

function buildHtml(opts: { firstName: string; eventTitle: string; message: string; recipient: string }) {
  const body = esc(opts.message).replace(/\n/g, '<br>');
  return brandedEmailLayout({
    preheader: `An update from ${opts.eventTitle}.`,
    eyebrow: esc(opts.eventTitle),
    heading: `Hi ${esc(opts.firstName)},`,
    recipient: opts.recipient,
    content:
      `<p style="margin:0 0 16px;">${body}</p>` +
      goldButton('View all events →', 'https://joinascentor.com/events'),
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['admin','moderator'].includes(profile.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { eventId, status, subject, message } = body;
  if (!eventId || !status || !subject?.trim() || !message?.trim())
    return NextResponse.json({ error: 'eventId, status, subject and message are required' }, { status: 400 });

  if (!getMailer()) return NextResponse.json({ error: 'SMTP credentials not configured' }, { status: 500 });

  const { data: event } = await supabaseAdmin.from('public_events').select('title').eq('id', eventId).single();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const { data: regs } = await supabaseAdmin
    .from('event_registrations').select('email, full_name').eq('event_id', eventId).eq('status', status);

  if (!regs || regs.length === 0)
    return NextResponse.json({ ok: true, sent: 0, message: 'No registrants with that status.' });

  let sent = 0, failed = 0;
  await Promise.allSettled(regs.map(async (r: { email: string; full_name: string }) => {
    const firstName = r.full_name.trim().split(/\s+/)[0];
    const personalised = (message as string).replace(/\{name\}/gi, firstName);
    try {
      await sendEmail({
        from: 'Ascentor <notifications@ascentorbi.com>',
        to: r.email,
        subject: subject.trim(),
        html: buildHtml({ firstName, eventTitle: event.title, message: personalised, recipient: r.email }),
      });
      sent++;
    } catch { failed++; }
  }));

  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id, action: 'event_registrants_emailed',
      entity_type: 'public_events', entity_id: eventId,
      details: { status, subject, sent, failed, total: regs.length },
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true, sent, failed, total: regs.length });
}
