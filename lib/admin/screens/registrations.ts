// lib/admin/screens/registrations.ts
// Spec copied from the admin prototype (Elevation Summit · Registrations). The loader below is a placeholder until it reads real data.
// Prototype KPI tiles to compute for real: Registered (sample "[COUNT]"); Confirmed (sample "[COUNT]"); Physical (sample "[COUNT]"); Virtual (sample "[COUNT]")
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { deliverPaidEmails, deliverCompTicket, resendUnsentBatch, describeEmailFailure, sendReferralInviteEmail } from '@/lib/summitEmails';
import { count } from '@/lib/admin/revenue-util';
import { whatsappCsv, emailCsv, exportNote, toCsv, toIntlPhone } from '@/lib/admin/contact-csv';
import type { ScreenModule, ScreenSpec, ActionResult } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "registrations",
  group: "Elevation Summit",
  title: "Registrations",
  sub: "Thursday 19 November 2026 · Aderemi Makanjuola Hall, LASU, and online.",
  cols: [
    "Person",
    "Email",
    "Company / institution",
    "Ticket",
    "Registered",
    "Status"
  ],
  statusCol: 5,
  actions: [
    {
      id: "confirm-registration",
      label: "Confirm registration",
      col: 5,
      to: "Confirmed",
      when: "Not confirmed"
    },
    {
      id: "resend-ticket",
      label: "Resend ticket",
      when: ["Confirmed", "Ticket not sent"],
      done: "Ticket sent again.",
      keep: true
    }
  ],
  quick: 0,
  buttons: [
    {
      id: "email-everyone-not-yet-confirmed",
      label: "Email everyone not yet confirmed"
    },
    {
      id: "referrals",
      label: "Referrals",
      href: "/admin/c/registrations/referrals"
    },
    {
      id: "delivery",
      label: "Delivery and resend all",
      href: "/admin/c/registrations/delivery"
    },
    {
      id: "send-referral-invite",
      label: "Send referral invite email",
      confirm: "Send the referral program email to all confirmed registrants who haven't received it yet?"
    },
    {
      id: "export-whatsapp",
      label: "Export WhatsApp numbers",
      needs: "full"
    },
    {
      id: "export-emails",
      label: "Export emails",
      needs: "full"
    },
    {
      id: "export-list",
      label: "Export full list",
      needs: "full"
    }
  ]
};

const lagos = (iso: string | null | undefined) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' });
};
// attendance_type is a single choice (onsite | virtual), so there is no combined ticket.
const ticketOf = (t: string | null) => (t === 'virtual' ? 'Virtual' : 'Physical only');
const cellsOf = (r: any) => [r.full_name || '-', r.email || '-', r.organisation || '-', ticketOf(r.attendance_type), lagos(r.created_at), r.payment_status !== 'paid' ? 'Not confirmed' : r.confirmation_email_sent_at ? 'Confirmed' : 'Ticket not sent'];

const when = (iso: string | null | undefined) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Lagos' });
};
const money = (n: unknown, cur: string | null) => {
  const v = Number(n);
  if (n == null || !Number.isFinite(v)) return '-';
  return (cur && cur !== 'NGN' ? `${cur} ` : '₦') + v.toLocaleString('en-NG');
};
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '-');
const sent = (iso: string | null | undefined) => (iso ? `Sent ${when(iso)}` : 'Not sent');

const detailsOf = (r: any) => [
  { heading: 'Person', items: [['Full name', text(r.full_name)], ['Email', text(r.email)], ['Phone / WhatsApp', text(r.whatsapp)], ['City / country', text(r.location)]] as [string, string][] },
  { heading: 'Organisation', items: [['Company / institution', text(r.organisation)], ['Job title / role', text(r.current_role)]] as [string, string][] },
  {
    heading: 'Ticket and payment',
    items: [
      ['Attendance', r.attendance_type === 'virtual' ? 'Virtual' : 'Physical'], ['Ticket', text(r.ticket_type)], ['Registered', when(r.created_at)],
      ['Payment status', text(r.payment_status)], ['Amount', money(r.amount_paid, r.currency)], ['Reference', text(r.payment_reference)],
      ['Registration status', text(r.status)], ['Paid', when(r.paid_at)], ['Confirmed', when(r.confirmed_at)], ['Registered via', text(r.source)],
    ] as [string, string][],
  },
  {
    heading: 'Event day',
    items: [
      ['Confirmation email', sent(r.confirmation_email_sent_at)], ['Email attempts', `${r.confirmation_email_attempts ?? 0}${r.confirmation_email_error_code ? ` · last error ${r.confirmation_email_error_code}` : ''}`], ['Reminder email', r.reminder_sent_at ? `Sent ${when(r.reminder_sent_at)} (${r.reminder_count ?? 1})` : 'Not sent'],
      ['Event day email', sent(r.event_day_email_sent_at)], ...(r.attendance_type === 'virtual' ? [['Access link sent', sent(r.stream_access_sent_at)] as [string, string]] : []),
      ['Message from registrant', text(r.other_messages)], ['Notes', text(r.notes)],
    ] as [string, string][],
  },
];

