// app/api/pricing/partner-enquiry/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// POST: Potential partner submits contact form on the pricing page.
//
// Actions:
//  1. Validates input (name, email, org, message)
//  2. Saves lead to partner_enquiries table (created below if not exists)
//  3. Sends founder notification email via Resend
//  4. Sends acknowledgement email to the prospect
//
// No auth required - this is a public-facing form.
//
// SQL to run in Supabase SQL editor (run each statement individually):
//
//   create table if not exists partner_enquiries (
//     id uuid primary key default gen_random_uuid(),
//     name text not null,
//     email text not null,
//     organisation text not null,
//     message text,
//     status text not null default 'new',
//     created_at timestamptz not null default now()
//   );
//
//   alter table partner_enquiries enable row level security;
//
//   create policy "service role only" on partner_enquiries
//     using (false);
//
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { brandedEmailLayout, esc, p, goldButton, outlineButton, summaryRow, summaryBox, messageBlock } from '@/lib/emailTemplate'
import { sendEmail as sendMail } from '@/lib/nodemailer'
import { parseJson, parseQuery } from '@/lib/validation/http';
import * as publicSchemas from '@/lib/validation/schemas/public';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || 'joinascentor@gmail.com'

function acknowledgementEmail(name: string, org: string, recipient: string) {
  const firstName = name.split(' ')[0] || name
  return {
    subject: `We received your enquiry, ${firstName} | Ascentor Partners`,
    html: brandedEmailLayout({
      preheader: `We received your Ascentor partner enquiry for ${org}`,
      eyebrow: 'Partner Enquiry Received',
      heading: `Thanks for reaching out, ${esc(firstName)}.`,
      recipient,
      content:
        p(`We've received your enquiry for <strong>${esc(org)}</strong> and our team will be in touch shortly to discuss how Ascentor can work for your organisation.`) +
        summaryBox(
          summaryRow('What happens next', 'Our team reviews every enquiry personally. You can expect a reply within <strong>1–2 business days</strong>. We\'ll share details on how the partner programme works and schedule a walkthrough of the platform.')
        ) +
        p('In the meantime, feel free to explore the platform as a user, it\'s the best way to understand the experience you\'d be offering your members.') +
        goldButton('Explore the platform →', 'https://joinascentor.com/signup'),
    }),
  }
}

function founderNotificationEmail(name: string, email: string, org: string, message: string, enquiryId: string) {
  const adminUrl = `https://joinascentor.com/admin/partners`
  return {
    subject: `New Partner Enquiry: ${org}`,
    html: brandedEmailLayout({
      preheader: `New partner enquiry from ${org}`,
      eyebrow: 'Admin Notification',
      heading: 'New Partner Enquiry',
      recipient: FOUNDER_EMAIL,
      content:
        summaryBox(
          summaryRow('Name', esc(name)) +
          summaryRow('Email', `<a href="mailto:${esc(email)}" style="color:#0F0F0E;text-decoration:none;">${esc(email)}</a>`) +
          summaryRow('Organisation', esc(org)) +
          summaryRow('Enquiry ID', `<span style="font-size:12px;color:#9CA3AF;">${esc(enquiryId)}</span>`)
        ) +
        p('<strong>Message</strong>') +
        messageBlock(esc(message || '-')) +
        `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td>${goldButton('View in Admin Panel →', adminUrl)}</td>
          <td style="width:12px;">&nbsp;</td>
          <td>${outlineButton('Reply directly →', `mailto:${esc(email)}?subject=Re: Your Ascentor partner enquiry&body=Hi ${encodeURIComponent(name.split(' ')[0])},`)}</td>
        </tr></table>`,
    }),
  }
}

async function sendEmail(to: string, subject: string, html: string) {
  await sendMail({ from: 'Ascentor Partners <noreply@ascentorbi.com>', to, subject, html })
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJson(req, publicSchemas.partnerEnquiry);
    if (!parsed.ok) return parsed.response;
    const { name, email, org } = parsed.data;
    const message = parsed.data.message ?? '';

    // ── Save lead ─────────────────────────────────────────────────────────────
    const { data: enquiry, error: dbErr } = await supabase
      .from('partner_enquiries')
      .insert({ name, email, organisation: org, message, status: 'new' })
      .select('id')
      .single()

    if (dbErr) {
      // Non-fatal if table doesn't exist yet - still send emails
      console.warn('[partner-enquiry] DB insert failed (non-fatal):', dbErr.message)
    }

    const enquiryId = enquiry?.id || 'pending-db-setup'

    // ── Email founder ─────────────────────────────────────────────────────────
    try {
      const founderEmail = founderNotificationEmail(name, email, org, message, enquiryId)
      await sendEmail(FOUNDER_EMAIL, founderEmail.subject, founderEmail.html)
    } catch (emailErr) {
      console.warn('[partner-enquiry] Founder email failed (non-fatal):', emailErr)
    }

    // ── Acknowledgement to prospect ───────────────────────────────────────────
    try {
      const ackEmail = acknowledgementEmail(name, org, email)
      await sendEmail(email, ackEmail.subject, ackEmail.html)
    } catch (emailErr) {
      console.warn('[partner-enquiry] Acknowledgement email failed (non-fatal):', emailErr)
    }

    return NextResponse.json({ success: true })

  } catch (err: any) {
    console.error('[partner-enquiry]', err)
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 })
  }
}
