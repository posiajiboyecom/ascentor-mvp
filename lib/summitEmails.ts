import { summitMailer, getMailer } from './nodemailer';
import { brandedEmailLayout, esc, p, goldButton, summaryRow, summaryBox } from './emailTemplate';
import { generateSummitTicket, type TicketData } from './summitTicket';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { SUMMIT_DATE_LABEL, SUMMIT_DATETIME_LABEL } from '@/lib/elevationSummit';

const SUMMIT_URL = 'https://ascentorbi.com/elevation-summit';
const SUMMIT_WATCH_URL = `${SUMMIT_URL}/watch`;

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
    subject: 'Secure your Elevation Summit registration',
    html: brandedEmailLayout({
      preheader: 'One step left. Secure your place.',
      eyebrow: 'Elevation Summit · 19 November 2026',
      heading: 'Secure your registration.',
      recipient: to,
      content:
        p(`Hi ${esc(fullName)},`) +
        p('Thank you for registering for the Elevation Summit, 19 November 2026, Lagos.') +
        p('<strong>Your spot is not yet confirmed.</strong> Secure your place to lock it in. Your ticket will be emailed to you as soon as your registration is confirmed.') +
        goldButton('Secure Your Registration →', `${SUMMIT_URL}#register`) +
        p('<span style="color:#9CA3AF;font-size:13px;">If you have already secured your spot, you can ignore this email. Your confirmation and ticket will arrive shortly.</span>'),
    }),
  });
}

// ── Registrant: reminder to secure a saved spot (sent by an admin) ──────────

export async function sendPaymentReminderEmail(to: string, fullName: string, attendanceType: string | null, amountNaira: number) {
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
          summaryRow('Ticket', naira(amountNaira)) +
          summaryRow('Status', '<span style="color:#C8A96E;">Awaiting confirmation</span>')
        ) +
        p('It takes about a minute. Your details are already saved, so you only need to secure your ticket. It is emailed to you the moment it is confirmed.') +
        goldButton('Secure Your Ticket →', `${SUMMIT_URL}#register`) +
        p('<span style="color:#9CA3AF;font-size:13px;">If you have already completed checkout, please reply to this email with your receipt and we will confirm you right away.</span>'),
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
          summaryRow('Amount', naira(ticketData.amountPaid)) +
          summaryRow('Status', '<span style="color:#C8A96E;">Confirmed</span>')
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
        goldButton('Open donations', 'https://ascentorbi.com/admin/summit-donations'),
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
