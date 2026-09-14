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
import { brandedEmailLayout, esc, p, goldButton, outlineButton, summaryRow, summaryBox, messageBlock } from '@/lib/emailTemplate';
import { sendEmail as sendMail } from '@/lib/nodemailer';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ADMIN_EMAIL     = process.env.FOUNDER_EMAIL || 'asamuel@ascentorbi.com';
const FROM_ADDRESS    = 'Ascentor <notifications@ascentorbi.com>';

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
  await sendMail({ from: FROM_ADDRESS, to, subject, html });
}

// ── Email templates ──────────────────────────────────────────────────────────

function adminEmailHtml(name: string, email: string, subject: string, message: string): string {
  const subjectLabel = SUBJECT_LABELS[subject] || subject;
  const adminUrl = 'https://ascentorbi.com/admin/inbox';
  return brandedEmailLayout({
    preheader: `New contact message: ${subjectLabel} — from ${name}`,
    eyebrow: 'New Contact Message',
    heading: subjectLabel,
    recipient: ADMIN_EMAIL,
    content:
      summaryBox(
        summaryRow('Name', esc(name)) +
        summaryRow('Email', `<a href="mailto:${esc(email)}" style="color:#0F0F0E;text-decoration:none;">${esc(email)}</a>`) +
        summaryRow('Topic', esc(subjectLabel))
      ) +
      p('<strong>Message</strong>') +
      messageBlock(esc(message)) +
      `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td>${goldButton('View in Admin Inbox →', adminUrl)}</td>
        <td style="width:12px;">&nbsp;</td>
        <td>${outlineButton('Reply directly', `mailto:${esc(email)}?subject=Re: ${encodeURIComponent(subjectLabel)}`)}</td>
      </tr></table>`,
  });
}

function ackEmailHtml(firstName: string, subjectLabel: string, recipient: string): string {
  return brandedEmailLayout({
    preheader: 'We received your message and will reply within 2–3 business days.',
    eyebrow: 'We Got Your Message',
    heading: `Thanks, ${esc(firstName)}.`,
    recipient,
    content:
      p(`Your message about <strong>${esc(subjectLabel)}</strong> reached us. We read every message and aim to reply within <strong>2–3 business days</strong>.`) +
      goldButton('Back to Ascentor →', 'https://ascentorbi.com'),
  });
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
    ackEmailHtml(firstName, subjectLabel, email.trim().toLowerCase()),
  ).catch(err => console.warn('[contact] Ack email failed (non-fatal):', err?.message));

  return NextResponse.json({ success: true });
}
