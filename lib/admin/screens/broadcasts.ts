// lib/admin/screens/broadcasts.ts
// Spec copied from the admin prototype (Community · Broadcasts). Reads the broadcasts table; Send now reuses startSending in
// lib/rx/broadcasts.ts, which is safe to repeat (one delivery row per member, so nobody is messaged twice).
import { supabaseAdmin } from '@/lib/supabase/admin';
import { audienceLabel, parseAudience } from '@/lib/rx/audience';
import { startSending } from '@/lib/rx/broadcasts';
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "broadcasts",
  group: "Community",
  title: "Broadcasts",
  sub: "Email, push and in-app messages to groups of members.",
  cols: ["Message", "Channel", "Audience", "Sent", "Opened", "Status"],
  statusCol: 5,
  actions: [
    { id: "send-now", label: "Send now", col: 5, to: "Sent", confirm: "This goes to everyone in the audience straight away." },
    { id: "pause", label: "Pause", col: 5, to: "Paused" }
  ],
  buttons: [{ id: "new-broadcast", label: "New broadcast", href: "/admin/broadcasts" }]
};

interface B { id: string; title: string; channel: string; audience: unknown; status: string; total: number | null; in_app_sent: number; emailed: number; email_failed: number }
const COLS = 'id, title, channel, audience, status, total, in_app_sent, emailed, email_failed';

const CHANNEL: Record<string, string> = { in_app: 'In-app', email: 'Email', both: 'In-app and email' };
const n = (v: number) => v.toLocaleString('en-GB');

// A draft that has already reached some members was paused part way.
const started = (b: B) => b.in_app_sent + b.emailed + b.email_failed > 0;
function statusOf(b: B): string {
  if (b.status === 'sent') return 'Sent';
  if (b.status === 'sending') return 'Live';
  if (b.status === 'cancelled') return 'Cancelled';
  return started(b) ? 'Paused' : 'Draft';
}

const screen: ScreenModule = {
  spec,
  async load() {
    const { data } = await supabaseAdmin.from('broadcasts').select(COLS).order('created_at', { ascending: false }).limit(200);
    const list = (data ?? []) as B[];
    const rows = list.map((b) => {
      const a = parseAudience(b.audience);
      const sent = b.status === 'draft' && !started(b) ? '-' : n(b.channel === 'email' ? b.emailed : b.in_app_sent);
      return { id: b.id, cells: [b.title, CHANNEL[b.channel] ?? b.channel, a ? audienceLabel(a) : '-', sent, '-', statusOf(b)] };
    });
    return { rows, note: 'Opened is not tracked yet. Scheduled and automatic sends do not exist; every broadcast is sent by hand.' };
  },

  async act(_ctx, actionId, rowId) {
    const { data } = await supabaseAdmin.from('broadcasts').select(COLS).eq('id', rowId).maybeSingle();
    const b = data as B | null;
    if (!b) return { ok: false, error: 'That broadcast no longer exists.' };
    if (actionId === 'send-now') {
      if (b.status !== 'draft') return { ok: false, error: b.status === 'sent' ? 'This message was already sent.' : b.status === 'sending' ? 'It is already sending. The hourly job finishes it.' : 'A cancelled message cannot be sent.' };
      const r = await startSending(rowId);
      if (!r.ok) return { ok: false, error: r.error };
      return { ok: true, message: r.done ? `${b.title} sent.` : `${b.title} is sending. ${n(r.remaining)} left, the hourly job will finish them.` };
    }
    if (actionId === 'pause') {
      if (b.status !== 'sending') return { ok: false, error: 'Only a message that is sending can be paused.' };
      // Back to draft: members already handled have a delivery row, so Send now carries on without repeating anyone.
      const { error } = await supabaseAdmin.from('broadcasts').update({ status: 'draft' }).eq('id', rowId).eq('status', 'sending');
      if (error) return { ok: false, error: 'We could not pause that message.' };
      return { ok: true, message: `${b.title} paused. Send now carries on from where it stopped.` };
    }
    return { ok: false, error: 'Unknown action.' };
  },
};

export default screen;
