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

function buildHtml(opts: { firstName: string; message: string; recipient: string }) {
  const bodyHtml = esc(opts.message).replace(/\n/g, '<br>');

  return brandedEmailLayout({
    preheader: 'An update from The Elevation Summit.',
    eyebrow: 'The Elevation Summit · 2026',
    heading: `Hi ${esc(opts.firstName)},`,
    recipient: opts.recipient,
    content:
      `<p style="margin:0 0 16px;">${bodyHtml}</p>` +
      goldButton('View Summit details →', 'https://ascentorbi.com/elevation-summit'),
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

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });

  // Fetch registrants with the given status
  const { data: regs } = await supabaseAdmin
    .from('summit_registrations')
    .select('email, full_name')
    .eq('status', status);

  if (!regs || regs.length === 0)
    return NextResponse.json({ ok: true, sent: 0, message: 'No registrants with that status.' });

  let sent = 0, failed = 0;

  await Promise.allSettled(regs.map(async (r: { email: string; full_name: string }) => {
    const firstName = r.full_name.trim().split(/\s+/)[0];
    const personalised = (message as string).replace(/\{name\}/gi, firstName);

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          from: 'Ascentor <notifications@ascentorbi.com>',
          to: r.email,
          subject: (subject as string).trim(),
          html: buildHtml({ firstName, message: personalised, recipient: r.email }),
        }),
      });
      if (res.ok) sent++; else failed++;
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
      .eq('status', 'confirmed');
  }

  return NextResponse.json({ ok: true, sent, failed, total: regs.length });
}
