import { summitMailer } from './nodemailer';
import { brandedEmailLayout, esc, p, goldButton, summaryRow, summaryBox } from './emailTemplate';
import { generateSummitTicket, type TicketData } from './summitTicket';

const SUMMIT_URL = 'https://ascentorbi.com/elevation-summit';

// ---------------------------------------------------------------------------

export async function sendRegistrationReceivedEmail(to: string, fullName: string) {
  await summitMailer.sendMail({
    from: process.env.SUMMIT_MAIL_FROM,
    to,
    subject: 'We received your Elevation Summit registration',
    html: brandedEmailLayout({
      preheader: 'One step left — complete payment to secure your place.',
      eyebrow: 'Elevation Summit · 19 November 2026',
      heading: 'Registration received.',
      recipient: to,
      content:
        p(`Hi ${esc(fullName)},`) +
        p('We have received your registration for the Elevation Summit, 19 November 2026, Lagos.') +
        p('<strong>Your spot is not yet confirmed.</strong> Complete payment to secure your place.') +
        goldButton('Complete Your Registration →', `${SUMMIT_URL}#register`),
    }),
  });
}

export async function sendPaymentConfirmedEmail(ticketData: TicketData) {
  const { email, fullName, attendanceType } = {
    email:          ticketData.email,
    fullName:       ticketData.fullName,
    attendanceType: ticketData.attendanceType,
  };
  const isVirtual = attendanceType === 'virtual';
  const attendanceBlock = isVirtual
    ? p('Your Zoom link for the virtual session will be shared with you separately closer to the event date. Keep an eye on your inbox.')
    : p('Venue details will follow closer to the event date.');

  // Generate branded PDF ticket
  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await generateSummitTicket(ticketData);
  } catch (err) {
    console.error('[summitTicket] PDF generation failed:', err);
  }

  await summitMailer.sendMail({
    from: process.env.SUMMIT_MAIL_FROM,
    to: email,
    subject: 'Your Elevation Summit registration is confirmed',
    html: brandedEmailLayout({
      preheader: 'Your payment is confirmed. Your ticket is attached.',
      eyebrow: 'Elevation Summit · 19 November 2026',
      heading: "You're confirmed.",
      recipient: email,
      content:
        p(`Hi ${esc(fullName)},`) +
        p(`Your payment has been received and your <strong>${isVirtual ? 'virtual' : 'onsite'} place</strong> at the Elevation Summit is confirmed. Your admission ticket is attached to this email as a PDF.`) +
        summaryBox(
          summaryRow('Attendance', isVirtual ? 'Virtual' : 'Onsite, Lagos') +
          summaryRow('Date', '19 November 2026') +
          summaryRow('Amount', `\u20a6${ticketData.amountPaid.toLocaleString('en-NG')}`) +
          summaryRow('Status', '<span style="color:#C8A96E;">Confirmed &amp; Paid</span>')
        ) +
        attendanceBlock +
        p('Please keep your ticket safe and present it on the day of the event. We look forward to seeing you there.') +
        goldButton('View Event Details →', SUMMIT_URL),
    }),
    ...(pdfBuffer ? {
      attachments: [
        {
          filename: 'Elevation-Summit-2026-Ticket.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    } : {}),
  });
}

export async function sendAdminPaymentNotification(fullName: string, email: string, organisation: string) {
  const adminEmail = process.env.ADMIN_EMAIL ?? '';
  await summitMailer.sendMail({
    from: process.env.SUMMIT_MAIL_FROM,
    to: adminEmail,
    subject: `Paid registration confirmed: ${fullName}`,
    html: brandedEmailLayout({
      preheader: `New paid registration: ${fullName}`,
      eyebrow: 'Admin Notification',
      heading: 'New paid registration.',
      recipient: adminEmail,
      content:
        p('A new paid registration has been confirmed for the Elevation Summit.') +
        summaryBox(
          summaryRow('Name', esc(fullName)) +
          summaryRow('Email', esc(email)) +
          summaryRow('Company', esc(organisation) || '—')
        ),
    }),
  });
}
