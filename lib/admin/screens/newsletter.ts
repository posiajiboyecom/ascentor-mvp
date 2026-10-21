// lib/admin/screens/newsletter.ts
// Spec copied from the admin prototype (Marketing · Newsletter). The loader below is a placeholder until it reads real data.
// Prototype KPI tiles to compute for real: Subscribers (sample "[COUNT]"); Open rate (sample "-"); Next issue (sample "Tue 20 Oct"); Unsubscribes (sample "-")
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { shortDate, count } from '@/lib/admin/revenue-util';
import type { ScreenModule, ScreenSpec, ActionResult } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "newsletter",
  group: "Marketing",
  title: "Newsletter",
  sub: "The Ascentor Weekly. People sign up on the landing page, not in the app.",
  cols: [
    "Issue",
    "Subject",
    "Sent to",
    "Opened",
    "Status"
  ],
  statusCol: 4,
  actions: [
    {
      id: "send-now",
      label: "Send now",
      col: 4,
      to: "Sent",
      admin: true,
      confirm: "Send this issue to every subscriber now?"
    },
    {
      id: "schedule-for-tuesday",
      label: "Schedule for Tuesday",
      col: 4,
      to: "Scheduled"
    }
  ],
  buttons: [
    {
      id: "new-issue",
      href: "/admin/newsletter",
      label: "New issue"
    }
  ]
};

// Issues are the sent history (sent_newsletters) plus what is queued (newsletter_queue). Sending goes out as real email through
// /api/newsletter/send, which the console does not call: Send now and Schedule stay unconnected, use the Newsletter editor.
const screen: ScreenModule = {
  spec,
  async load() {
    const [sent, queued, subs, unsubs] = await Promise.all([
      supabaseAdmin.from('sent_newsletters').select('id, subject, subscriber_count, sent_at').order('sent_at', { ascending: true }).limit(200),
      supabaseAdmin.from('newsletter_queue').select('id, subject, queued_at').eq('status', 'queued').order('queued_at', { ascending: true }).limit(200),
      supabaseAdmin.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabaseAdmin.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('is_active', false),
    ]);
    if (sent.error) throw new Error(sent.error.message);
    const rows = [
      ...(sent.data ?? []).map((r: any) => ({ id: `s:${r.id}`, subject: r.subject, to: r.subscriber_count ? count(Number(r.subscriber_count)) : '-', status: 'Sent' })),
      ...(queued.data ?? []).map((r: any) => ({ id: `q:${r.id}`, subject: r.subject, to: '-', status: 'Draft' })),
    ];
    return {
      kpis: [
        { label: 'Subscribers', value: count(subs.count ?? 0), note: 'From the landing page' },
        { label: 'Open rate', value: '-' },
        { label: 'Queued issues', value: count(queued.data?.length ?? 0), note: 'Waiting to be sent' },
        { label: 'Unsubscribes', value: count(unsubs.count ?? 0) },
      ],
      // Newest first, numbered in order sent.
      rows: rows.map((r, i) => ({ id: r.id, cells: [`Issue ${i + 1}`, r.subject || '-', r.to, '-', r.status] })).reverse(),
      note: 'Sending an issue is done in the Newsletter editor; it is not connected here yet.',
    };
  },
};

export default screen;
