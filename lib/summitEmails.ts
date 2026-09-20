import { summitMailer, getMailer } from './nodemailer';
import { brandedEmailLayout, esc, p, goldButton, summaryRow, summaryBox } from './emailTemplate';
import { generateSummitTicket, type TicketData } from './summitTicket';
import { supabaseAdmin } from '@/lib/supabase/admin';

const SUMMIT_URL = 'https://ascentorbi.com/elevation-summit';

/** Where every Summit admin alert goes. Deliberately NOT ADMIN_EMAIL, which may point elsewhere. */
export const SUMMIT_ADMIN_EMAIL = process.env.SUMMIT_ADMIN_EMAIL || 'joinascentor@gmail.com';

type MailOpts = {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
};

/**
 * Single sender for all Summit mail. Unlike lib/nodemailer.sendEmail it THROWS
 * when no SMTP account is configured or the send fails, so callers can record
 * the failure and retry instead of silently losing the email.
 * Uses the dedicated Summit Gmail account, falling back to the shared SMTP one.
 */
async function sendSummitMail(opts: MailOpts): Promise<void> {
  const from =
    process.env.SUMMIT_MAIL_FROM ||
    process.env.SUMMIT_GMAIL_USER ||
    process.env.SMTP_USER ||
    'Ascentor <no-reply@ascentorbi.com>';

  const transport = process.env.SUMMIT_GMAIL_USER && process.env.SUMMIT_GMAIL_APP_PASSWORD
    ? summitMailer
    : getMailer();
  if (!transport) {
    throw new Error('No SMTP credentials configured (SUMMIT_GMAIL_USER/SUMMIT_GMAIL_APP_PASSWORD or SMTP_USER/SMTP_PASS)');
  }

  await transport.sendMail({ from, ...opts });
}

const naira = (n: number) => `₦${Number(n).toLocaleString('en-NG')}`;
const typeLabel = (t: string | null | undefined) => (t === 'virtual' ? 'Virtual' : 'Physical (Onsite, Lagos)');

// ── Registrant: "complete your registration" ────────────────────────────────

export async function sendRegistrationReceivedEmail(to: string, fullName: string) {
  await sendSummitMail({
    to,
    subject: 'Complete your Elevation Summit registration',
    html: brandedEmailLayout({
      preheader: 'One step left. Complete payment to secure your place.',
      eyebrow: 'Elevation Summit · 19 November 2026',
      heading: 'Complete your registration.',
      recipient: to,
      content:
        p(`Hi ${esc(fullName)},`) +
        p('Thank you for registering for the Elevation Summit, 19 November 2026, Lagos.') +
        p('<strong>Your spot is not yet confirmed.</strong> Complete your payment to secure your place. Your ticket will be emailed to you as soon as payment is confirmed.') +
        goldButton('Complete Your Registration →', `${SUMMIT_URL}#register`) +
        p('<span style="color:#9CA3AF;font-size:13px;">If you have already paid, you can ignore this email. Your confirmation and ticket will arrive shortly.</span>'),
    }),
  });
}

// ── Registrant: payment reminder (sent by an admin) ─────────────────────────

export async function sendPaymentReminderEmail(to: string, fullName: string, attendanceType: string | null, amountNaira: number) {
  const isVirtual = attendanceType === 'virtual';
  await sendSummitMail({
    to,
    subject: 'Your Elevation Summit spot is waiting: complete your payment',
    html: brandedEmailLayout({
      preheader: 'Your registration is saved but not confirmed yet.',
      eyebrow: 'Elevation Summit · 19 November 2026',
      heading: 'Your spot is not confirmed yet.',
      recipient: to,
      content:
        p(`Hi ${esc(fullName)},`) +
        p(`You registered for the Elevation Summit (${isVirtual ? 'virtual' : 'physical'} attendance), but we have not received your payment, so your place is <strong>not confirmed</strong>.`) +
        summaryBox(
          summaryRow('Attendance', isVirtual ? 'Virtual' : 'Physical, Lagos') +
          summaryRow('Date', '19 November 2026') +
          summaryRow('Ticket', naira(amountNaira)) +
          summaryRow('Status', '<span style="color:#C8A96E;">Awaiting payment</span>')
        ) +
        p('It takes about a minute. Your details are already saved, so you only need to complete payment. Your ticket is emailed to you the moment it goes through.') +
        goldButton('Complete your payment →', `${SUMMIT_URL}#register`) +
        p('<span style="color:#9CA3AF;font-size:13px;">If you have already paid, please reply to this email with your Paystack receipt and we will confirm you right away.</span>'),
    }),
  });
}

