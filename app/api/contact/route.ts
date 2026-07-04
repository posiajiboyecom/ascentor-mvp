// app/api/contact/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/contact — public, no auth required.
// 1. Validates input
// 2. Saves to `contact_messages` table (Supabase, service role)
// 3. Emails the admin/founder via Resend
// 4. Sends an acknowledgement to the sender (non-fatal)
//
// SQL migration — run once in Supabase SQL editor:
// ─────────────────────────────────────────────────────────────────────────────
//   CREATE TABLE IF NOT EXISTS contact_messages (
//     id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     name         text NOT NULL,
//     email        text NOT NULL,
//     subject      text NOT NULL,
//     message      text NOT NULL,
//     status       text NOT NULL DEFAULT 'new',  -- new | read | replied | archived
//     created_at   timestamptz NOT NULL DEFAULT now()
//   );
//
//   ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
//
//   -- Only the service role can read/write (admin page uses supabaseAdmin)
//   CREATE POLICY "service role only" ON contact_messages USING (false);
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const RESEND_API_KEY  = process.env.RESEND_API_KEY!;
const ADMIN_EMAIL     = process.env.FOUNDER_EMAIL || 'asamuel@ascentorbi.com';
const FROM_ADDRESS    = 'Ascentor <notifications@ascentorbi.com>';
const GOLD            = '#C8A96E';
const DARK            = '#0F0F0E';

const SUBJECT_LABELS: Record<string, string> = {
  general:     'General inquiry',
  partnership: 'Partnership opportunity',
  speaking:    'Speaking / Summit',
  media:       'Media / Press',
  support:     'Platform support',
  other:       'Something else',
};

// ── Email sender ─────────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn('[contact] RESEND_API_KEY not set — skipping email');
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
}

// ── Email templates ──────────────────────────────────────────────────────────

function adminEmailHtml(name: string, email: string, subject: string, message: string): string {
  const subjectLabel = SUBJECT_LABELS[subject] || subject;
  const adminUrl = 'https://ascentorbi.com/admin/inbox';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F4F0;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4F0;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E8E6E1;">
        <tr><td style="background:${DARK};padding:20px 28px;display:flex;align-items:center;gap:12px;">
          <img src="https://ascentorbi.com/ascentor-color-for-dark-pages.svg" alt="Ascentor" height="22" style="display:block;">
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${GOLD};">New contact message</p>
          <h2 style="margin:0 0 20px;font-size:20px;font-weight:700;color:${DARK};">${subjectLabel}</h2>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border-radius:8px;overflow:hidden;border:1px solid #E8E6E1;">
            <tr style="background:#F9F8F5;">
              <td style="padding:10px 14px;font-size:12px;font-weight:600;color:#6B7280;width:80px;">Name</td>
              <td style="padding:10px 14px;font-size:13px;color:${DARK};">${name}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;font-size:12px;font-weight:600;color:#6B7280;border-top:1px solid #E8E6E1;">Email</td>
              <td style="padding:10px 14px;font-size:13px;border-top:1px solid #E8E6E1;"><a href="mailto:${email}" style="color:${DARK};text-decoration:none;">${email}</a></td>
            </tr>
            <tr style="background:#F9F8F5;">
              <td style="padding:10px 14px;font-size:12px;font-weight:600;color:#6B7280;border-top:1px solid #E8E6E1;">Topic</td>
              <td style="padding:10px 14px;font-size:13px;color:${DARK};border-top:1px solid #E8E6E1;">${subjectLabel}</td>
            </tr>
          </table>

          <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;">Message</p>
          <div style="background:#F9F8F5;border-radius:8px;border:1px solid #E8E6E1;padding:14px 16px;">
            <p style="margin:0;font-size:14px;color:${DARK};line-height:1.7;white-space:pre-wrap;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
          </div>

          <div style="margin-top:24px;">
            <a href="${adminUrl}" style="display:inline-block;padding:11px 20px;background:${DARK};color:#FAFAF8;text-decoration:none;border-radius:8px;font-weight:700;font-size:13px;">
              View in Admin Inbox →
            </a>
            <a href="mailto:${email}?subject=Re: ${encodeURIComponent(subjectLabel)}" style="display:inline-block;padding:11px 20px;background:transparent;color:${DARK};text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;border:1.5px solid #E8E6E1;margin-left:8px;">
              Reply directly
            </a>
          </div>
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #E8E6E1;">
          <p style="margin:0;font-size:11px;color:#9CA3AF;font-family:'Courier New',monospace;letter-spacing:0.04em;">ASCENTOR ADMIN · CONTACT MESSAGE</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ackEmailHtml(firstName: string, subjectLabel: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0F0F0E;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F0F0E;padding:48px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#161614;border-radius:16px;overflow:hidden;border:1px solid rgba(200,169,110,0.2);">
        <tr><td style="padding:28px 32px 0;">
          <img src="https://ascentorbi.com/ascentor-color-for-dark-pages.svg" alt="Ascentor" height="22" style="display:block;margin-bottom:28px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${GOLD};">We got your message</p>
          <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#FAFAF8;font-family:Georgia,serif;">Thanks, ${firstName}.</h2>
          <p style="margin:0 0 24px;font-size:14px;color:#9CA3AF;line-height:1.75;">
            Your message about <strong style="color:#FAFAF8;">${subjectLabel}</strong> reached us. We read every message and aim to reply within 2–3 business days.
          </p>
        </td></tr>
        <tr><td style="padding:0 32px 28px;">
          <a href="https://ascentorbi.com" style="display:inline-block;padding:10px 18px;background:rgba(200,169,110,0.12);color:${GOLD};text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;border:1px solid rgba(200,169,110,0.3);">
            Back to Ascentor →
          </a>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:11px;color:#4B5563;font-family:'Courier New',monospace;letter-spacing:0.04em;">ASCENTOR · LAGOS, NIGERIA</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { name?: string; email?: string; subject?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { name = '', email = '', subject = '', message = '' } = body;

  // Validate
  if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
  }
  if (message.trim().length > 4000) {
    return NextResponse.json({ error: 'Message is too long (max 4000 characters).' }, { status: 400 });
  }

  // Save to DB
  const { error: dbError } = await supabaseAdmin
    .from('contact_messages')
    .insert({
      name:    name.trim(),
      email:   email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
      status:  'new',
    });

  if (dbError) {
    console.error('[contact] DB insert failed:', dbError.message);
    return NextResponse.json({ error: 'Failed to save message. Please try again.' }, { status: 500 });
  }

  const firstName    = name.trim().split(/\s+/)[0];
  const subjectLabel = SUBJECT_LABELS[subject] || subject;

  // Admin notification email (non-fatal)
  sendEmail(
    ADMIN_EMAIL,
    `[Contact] ${subjectLabel} — from ${name.trim()}`,
    adminEmailHtml(name.trim(), email.trim(), subject, message.trim()),
  ).catch(err => console.warn('[contact] Admin email failed (non-fatal):', err?.message));

  // Acknowledgement to sender (non-fatal)
  sendEmail(
    email.trim().toLowerCase(),
    'We received your message — Ascentor',
    ackEmailHtml(firstName, subjectLabel),
  ).catch(err => console.warn('[contact] Ack email failed (non-fatal):', err?.message));

  return NextResponse.json({ success: true });
}
