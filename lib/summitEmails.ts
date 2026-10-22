import { getMailer, sendEmail } from './nodemailer';
import { CONTACT_EMAIL, FROM_DEFAULT, SUMMIT_EMAIL } from './contact';
import { brandedEmailLayout, esc, p, goldButton, summaryRow, summaryBox } from './emailTemplate';
import { generateSummitTicket, type TicketData } from './summitTicket';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { SUMMIT_DATE_LABEL, SUMMIT_DATETIME_LABEL } from '@/lib/elevationSummit';

const SUMMIT_URL = 'https://joinascentor.com/elevation-summit';
const SUMMIT_WATCH_URL = `${SUMMIT_URL}/watch`;
const DONATE_URL = 'https://joinascentor.com/donate';
const ATTEND_URL = `${SUMMIT_URL}/attend`;

/** "Make your I will be attending flyer" block for the confirmation emails. The name is passed so the flyer page starts filled in. */
const flyerBlock = (fullName: string) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;background-color:#FAFAF8;border:1px solid #F0EDE6;border-radius:10px;">
    <tr><td style="padding:18px 20px;">
      <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#0F0F0E;">Tell people you are coming</p>
      <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#6B7280;">Make your own &quot;I will be attending&quot; flyer with your name and photo, download it and share it.</p>
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="background-color:#0F0F0E;border-radius:8px;">
          <a href="${ATTEND_URL}?n=${encodeURIComponent(fullName.trim().slice(0, 40))}" target="_blank" style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#FFFFFF;text-decoration:none;">Make my flyer</a>
        </td>
      </tr></table>
    </td></tr>
  </table>`;

/** Where every Summit admin alert goes. Deliberately NOT ADMIN_EMAIL, which may point elsewhere. */
export const SUMMIT_ADMIN_EMAIL = process.env.SUMMIT_ADMIN_EMAIL || CONTACT_EMAIL;

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
  if (!getMailer()) throw new Error('No SMTP credentials configured (set SMTP_USER and SMTP_PASS)');
  // The Summit shares the main mailbox. sendEmail retries as the mailbox itself if the host refuses the From address.
  await sendEmail({ from: process.env.SUMMIT_MAIL_FROM || FROM_DEFAULT, replyTo: SUMMIT_EMAIL, ...opts });
}

const naira = (n: number) => `₦${Number(n).toLocaleString('en-NG')}`;
const typeLabel = (t: string | null | undefined) => (t === 'virtual' ? 'Virtual' : 'Physical (Onsite, Lagos)');

// ── Registrant: reminder to complete a saved, unconfirmed registration
// (legacy: only reaches people who registered before registration became
// free; resubmitting the form confirms them immediately, at no cost) ───────

export async function sendPaymentReminderEmail(to: string, fullName: string, attendanceType: string | null) {
  const isVirtual = attendanceType === 'virtual';
  await sendSummitMail({
    to,
    subject: 'Your Elevation Summit spot is waiting for you',
    html: brandedEmailLayout({
      preheader: 'Your registration is saved but not confirmed yet.',
      eyebrow: 'Elevation Summit · 19 November 2026',
      heading: 'Your spot is not confirmed yet.',
      recipient: to,
      content:
        p(`Hi ${esc(fullName)},`) +
        p(`You registered for the Elevation Summit (${isVirtual ? 'virtual' : 'physical'} attendance), but your registration is not yet confirmed, so your place is <strong>not secured</strong>.`) +
        summaryBox(
          summaryRow('Attendance', isVirtual ? 'Virtual' : 'Physical, Lagos') +
          summaryRow('Date', '19 November 2026') +
          summaryRow('Status', '<span style="color:#C8A96E;">Awaiting confirmation</span>')
        ) +
        p('Registration is free. It takes about a minute, your details are already saved, so you only need to confirm your spot. Your ticket is emailed to you the moment it is confirmed.') +
        goldButton('Confirm Your Spot →', `${SUMMIT_URL}#register`),
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
      preheader: 'Your registration is confirmed. Your ticket is attached.',
      eyebrow: 'Elevation Summit · 19 November 2026',
      heading: "You're confirmed.",
      recipient: email,
      content:
        p(`Hi ${esc(fullName)},`) +
        p(`Your <strong>${isVirtual ? 'virtual' : 'onsite'} place</strong> at the Elevation Summit is confirmed. ${pdfBuffer ? 'Your admission ticket is attached to this email as a PDF.' : 'Your admission ticket will follow shortly.'}`) +
        summaryBox(
          summaryRow('Attendance', isVirtual ? 'Virtual' : 'Onsite, Lagos') +
          summaryRow('Date', '19 November 2026') +
          summaryRow('Amount', ticketData.amountPaid > 0 ? naira(ticketData.amountPaid) : 'Free') +
          summaryRow('Status', '<span style="color:#C8A96E;">Confirmed</span>')
        ) +
        attendanceBlock +
        p('Please keep your ticket safe and present it on the day of the event. We look forward to seeing you there.') +
        flyerBlock(fullName) +
        goldButton('View Event Details →', SUMMIT_URL) +
        p(`Registration is free. If the Summit has been valuable to you, you can <a href="${DONATE_URL}" style="color:#C8A96E;font-weight:600;text-decoration:underline;">support it with a donation</a>.`),
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