// ── Registrant: payment confirmed + ticket PDF ──────────────────────────────

export async function sendPaymentConfirmedEmail(ticketData: TicketData) {
  const { email, fullName, attendanceType } = ticketData;
  const isVirtual = attendanceType === 'virtual';
  const attendanceBlock = isVirtual
    ? p('Your Zoom link for the virtual session will be shared with you separately closer to the event date. Keep an eye on your inbox.')
    : p('Venue details will follow closer to the event date.');

  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await generateSummitTicket(ticketData);
  } catch (err) {
    console.error('[summitTicket] PDF generation failed:', err);
  }

  await sendSummitMail({
    to: email,
    subject: 'Your Elevation Summit registration is confirmed',
    html: brandedEmailLayout({
      preheader: 'Your payment is confirmed. Your ticket is attached.',
      eyebrow: 'Elevation Summit · 19 November 2026',
      heading: "You're confirmed.",
      recipient: email,
      content:
        p(`Hi ${esc(fullName)},`) +
        p(`Your payment has been received and your <strong>${isVirtual ? 'virtual' : 'onsite'} place</strong> at the Elevation Summit is confirmed. ${pdfBuffer ? 'Your admission ticket is attached to this email as a PDF.' : 'Your admission ticket will follow shortly.'}`) +
        summaryBox(
          summaryRow('Attendance', isVirtual ? 'Virtual' : 'Onsite, Lagos') +
          summaryRow('Date', '19 November 2026') +
          summaryRow('Amount', naira(ticketData.amountPaid)) +
          summaryRow('Status', '<span style="color:#C8A96E;">Confirmed &amp; Paid</span>')
        ) +
        attendanceBlock +
        p('Please keep your ticket safe and present it on the day of the event. We look forward to seeing you there.') +
        goldButton('View Event Details →', SUMMIT_URL),
    }),
    ...(pdfBuffer ? {
      attachments: [{
        filename: 'Elevation-Summit-2026-Ticket.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf',
      }],
    } : {}),
  });
}

// ── Admin: paid registration (name, email, phone, virtual/physical) ─────────

export interface AdminPaidInfo {
  fullName: string;
  email: string;
  phone: string;
  attendanceType: string | null;
  organisation?: string | null;
  amountPaid: number;
  reference: string;
}

export async function sendAdminPaymentNotification(i: AdminPaidInfo) {
  await sendSummitMail({
    to: SUMMIT_ADMIN_EMAIL,
    subject: `Paid registration: ${i.fullName} (${i.attendanceType === 'virtual' ? 'Virtual' : 'Physical'})`,
    html: brandedEmailLayout({
      preheader: `${i.fullName} has paid and is confirmed.`,
      eyebrow: 'Admin Notification',
      heading: 'New paid registration.',
      recipient: SUMMIT_ADMIN_EMAIL,
      content:
        p('A registration has been paid and confirmed for the Elevation Summit.') +
        summaryBox(
          summaryRow('Name', esc(i.fullName)) +
          summaryRow('Email', esc(i.email)) +
          summaryRow('Phone', esc(i.phone) || '<span style="color:#EF4444;">not captured</span>') +
          summaryRow('Attendance', typeLabel(i.attendanceType)) +
          summaryRow('Company', esc(i.organisation || '') || '-') +
          summaryRow('Amount', naira(i.amountPaid)) +
          summaryRow('Reference', esc(i.reference))
        ) +
        goldButton('Open registrations', 'https://ascentorbi.com/admin/summit'),
    }),
  });
}

