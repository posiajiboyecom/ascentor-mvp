// app/api/summit/notify/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/summit/notify
// Admin-only. Sends a branded email to all summit registrants with a given status.
// Body: { status: string, subject: string, message: string }
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

function buildHtml(opts: { firstName: string; message: string }) {
  const bodyHtml = opts.message
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0F0F0E;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F0F0E;padding:48px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#161614;border-radius:16px;overflow:hidden;border:1px solid rgba(200,169,110,0.2);">
        <tr><td style="padding:32px 36px;">
          <img src="https://ascentorbi.com/ascentor-color-for-dark-pages.svg" alt="Ascentor" height="26" style="display:block;margin-bottom:28px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#C8A96E;">◇ The Elevation Summit · 2027</p>
          <p style="margin:20px 0 0;font-size:15px;color:#9CA3AF;line-height:1.8;">${bodyHtml}</p>
          <div style="margin-top:28px;">
            <a href="https://ascentorbi.com/elevation-summit" style="display:inline-block;padding:12px 22px;background:#C8A96E;color:#0F0F0E;text-decoration:none;border-radius:9px;font-weight:700;font-size:13px;">
              View Summit details →
            </a>
          </div>
        </td></tr>
        <tr><td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:11px;color:#4B5563;font-family:'Courier New',monospace;letter-spacing:0.04em;">
            YOU ARE RECEIVING THIS BECAUSE YOU REGISTERED FOR THE ELEVATION SUMMIT 2027.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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
          html: buildHtml({ firstName, message: personalised }),
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