// ── Registrant: virtual livestream access (sent by an admin) ────────────────

export async function sendStreamAccessEmail(to: string, fullName: string) {
  await sendSummitMail({
    to,
    subject: 'Your Elevation Summit livestream link',
    html: brandedEmailLayout({
      preheader: `Everything you need to join the livestream on ${SUMMIT_DATE_LABEL}.`,
      eyebrow: `Elevation Summit · ${SUMMIT_DATE_LABEL}`,
      heading: "You're all set to watch.",
      recipient: to,
      content:
        p(`Hi ${esc(fullName)},`) +
        p(`Your virtual place at the Elevation Summit is confirmed. Save this link now, and use it on ${esc(SUMMIT_DATETIME_LABEL)} to watch the livestream.`) +
        goldButton('Open the livestream page →', SUMMIT_WATCH_URL) +
        flyerBlock(fullName) +
        p(`You'll be asked for the email address you registered with (<strong>${esc(to)}</strong>). That's how we confirm your ticket, no password needed.`) +
        p(`<span style="color:#9CA3AF;font-size:13px;">The page will show a countdown until the programme starts, then open the stream automatically. On the morning of the event we'll also send you a reminder with this same link.</span>`),
    }),
  });
}

// ── Registrant: event-day reminder, sent by the morning-of cron ─────────────
// Virtual attendees get the watch-page link. Physical attendees get NO link
// at all: they are attending in person, not remotely.

export async function sendEventDayVirtualEmail(to: string, fullName: string) {
  await sendSummitMail({
    to,
    subject: "Today's the day: The Elevation Summit livestream",
    html: brandedEmailLayout({
      preheader: `The livestream opens today, ${SUMMIT_DATETIME_LABEL}.`,
      eyebrow: `Elevation Summit · Today`,
      heading: 'Today is the day.',
      recipient: to,
      content:
        p(`Hi ${esc(fullName)},`) +
        p(`The Elevation Summit begins today, <strong>${esc(SUMMIT_DATETIME_LABEL)}</strong>. Use the link below to join the livestream.`) +
        goldButton('Open the livestream →', SUMMIT_WATCH_URL) +
        p("You will be asked for the email address you registered with. Keep this email handy in case you need the link again.") +
        p('<span style="color:#9CA3AF;font-size:13px;">We look forward to having you with us today.</span>'),
    }),
  });
}