// ── Admin: registered but did not finish payment ────────────────────────────

export interface AdminAbandonedInfo {
  fullName: string;
  email: string;
  phone: string;
  attendanceType: string | null;
  amount: number;
  reference: string;
}

export async function sendAdminAbandonedNotification(i: AdminAbandonedInfo) {
  await sendSummitMail({
    to: SUMMIT_ADMIN_EMAIL,
    subject: `Payment not completed: ${i.fullName} (${i.attendanceType === 'virtual' ? 'Virtual' : 'Physical'})`,
    html: brandedEmailLayout({
      preheader: `${i.fullName} registered but did not finish paying.`,
      eyebrow: 'Admin Notification',
      heading: 'Registration not completed.',
      recipient: SUMMIT_ADMIN_EMAIL,
      content:
        p('This person registered for the Elevation Summit but left before finishing payment. They have been sent a "complete your registration" email. You may want to call or text them.') +
        summaryBox(
          summaryRow('Name', esc(i.fullName)) +
          summaryRow('Email', esc(i.email)) +
          summaryRow('Phone', esc(i.phone) || '<span style="color:#EF4444;">not captured</span>') +
          summaryRow('Attendance', typeLabel(i.attendanceType)) +
          summaryRow('Ticket price', naira(i.amount)) +
          summaryRow('Reference', esc(i.reference))
        ) +
        goldButton('Open registrations', 'https://ascentorbi.com/admin/summit'),
    }),
  });
}

// ── Paid emails with delivery tracking (used by settlement, retry & resend) ─

/** Best-effort: silently ignored if the tracking columns have not been migrated yet. */
async function markRegistration(id: string, patch: Record<string, unknown>) {
  try {
    await supabaseAdmin.from('summit_registrations').update(patch).eq('id', id);
  } catch { /* tracking is optional */ }
}

/**
 * Sends the customer confirmation (+ticket) and the admin alert INDEPENDENTLY
 * so one failing never blocks the other, and records what was delivered.
 * Never throws.
 */
export async function deliverPaidEmails(
  reg: Record<string, any>,
  amountPaid: number,
  currency: string,
  reference: string,
  only: { customer?: boolean; admin?: boolean } = { customer: true, admin: true },
): Promise<{ customer: boolean | null; admin: boolean | null }> {
  const out: { customer: boolean | null; admin: boolean | null } = { customer: null, admin: null };

  if (only.customer) {
    try {
      await sendPaymentConfirmedEmail({
        email:          reg.email,
        fullName:       reg.full_name,
        whatsapp:       reg.whatsapp ?? '',
        organisation:   reg.organisation ?? '',
        attendanceType: reg.attendance_type === 'virtual' ? 'virtual' : 'onsite',
        amountPaid,
        currency,
        registrationId: String(reg.id),
        reference,
      });
      out.customer = true;
      await markRegistration(reg.id, { confirmation_email_sent_at: new Date().toISOString(), confirmation_email_error: null });
    } catch (err) {
      out.customer = false;
      console.error('[summitEmails] customer confirmation failed:', err);
      await markRegistration(reg.id, { confirmation_email_error: String((err as Error).message).slice(0, 300) });
    }
  }

  if (only.admin) {
    try {
      await sendAdminPaymentNotification({
        fullName: reg.full_name,
        email: reg.email,
        phone: reg.whatsapp ?? '',
        attendanceType: reg.attendance_type,
        organisation: reg.organisation,
        amountPaid,
        reference,
      });
      out.admin = true;
      await markRegistration(reg.id, { admin_notified_paid_at: new Date().toISOString() });
    } catch (err) {
      out.admin = false;
      console.error('[summitEmails] admin paid notification failed:', err);
    }
  }
  return out;
}
