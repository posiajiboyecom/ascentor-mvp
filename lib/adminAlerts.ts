// lib/adminAlerts.ts
// Short alert emails to the team: a new member confirmed their account, someone registered for a public event.
// Always best effort: an alert that cannot be sent (mail not configured, mailbox down) never blocks the visitor.
// The recipient is ADMIN_ALERT_EMAIL, falling back to the team mailbox (ADMIN_NOTIFY_EMAIL).

import { sendEmail } from '@/lib/nodemailer';
import { adminNotifyEmail } from '@/lib/contact';
import { brandedEmailLayout, esc, p, goldButton, summaryRow, summaryBox } from '@/lib/emailTemplate';

const TO = adminNotifyEmail(process.env.ADMIN_ALERT_EMAIL);
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

/** Daily: Circles still forming after 48 hours with nowhere to merge (lib/rx/formation.ts). Sent to the team, not to members' bells. */
export async function alertCirclesWaiting(names: string[]) {
  const n = names.length;
  await send(
    `${n} ${n === 1 ? 'Circle is' : 'Circles are'} still forming after 48 hours`,
    'Admin Notification',
    `${n} ${n === 1 ? 'Circle needs' : 'Circles need'} a hand.`,
    p('These have fewer than 3 members and no matching Circle with room, usually because of a different language. New members still fill them first. You can move members or invite more.') +
      summaryBox(names.slice(0, 20).map((name, i) => summaryRow(String(i + 1), esc(name))).join('')) +
      goldButton('Open Circles', `${BASE}/admin/c/circles`),
  );
}