export async function sendEventDayPhysicalEmail(to: string, fullName: string) {
  await sendSummitMail({
    to,
    subject: "Today's the day: The Elevation Summit",
    html: brandedEmailLayout({
      preheader: `See you today, ${SUMMIT_DATETIME_LABEL}.`,
      eyebrow: `Elevation Summit · Today`,
      heading: 'Today is the day.',
      recipient: to,
      content:
        p(`Hi ${esc(fullName)},`) +
        p(`The Elevation Summit begins today, <strong>${esc(SUMMIT_DATETIME_LABEL)}</strong>. We look forward to seeing you at the venue.`) +
        p('Please bring a valid form of identification and arrive with enough time to check in before the programme starts.') +
        p('<span style="color:#9CA3AF;font-size:13px;">See you soon.</span>'),
    }),
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
  const isFree = !(i.amountPaid > 0);
  await sendSummitMail({
    to: SUMMIT_ADMIN_EMAIL,
    subject: `New registration: ${i.fullName} (${i.attendanceType === 'virtual' ? 'Virtual' : 'Physical'})`,
    html: brandedEmailLayout({
      preheader: `${i.fullName} is confirmed.`,
      eyebrow: 'Admin Notification',
      heading: 'New confirmed registration.',
      recipient: SUMMIT_ADMIN_EMAIL,
      content:
        p('A new registration has been confirmed for the Elevation Summit.') +
        summaryBox(
          summaryRow('Name', esc(i.fullName)) +
          summaryRow('Email', esc(i.email)) +
          summaryRow('Phone', esc(i.phone) || '<span style="color:#EF4444;">not captured</span>') +
          summaryRow('Attendance', typeLabel(i.attendanceType)) +
          summaryRow('Company', esc(i.organisation || '') || '-') +
          summaryRow('Amount', isFree ? 'Free' : naira(i.amountPaid)) +
          (i.reference ? summaryRow('Reference', esc(i.reference)) : '')
        ) +
        goldButton('Open registrations', 'https://joinascentor.com/admin/elevation-summit/registrations'),
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

// ── Complimentary ticket (admin-issued, no payment taken) ──────────────────
// Used by the "Send ticket" admin action for a registrant the team wants to
// let in without going through Paystack. Same PDF ticket as a paid
// confirmation, different copy (never claims a payment was received).

export async function sendComplimentaryTicketEmail(ticketData: TicketData) {
  const { email, fullName, attendanceType } = ticketData;
  const isVirtual = attendanceType === 'virtual';

  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await generateSummitTicket(ticketData);
  } catch (err) {
    console.error('[summitTicket] PDF generation failed:', err);
  }

  await sendSummitMail({
    to: email,
    subject: 'Your Elevation Summit ticket is confirmed',
    html: brandedEmailLayout({
      preheader: 'Your ticket is attached.',
      eyebrow: 'Elevation Summit · 19 November 2026',
      heading: "You're confirmed.",
      recipient: email,
      content:
        p(`Hi ${esc(fullName)},`) +
        p(`Your <strong>${isVirtual ? 'virtual' : 'onsite'} place</strong> at the Elevation Summit is confirmed. ${pdfBuffer ? 'Your admission ticket is attached to this email as a PDF.' : 'Your admission ticket will follow shortly.'}`) +
        summaryBox(
          summaryRow('Attendance', isVirtual ? 'Virtual' : 'Onsite, Lagos') +
          summaryRow('Date', '19 November 2026') +
          summaryRow('Status', '<span style="color:#C8A96E;">Confirmed, Complimentary</span>')
        ) +
        (isVirtual
          ? p('Your Zoom link for the virtual session will be shared with you separately closer to the event date. Keep an eye on your inbox.')
          : p('Venue details will follow closer to the event date.')) +
        p('Please keep your ticket safe and present it on the day of the event. We look forward to seeing you there.') +
        flyerBlock(fullName) +
        goldButton('View Event Details →', SUMMIT_URL) +
        p(`Registration is free. If the Summit has been valuable to you, you can <a href="${DONATE_URL}" style="color:#C8A96E;font-weight:600;text-decoration:underline;">support it with a donation</a>.`),
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

/** Sends a complimentary ticket to a registration that has not paid, and tracks delivery. Never throws. */
export async function deliverCompTicket(reg: Record<string, any>): Promise<boolean> {
  try {
    await sendComplimentaryTicketEmail({
      email:          reg.email,
      fullName:       reg.full_name,
      whatsapp:       reg.whatsapp ?? '',
      organisation:   reg.organisation ?? '',
      attendanceType: reg.attendance_type === 'virtual' ? 'virtual' : 'onsite',
      amountPaid:     0,
      currency:       reg.currency || 'NGN',
      registrationId: String(reg.id),
    });
    await markRegistration(reg.id, { confirmation_email_sent_at: new Date().toISOString(), confirmation_email_error: null });
    return true;
  } catch (err) {
    console.error('[summitEmails] complimentary ticket failed:', err);
    await markRegistration(reg.id, { confirmation_email_error: String((err as Error).message).slice(0, 300) });
    return false;
  }
}

// ── Donations (/donate page) ────────────────────────────────────────────────
// Captured through the same payment_attempts + settleReference flow as Summit
// tickets and subscriptions (kind = 'donation'), settled exactly once.

export interface DonationReceiptInfo {
  full_name: string;
  email:     string;
  amount:    number;
  currency:  string;
  reference: string;
}

export async function sendDonationReceiptEmail(d: DonationReceiptInfo) {
  await sendSummitMail({
    to: d.email,
    subject: 'Thank you for your donation to Ascentor',
    html: brandedEmailLayout({
      preheader: 'Your donation has been received. Thank you for standing with us.',
      eyebrow: 'Ascentor · The Elevation Summit',
      heading: 'Thank you for your generosity.',
      recipient: d.email,
      content:
        p(`Hi ${esc(d.full_name)},`) +
        p('We have received your donation in support of Ascentor and The Elevation Summit. Every contribution helps us build the room and the community for the next generation of purposeful leaders.') +
        summaryBox(
          summaryRow('Amount', naira(d.amount)) +
          summaryRow('Reference', esc(d.reference)) +
          summaryRow('Status', '<span style="color:#C8A96E;">Received</span>')
        ) +
        p('This email serves as your receipt. Thank you for standing with us.') +
        goldButton('Visit The Elevation Summit →', SUMMIT_URL),
    }),
  });
}

export interface AdminDonationInfo {
  fullName: string;
  email:    string;
  phone:    string;
  amount:   number;
  reference: string;
  message?: string | null;
}

export async function sendAdminDonationNotification(i: AdminDonationInfo) {
  await sendSummitMail({
    to: SUMMIT_ADMIN_EMAIL,
    subject: `New donation received: ${naira(i.amount)} from ${i.fullName}`,
    html: brandedEmailLayout({
      preheader: `${i.fullName} donated ${naira(i.amount)}.`,
      eyebrow: 'Admin Notification',
      heading: 'New donation received.',
      recipient: SUMMIT_ADMIN_EMAIL,
      content:
        p('A new donation has been received through the donate page.') +
        summaryBox(
          summaryRow('Name', esc(i.fullName)) +
          summaryRow('Email', esc(i.email)) +
          summaryRow('Phone', esc(i.phone) || '<span style="color:#EF4444;">not captured</span>') +
          summaryRow('Amount', naira(i.amount)) +
          summaryRow('Reference', esc(i.reference)) +
          (i.message ? summaryRow('Message', esc(i.message)) : '')
        ) +
        goldButton('Open donations', 'https://joinascentor.com/admin/summit-donations'),
    }),
  });
}

/** Best-effort: silently ignored if the tracking columns have not been migrated yet. */
async function markDonation(id: string, patch: Record<string, unknown>) {
  try {
    await supabaseAdmin.from('summit_donations').update(patch).eq('id', id);
  } catch { /* tracking is optional */ }
}

/**
 * Sends the donor receipt and the admin alert INDEPENDENTLY so one failing
 * never blocks the other, and records what was delivered. Never throws.
 */
export async function deliverDonationEmails(
  donation: Record<string, any>,
): Promise<{ donor: boolean | null; admin: boolean | null }> {
  const out: { donor: boolean | null; admin: boolean | null } = { donor: null, admin: null };

  try {
    await sendDonationReceiptEmail({
      full_name: donation.full_name,
      email:     donation.email,
      amount:    Number(donation.amount) || 0,
      currency:  donation.currency || 'NGN',
      reference: donation.payment_reference || '',
    });
    out.donor = true;
    await markDonation(donation.id, { receipt_email_sent_at: new Date().toISOString(), receipt_email_error: null });
  } catch (err) {
    out.donor = false;
    console.error('[summitEmails] donation receipt failed:', err);
    await markDonation(donation.id, { receipt_email_error: String((err as Error).message).slice(0, 300) });
  }

  try {
    await sendAdminDonationNotification({
      fullName: donation.full_name,
      email:    donation.email,
      phone:    donation.phone,
      amount:   Number(donation.amount) || 0,
      reference: donation.payment_reference || '',
      message:  donation.message,
    });
    out.admin = true;
    await markDonation(donation.id, { admin_notified_at: new Date().toISOString() });
  } catch (err) {
    out.admin = false;
    console.error('[summitEmails] admin donation notification failed:', err);
  }

  return out;
}
