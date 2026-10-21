// lib/adminAlerts.ts
// Short alert emails to the team: a new member confirmed their account, someone registered for a public event.
// Always best effort: an alert that cannot be sent (mail not configured, mailbox down) never blocks the visitor.
// The recipient is ADMIN_ALERT_EMAIL, falling back to the contact mailbox.

import { sendEmail } from '@/lib/nodemailer';
import { CONTACT_EMAIL } from '@/lib/contact';
import { brandedEmailLayout, esc, p, goldButton, summaryRow, summaryBox } from '@/lib/emailTemplate';

const TO = process.env.ADMIN_ALERT_EMAIL || CONTACT_EMAIL;
const BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://joinascentor.com').replace(/\/+$/, '');

async function send(subject: string, eyebrow: string, heading: string, content: string) {
  try {
    await sendEmail({ to: TO, subject, html: brandedEmailLayout({ preheader: subject, eyebrow, heading, recipient: TO, content }) });
  } catch (e) {
    console.warn('[admin alert] not sent:', (e as Error).message);
  }
}

export async function alertNewMember(info: { email: string; name?: string | null }) {
  await send(
    `New member: ${info.name || info.email}`,
    'Admin Notification',
    'A new member joined.',
    p('Someone confirmed their Ascentor account.') +
      summaryBox(summaryRow('Name', esc(info.name || '-')) + summaryRow('Email', esc(info.email))) +
      goldButton('Open members', `${BASE}/admin/c/members`),
  );
}

export async function alertEventRegistration(info: { eventTitle: string; name: string; email: string; whatsapp?: string | null; country?: string | null }) {
  await send(
    `Event registration: ${info.name} for ${info.eventTitle}`,
    'Admin Notification',
    'New event registration.',
    p(`Someone registered for ${esc(info.eventTitle)}.`) +
      summaryBox(
        summaryRow('Event', esc(info.eventTitle)) +
        summaryRow('Name', esc(info.name)) +
        summaryRow('Email', esc(info.email)) +
        summaryRow('WhatsApp', esc(info.whatsapp || '-')) +
        summaryRow('Country', esc(info.country || '-')),
      ) +
      goldButton('Open public events', `${BASE}/admin/c/events`),
  );
}
