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
// No auth required — this is a public-facing form.
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || 'asamuel@ascentorbi.com'
const RESEND_API_KEY = process.env.RESEND_API_KEY!

// Brand tokens for email
const BRAND = {
  gold:   '#E8A020',
  dark:   '#0C0B08',
  card:   '#1E1C17',
  text:   '#F7F6F3',
  muted:  '#8A8272',
  border: 'rgba(232,160,32,0.2)',
}

function emailLayout(content: string, preheader: string = '') {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  ${preheader ? `<span style="display:none;max-height:0;overflow:hidden;mso-hide:all">${preheader}</span>` : ''}
</head>
<body style="margin:0;padding:0;background:#0C0B08;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0C0B08">
    <tr><td align="center" style="padding:40px 20px">
      <table width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#1E1C17;border-radius:16px;border:1px solid rgba(232,160,32,0.2)">
        <tr><td style="padding:28px 32px 20px;border-bottom:1px solid rgba(232,160,32,0.12);text-align:center">
          <span style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#F7F6F3;letter-spacing:-0.3px">
            <span style="color:#E8A020">Ascent</span>or
          </span>
        </td></tr>
        <tr><td style="padding:32px">${content}</td></tr>
        <tr><td style="padding:20px 32px 28px;text-align:center;border-top:1px solid rgba(212,207,195,0.08)">
          <p style="margin:0;font-size:11px;color:#8A8272">
            © ${new Date().getFullYear()} Ascentor · ascentorbi.com
          </p>
          <p style="margin:6px 0 0;font-size:11px;color:#8A8272">
            <a href="https://ascentorbi.com/terms" style="color:#8A8272;text-decoration:none">Terms</a> ·
            <a href="https://ascentorbi.com/privacy" style="color:#8A8272;text-decoration:none">Privacy</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function acknowledgementEmail(name: string, org: string) {
  const firstName = name.split(' ')[0] || name
  return {
    subject: `We received your enquiry, ${firstName} — Ascentor Partners`,
    html: emailLayout(`
      <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:26px;font-weight:700;color:#F7F6F3;line-height:1.2">
        Thanks for reaching out, ${firstName}.
      </h1>
      <p style="margin:0 0 16px;font-size:15px;color:#C8C3B8;line-height:1.7">
        We've received your enquiry for <strong style="color:#F7F6F3">${org}</strong> and our team will be in touch shortly to discuss how Ascentor can work for your organisation.
      </p>
      <div style="background:#0C0B08;border:1px solid rgba(232,160,32,0.18);border-radius:12px;padding:20px 24px;margin:24px 0">
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#E8A020">
          What happens next
        </p>
        <p style="margin:0;font-size:14px;color:#C8C3B8;line-height:1.7">
          Our team reviews every enquiry personally. You can expect a reply within <strong style="color:#F7F6F3">1–2 business days</strong>. We'll share details on how the partner programme works and schedule a walkthrough of the platform.
        </p>
      </div>
      <p style="margin:0 0 24px;font-size:14px;color:#8A8272;line-height:1.7">
        In the meantime, feel free to explore the platform as a user — it's the best way to understand the experience you'd be offering your members.
      </p>
      <div style="text-align:center;margin:0 0 8px">
        <a href="https://ascentorbi.com/signup"
           style="display:inline-block;padding:13px 32px;background:#E8A020;color:#0C0B08;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px">
          Explore the platform →
        </a>
      </div>
    `, `We received your Ascentor partner enquiry for ${org}`)
  }
}

function founderNotificationEmail(name: string, email: string, org: string, message: string, enquiryId: string) {
  const adminUrl = `https://ascentorbi.com/admin/partners`
  return {
    subject: `New Partner Enquiry: ${org}`,
    html: emailLayout(`
      <h2 style="margin:0 0 20px;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#F7F6F3">
        New Partner Enquiry
      </h2>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
        ${[
          ['Name',         name],
          ['Email',        `<a href="mailto:${email}" style="color:#E8A020;text-decoration:none">${email}</a>`],
          ['Organisation', org],
        ].map(([label, value]) => `
          <tr>
            <td style="padding:10px 0;font-size:13px;color:#8A8272;width:130px;vertical-align:top">${label}</td>
            <td style="padding:10px 0;font-size:14px;color:#F7F6F3;font-weight:600">${value}</td>
          </tr>
        `).join('')}
        <tr>
          <td style="padding:10px 0;font-size:13px;color:#8A8272;vertical-align:top">Message</td>
          <td style="padding:10px 0;font-size:14px;color:#C8C3B8;line-height:1.6">${message || '—'}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;font-size:13px;color:#8A8272">Enquiry ID</td>
          <td style="padding:10px 0;font-family:monospace;font-size:12px;color:#8A8272">${enquiryId}</td>
        </tr>
      </table>
      <div style="margin-top:28px">
        <a href="${adminUrl}"
           style="display:inline-block;padding:12px 24px;background:#E8A020;color:#0C0B08;font-size:13px;font-weight:700;text-decoration:none;border-radius:8px">
          View in Admin Panel →
        </a>
        <a href="mailto:${email}?subject=Re: Your Ascentor partner enquiry&body=Hi ${name.split(' ')[0]},"
           style="display:inline-block;margin-left:10px;padding:12px 24px;background:transparent;color:#F7F6F3;font-size:13px;font-weight:600;text-decoration:none;border-radius:8px;border:1px solid rgba(212,207,195,0.2)">
          Reply directly →
        </a>
      </div>
    `)
  }
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Ascentor Partners <noreply@ascentorbi.com>',
      to,
      subject,
      html,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend error: ${err}`)
  }
  return res.json()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const name    = (body.name    || '').trim()
    const email   = (body.email   || '').trim().toLowerCase()
    const org     = (body.org     || '').trim()
    const message = (body.message || '').trim()

    // ── Validate ──────────────────────────────────────────────────────────────
    if (!name)  return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
    if (!org)   return NextResponse.json({ error: 'Organisation name is required' }, { status: 400 })

    // ── Save lead ─────────────────────────────────────────────────────────────
    const { data: enquiry, error: dbErr } = await supabase
      .from('partner_enquiries')
      .insert({ name, email, organisation: org, message, status: 'new' })
      .select('id')
      .single()

    if (dbErr) {
      // Non-fatal if table doesn't exist yet — still send emails
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
      const ackEmail = acknowledgementEmail(name, org)
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
