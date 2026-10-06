// app/api/summit/notify/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/summit/notify
// Admin-only. Sends a branded email to all summit registrants with a given status.
// Body: { status: string, subject: string, message: string }
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { brandedEmailLayout, esc, goldButton } from '@/lib/emailTemplate';
import { sendEmail, getMailer } from '@/lib/nodemailer';

function buildHtml(opts: { firstName: string; message: string; recipient: string }) {
  const bodyHtml = esc(opts.message).replace(/\n/g, '<br>');

  return brandedEmailLayout({
    preheader: 'An update from The Elevation Summit.',
    eyebrow: 'The Elevation Summit · 2026',
    heading: `Hi ${esc(opts.firstName)},`,
    recipient: opts.recipient,
    content:
      `<p style="margin:0 0 16px;">${bodyHtml}</p>` +
      goldButton('View Summit details →', 'https://joinascentor.com/elevation-summit'),
  });
}

export async function POST(req: Request) {
  // Auth gate
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'moderator'].includes(profile.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { status?: unknown; subject?: unknown; message?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { status, subject, message } = body;
  if (typeof status !== 'string' || !status.trim())
    return NextResponse.json({ error: 'status is required' }, { status: 400 });
  if (typeof subject !== 'string' || !subject.trim())
    return NextResponse.json({ error: 'subject is required' }, { status: 400 });
  if (typeof message !== 'string' || !message.trim())
    return NextResponse.json({ error: 'message is required' }, { status: 400 });

  if (!getMailer()) return NextResponse.json({ error: 'SMTP credentials not configured' }, { status: 500 });

  // Fetch registrants with the given status
  // "confirmed" means PAID. Never trust the manual status flag for who gets confirmed mail.
  let regsQuery = supabaseAdmin.from('summit_registrations').select('email, full_name');
  regsQuery = status === 'confirmed'
    ? regsQuery.eq('payment_status', 'paid')
    : regsQuery.eq('status', status).neq('payment_status', 'paid');
  const { data: regs } = await regsQuery;

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
        subject: (subject as string).trim(),
        html: buildHtml({ firstName, message: personalised, recipient: r.email }),
      });
      sent++;
    } catch { failed++; }
  }));

  // Audit log
  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'summit_registrants_emailed',
      entity_type: 'summit_registrations',
      entity_id: null,
      details: { status, subject, sent, failed, total: regs.length },
    });
  } catch { /* non-fatal */ }

  // Mark notified_at for confirmed sends
  if (status === 'confirmed' && sent > 0) {
    await supabaseAdmin.from('summit_registrations')
      .update({ notified_at: new Date().toISOString() })
      .eq('payment_status', 'paid');
  }

  return NextResponse.json({ ok: true, sent, failed, total: regs.length });
}