const screen: ScreenModule = {
  spec,
  async load() {
    const { data, error } = await supabaseAdmin
      .from('summit_registrations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    const all = data ?? [];
    const confirmed = all.filter((r) => r.payment_status === 'paid');
    const physical = all.filter((r) => r.attendance_type !== 'virtual').length;
    return {
      rows: all.slice(0, 500).map((r) => ({ id: r.id, cells: cellsOf(r), details: detailsOf(r), contact: { name: r.full_name, phone: r.whatsapp, email: r.email } })),
      kpis: [
        { label: 'Registered', value: count(all.length) },
        { label: 'Confirmed', value: count(confirmed.length) },
        { label: 'Physical', value: count(physical) },
        { label: 'Virtual', value: count(all.length - physical) },
      ],
      note: all.length > 500 ? 'Showing the 500 newest. The tiles count everyone.' : undefined,
    };
  },

  async button(_ctx, buttonId): Promise<ActionResult> {
    if (buttonId === 'export-whatsapp' || buttonId === 'export-emails' || buttonId === 'export-list') {
      // Everyone, not just the 500 shown on screen. Pages of 1,000 until the table runs out.
      const all: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabaseAdmin.from('summit_registrations').select('*')
          .order('created_at', { ascending: false }).range(from, from + 999);
        if (error) return { ok: false, error: `Could not load registrations: ${error.message}` };
        all.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      if (!all.length) return { ok: false, error: 'There are no registrations to export yet.' };
      const day = new Date().toISOString().slice(0, 10);
      const people = all.map((r) => ({ name: r.full_name, phone: r.whatsapp, email: r.email }));

      if (buttonId === 'export-whatsapp') {
        const out = whatsappCsv(people, 'Elevation Summit');
        return { ok: true, message: exportNote('WhatsApp number', out), download: { filename: `elevation-summit-whatsapp-numbers-${day}.csv`, mime: 'text/csv;charset=utf-8', content: out.content } };
      }
      if (buttonId === 'export-emails') {
        const out = emailCsv(people);
        return { ok: true, message: exportNote('email', out), download: { filename: `elevation-summit-emails-${day}.csv`, mime: 'text/csv;charset=utf-8', content: out.content } };
      }
      const safe = (v: unknown) => { const t = v == null ? '' : String(v); return /^[=+\-@\t\r]/.test(t) ? `'${t}` : t; };
      const rows = all.map((r) => {
        const c = [
          r.full_name, r.email, '', r.location, r.organisation, r.current_role,
          r.attendance_type === 'virtual' ? 'Virtual' : 'Physical', r.payment_status === 'paid' ? 'Confirmed' : 'Not confirmed',
          r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : '', r.source,
        ].map(safe);
        c[2] = toIntlPhone(r.whatsapp) ?? ''; // digits and + only, so no formula guard needed
        return c;
      });
      const content = toCsv([['Name', 'Email', 'WhatsApp', 'City / country', 'Company / institution', 'Role', 'Ticket', 'Status', 'Registered', 'Registered via'], ...rows]);
      return { ok: true, message: `Exported ${rows.length} registration${rows.length === 1 ? '' : 's'}.`, download: { filename: `elevation-summit-registrations-${day}.csv`, mime: 'text/csv;charset=utf-8', content } };
    }

    if (buttonId === 'resend-all-unsent') {
      // A small batch per press (4 people, spaced out) keeps each press inside the page time limit and inside the mailbox's
      // sending limit. Press again to continue; people already sent are never picked up twice.
      const r = await resendUnsentBatch(4);
      if (r.stopped) return { ok: false, error: `Stopped after ${r.sent} sent. ${describeEmailFailure(r.stopped.kind, r.stopped.code)} ${r.remaining} still unsent.`, refresh: true };
      if (r.sent + r.failed === 0) return { ok: true, message: r.remaining === 0 ? 'Everyone has been sent their ticket.' : `Nothing to send right now (${r.remaining} are being sent by someone else). Try again in a minute.`, refresh: true };
      return { ok: true, message: `Sent ${r.sent}${r.failed ? `, ${r.failed} failed` : ''}. ${r.remaining === 0 ? 'Everyone has now been sent their ticket.' : `${r.remaining} still unsent. Press the button again to send the next batch.`}`, refresh: true };
    }

    if (buttonId === 'send-referral-invite') {
      // Send the referral program email to confirmed registrants who haven't received it yet.
      // Sends in batches of 10 per press to stay within page timeout and mailbox rate limits.
      const BATCH = 10;
      const { data: rows, error } = await supabaseAdmin
        .from('summit_registrations')
        .select('id, email, full_name, referral_code, attendance_type')
        .eq('payment_status', 'paid')
        .is('referral_invite_sent_at', null)
        .not('referral_code', 'is', null)
        .limit(BATCH);

      if (error) return { ok: false, error: `Could not load registrants: ${error.message}` };

      // Count how many remain after this batch
      const { count: totalRemaining } = await supabaseAdmin
        .from('summit_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('payment_status', 'paid')
        .is('referral_invite_sent_at', null)
        .not('referral_code', 'is', null);

      if (!rows || rows.length === 0) {
        return { ok: true, message: 'Everyone has already received the referral invite email.', refresh: true };
      }

      let sent = 0;
      let failed = 0;
      for (const row of rows) {
        try {
          // Claim the row to prevent double-send
          const { data: claimed } = await supabaseAdmin
            .from('summit_registrations')
            .update({ referral_invite_sent_at: new Date().toISOString() })
            .eq('id', row.id)
            .is('referral_invite_sent_at', null)
            .select('id')
            .maybeSingle();

          if (!claimed) continue; // another run already claimed it

          await sendReferralInviteEmail({
            to: row.email as string,
            fullName: (row.full_name as string) ?? 'there',
            referralCode: row.referral_code as string,
            attendanceType: (row.attendance_type as string) === 'virtual' ? 'virtual' : 'physical',
          });
          sent++;
        } catch (err) {
          console.error('[referral-invite-admin] send failed for', row.id, (err as Error).message);
          failed++;
          // Roll back so it can be retried
          try {
            await supabaseAdmin.from('summit_registrations').update({ referral_invite_sent_at: null }).eq('id', row.id);
          } catch { /* best-effort */ }
        }
      }

      const remaining = Math.max(0, (totalRemaining ?? 0) - sent);
      if (sent + failed === 0) return { ok: true, message: 'Nothing to send right now. Try again in a moment.', refresh: true };
      const summary = `Sent ${sent}${failed ? `, ${failed} failed` : ''}.`;
      const next = remaining > 0 ? ` ${remaining} still pending — press again to send the next batch.` : ' Everyone has now been sent the referral invite.';
      return { ok: sent > 0, message: summary + next, refresh: true };
    }

    return { ok: false, error: 'This button is not connected yet.' };
  },

  async act(_ctx, actionId, rowId): Promise<ActionResult> {
    const { data: reg } = await supabaseAdmin.from('summit_registrations').select('*').eq('id', rowId).maybeSingle();
    if (!reg) return { ok: false, error: 'Registration not found.' };

    if (actionId === 'confirm-registration') {
      if (reg.payment_status === 'paid') return { ok: false, error: 'Already confirmed.' };
      const nowIso = new Date().toISOString();
      const { data: updated, error } = await supabaseAdmin
        .from('summit_registrations')
        .update({
          payment_status: 'paid', status: 'confirmed', amount_paid: 0, currency: reg.currency || 'NGN',
          paid_at: nowIso, confirmed_at: nowIso, ticket_type: reg.ticket_type || 'complimentary', updated_at: nowIso,
        })
        .eq('id', rowId)
        .neq('payment_status', 'paid')
        .select('*')
        .maybeSingle();
      if (error || !updated) return { ok: false, error: 'Could not confirm this registration.' };
      const sent = await deliverCompTicket(updated);
      if (!sent) return { ok: false, error: 'Confirmed, but the ticket email did not go out (see the failure code on the row). The registrant can open their ticket at joinascentor.com/elevation-summit/ticket, and you can use Resend ticket once email is fixed.', refresh: true };
      return { ok: true, message: `Confirmed. Ticket sent to ${updated.email}.`, refresh: true };
    }

    if (actionId === 'resend-ticket') {
      if (reg.payment_status !== 'paid') return { ok: false, error: 'Only confirmed registrations can be sent a ticket.' };
      const out = await deliverPaidEmails(reg, Number(reg.amount_paid ?? 0), reg.currency ?? 'NGN', reg.payment_reference ?? '', { customer: true });
      if (!out.customer) return { ok: false, error: describeEmailFailure(out.customerError?.kind ?? 'unknown', out.customerError?.code) };
      return { ok: true, message: `Ticket sent to ${reg.email}.`, refresh: true };
    }
    return { ok: false, error: 'Unknown action.' };
  },
};

export default screen;
