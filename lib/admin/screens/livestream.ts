// lib/admin/screens/livestream.ts
// Spec copied from the admin prototype (Elevation Summit · Livestream). The loader below is a placeholder until it reads real data.
// Prototype KPI tiles to compute for real: Stream status (sample "Not live"); Links sent (sample "0"); Reminder (sample "Not sent"); Opened (sample "-")
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendStreamAccessEmail } from '@/lib/summitEmails';
import { count } from '@/lib/admin/revenue-util';
import type { ScreenModule, ScreenSpec, ActionResult } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "livestream",
  group: "Elevation Summit",
  title: "Livestream",
  sub: "Send access links to virtual attendees and check the stream before going live.",
  cols: [
    "Person",
    "Email",
    "Ticket",
    "Opened",
    "Link"
  ],
  statusCol: 4,
  actions: [
    {
      id: "send-link",
      label: "Send link",
      col: 4,
      to: "Sent"
    }
  ],
  quick: 0,
  buttons: [
    {
      id: "send-all-access-links",
      label: "Send all access links"
    },
    {
      id: "test-stream",
      label: "Test stream",
      href: "/admin/summit-stream"
    }
  ],
  note: "Before you go live: keep the stream unlisted, not public, so only registrants can watch."
};

const cellsOf = (r: any) => [r.full_name || '-', r.email || '-', 'Virtual', '-', r.stream_access_sent_at ? 'Sent' : 'Not sent'];

const screen: ScreenModule = {
  spec,
  async load() {
    const [{ data, error }, { data: settings }, { count: reminded }] = await Promise.all([
      supabaseAdmin
        .from('summit_registrations')
        .select('id, full_name, email, stream_access_sent_at')
        .eq('payment_status', 'paid')
        .eq('attendance_type', 'virtual')
        .order('full_name', { ascending: true })
        .limit(1000),
      supabaseAdmin.from('platform_settings').select('key, value').eq('key', 'summit_stream_enabled'),
      supabaseAdmin.from('summit_registrations').select('*', { count: 'exact', head: true }).eq('payment_status', 'paid').not('event_day_email_sent_at', 'is', null),
    ]);
    if (error) throw new Error(error.message);
    const virtual = data ?? [];
    const live = settings?.[0]?.value === 'true';
    const sent = virtual.filter((r) => r.stream_access_sent_at).length;
    return {
      rows: virtual.slice(0, 200).map((r) => ({ id: r.id, cells: cellsOf(r) })),
      kpis: [
        { label: 'Stream status', value: live ? 'Live' : 'Not live', note: 'YouTube · unlisted' },
        { label: 'Links sent', value: count(sent), note: `of ${count(virtual.length)} virtual registrants` },
        { label: 'Reminder', value: (reminded ?? 0) > 0 ? 'Sent' : 'Not sent', note: 'Morning of 19 Nov' },
        { label: 'Opened', value: '-', note: 'Not tracked' },
      ],
    };
  },

  async act(_ctx, actionId, rowId): Promise<ActionResult> {
    if (actionId !== 'send-link') return { ok: false, error: 'Unknown action.' };
    const { data: reg } = await supabaseAdmin
      .from('summit_registrations')
      .select('id, full_name, email, payment_status, attendance_type')
      .eq('id', rowId)
      .maybeSingle();
    if (!reg || reg.payment_status !== 'paid' || reg.attendance_type !== 'virtual') {
      return { ok: false, error: 'Only confirmed virtual registrants get a stream link.' };
    }
    try {
      await sendStreamAccessEmail(reg.email, reg.full_name);
    } catch {
      return { ok: false, error: 'Email failed to send. Check SMTP settings.' };
    }
    const nowIso = new Date().toISOString();
    await supabaseAdmin.from('summit_registrations').update({ stream_access_sent_at: nowIso }).eq('id', rowId);
    return { ok: true, message: `Link sent to ${reg.email}.`, cells: cellsOf({ ...reg, stream_access_sent_at: nowIso }) };
  },
};

export default screen;
