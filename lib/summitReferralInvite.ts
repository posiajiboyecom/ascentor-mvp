// lib/summitReferralInvite.ts
// Sends the 2-hour post-registration referral invite email.
// Called by the hourly cron (app/api/cron/hourly/route.ts).
// Safe to run repeatedly — uses optimistic locking to prevent double-sends.

import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendReferralInviteEmail } from '@/lib/summitEmails';

const BATCH = 10;
const DELAY_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface ReferralInviteBatchResult {
  sent: number;
  failed: number;
  failedIds?: string[];
}

export async function sendReferralInviteBatch(): Promise<ReferralInviteBatchResult> {
  const cutoff = new Date(Date.now() - DELAY_MS).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from('summit_registrations')
    .select('id, email, full_name, referral_code, attendance_type')
    .eq('payment_status', 'paid')
    .lte('confirmed_at', cutoff)
    .is('referral_invite_sent_at', null)
    .not('referral_code', 'is', null)
    .limit(BATCH);

  if (error) throw new Error(`referral-invite query failed: ${error.message}`);
  if (!rows || rows.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const failedIds: string[] = [];

  for (const row of rows) {
    try {
      // Claim the row to prevent double-send on overlapping runs
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
      console.error('[referral-invite] send failed for', row.id, (err as Error).message);
      failed++;
      failedIds.push(String(row.id));
      // Roll back so the next run retries
      try {
        await supabaseAdmin
          .from('summit_registrations')
          .update({ referral_invite_sent_at: null })
          .eq('id', row.id);
      } catch { /* best-effort rollback */ }
    }
  }

  return { sent, failed, ...(failedIds.length ? { failedIds } : {}) };
}
