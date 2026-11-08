import 'server-only';
// Custom emails to Summit registrants. Sends a few at a time (the mailbox has a sending limit), in a stable order, so the admin
// page can drive it chunk by chunk and a closed tab never half-sends one chunk.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { SUMMIT_FROM, SUMMIT_REPLY_TO } from '@/lib/contact';
import { brandedEmailLayout, esc, goldButton } from '@/lib/emailTemplate';
import { sendEmail, getMailer } from '@/lib/nodemailer';

export type Audience = 'all' | 'physical' | 'virtual';
export const CHUNK = 4;

function base(audience: Audience) {
  let q = supabaseAdmin.from('summit_registrations').select('email, full_name', { count: 'exact' }).eq('payment_status', 'paid');
  if (audience === 'virtual') q = q.eq('attendance_type', 'virtual');
  if (audience === 'physical') q = q.neq('attendance_type', 'virtual');
  return q.order('created_at', { ascending: true }).order('id', { ascending: true });
}

export async function countAudience(audience: Audience): Promise<number> {
  const { count } = await base(audience).range(0, 0);
  return count ?? 0;
}

function html(name: string, message: string, to: string) {
  return brandedEmailLayout({
    preheader: 'An update from The Elevation Summit.',
    eyebrow: 'The Elevation Summit · 2026',
    heading: `Hi ${esc(name)},`,
    recipient: to,
    content: `<p style="margin:0 0 16px;">${esc(message).replace(/\n/g, '<br>')}</p>` + goldButton('View Summit details →', 'https://joinascentor.com/elevation-summit'),
  });
}

export async function sendCustomTo(email: string, fullName: string, subject: string, message: string): Promise<void> {
  const first = (fullName || 'there').trim().split(/\s+/)[0];
  await sendEmail({ from: SUMMIT_FROM, replyTo: SUMMIT_REPLY_TO, to: email, subject, html: html(first, message.replace(/\{name\}/gi, first), email) });
}

export async function sendCustomChunk(audience: Audience, subject: string, message: string, cursor: number, gapMs = 1200) {
  if (!getMailer()) throw new Error('Email is not set up (SMTP credentials are missing).');
  const { data, count } = await base(audience).range(cursor, cursor + CHUNK - 1);
  const rows = data ?? [];
  let sent = 0, failed = 0;
  for (const r of rows) {
    try { await sendCustomTo(r.email as string, r.full_name as string, subject, message); sent++; } catch { failed++; }
    await new Promise((res) => setTimeout(res, gapMs));
  }
  const next = cursor + rows.length;
  return { sent, failed, next, total: count ?? next, done: rows.length < CHUNK || next >= (count ?? next) };
}
