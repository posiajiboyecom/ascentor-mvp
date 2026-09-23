// lib/summitEventDay.ts
// ─────────────────────────────────────────────────────────────────────────────
// Morning-of-event reminder. Every PAID registration gets one email the day
// the Summit happens: virtual attendees get the livestream link, physical
// attendees get NO link at all (they are attending in person). Idempotent via
// event_day_email_sent_at, so it is safe to call more than once on the day
// (the daily cron plus an admin "send now" override both use this).
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEventDayVirtualEmail, sendEventDayPhysicalEmail } from '@/lib/summitEmails';
import { SUMMIT_DATE } from '@/lib/elevationSummit';

export interface EventDaySummary {
  isEventDay: boolean;
  ran: boolean;
  checked: number;
  sentVirtual: number;
  sentPhysical: number;
  failed: number;
}

/** Today's calendar date in WAT (UTC+1, no DST), as YYYY-MM-DD. */
function todayInWat(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function isSummitDayInWat(): boolean {
  return todayInWat() === SUMMIT_DATE.toISOString().slice(0, 10);
}

export async function sendEventDayEmails(opts: { force?: boolean } = {}): Promise<EventDaySummary> {
  const isEventDay = isSummitDayInWat();
  if (!isEventDay && !opts.force) {
    return { isEventDay, ran: false, checked: 0, sentVirtual: 0, sentPhysical: 0, failed: 0 };
  }

  const { data: targets, error } = await supabaseAdmin
    .from('summit_registrations')
    .select('id, full_name, email, attendance_type')
    .eq('payment_status', 'paid')
    .is('event_day_email_sent_at', null)
    .limit(2000);
  if (error) throw new Error(`could not load paid registrations: ${error.message}`);

  const summary: EventDaySummary = { isEventDay, ran: true, checked: targets?.length ?? 0, sentVirtual: 0, sentPhysical: 0, failed: 0 };

  for (const r of targets ?? []) {
    try {
      if (r.attendance_type === 'virtual') {
        await sendEventDayVirtualEmail(r.email, r.full_name);
        summary.sentVirtual++;
      } else {
        await sendEventDayPhysicalEmail(r.email, r.full_name);
        summary.sentPhysical++;
      }
      await supabaseAdmin.from('summit_registrations')
        .update({ event_day_email_sent_at: new Date().toISOString() })
        .eq('id', r.id);
    } catch (err) {
      summary.failed++;
      console.error('[summitEventDay] send failed for', r.email, (err as Error).message);
    }
  }

  return summary;
}
