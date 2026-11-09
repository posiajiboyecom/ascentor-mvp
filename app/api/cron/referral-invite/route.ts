// GET /api/cron/referral-invite
// Runs every 15 minutes. Finds registrations that:
//   - are confirmed (payment_status = 'paid')
//   - were confirmed at least 2 hours ago
//   - have not yet received a referral invite (referral_invite_sent_at IS NULL)
//   - have a referral_code
// Sends the referral invite email and stamps referral_invite_sent_at.
//
// Requires: CRON_SECRET env var (same secret shared by all cron routes).
// Vercel cron schedule: "*/15 * * * *" (every 15 min).

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendReferralInviteEmail } from '@/lib/summitEmails';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Batch size: keep sends well within the 60s maxDuration. */
const BATCH = 10;
/** How long after confirmed_at before we send (ms). */
const DELAY_MS = 2 * 60 * 60 * 1000; // 2 hours

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(req.headers.get('authorization') ?? '');
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error('[cron/referral-invite] CRON_SECRET is not set');
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 });
  }
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - DELAY_MS).toISOString();

  // Fetch eligible registrations: paid, confirmed 2h+ ago, invite not yet sent, has a code.
  const { data: rows, error } = await supabaseAdmin
    .from('summit_registrations')
    .select('id, email, full_name, referral_code, attendance_type')
    .eq('payment_status', 'paid')
    .lte('confirmed_at', cutoff)
    .is('referral_invite_sent_at', null)
    .not('referral_code', 'is', null)
    .limit(BATCH);

  if (error) {
    console.error('[cron/referral-invite] query failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, failed: 0 });
  }

  let sent = 0;
  let failed = 0;
  const failedIds: string[] = [];

  for (const row of rows) {
    try {
      // Claim the row first to prevent double-send if two cron runs overlap.
      const { data: claimed } = await supabaseAdmin
        .from('summit_registrations')
        .update({ referral_invite_sent_at: new Date().toISOString() })
        .eq('id', row.id)
        .is('referral_invite_sent_at', null)
        .select('id')
        .maybeSingle();

      if (!claimed) {
        // Another run already claimed it — skip.
        continue;
      }

      await sendReferralInviteEmail({
        to: row.email as string,
        fullName: (row.full_name as string) ?? 'there',
        referralCode: row.referral_code as string,
        attendanceType: (row.attendance_type as string) === 'virtual' ? 'virtual' : 'physical',
      });

      sent++;
    } catch (err) {
      console.error('[cron/referral-invite] send failed for', row.id, (err as Error).message);
      failed++;
      failedIds.push(String(row.id));

      // Roll back the sent_at stamp so the next run retries.
      try {
        await supabaseAdmin
          .from('summit_registrations')
          .update({ referral_invite_sent_at: null })
          .eq('id', row.id);
      } catch { /* best-effort rollback */ }
    }
  }

  console.log(`[cron/referral-invite] sent=${sent} failed=${failed}`);
  return NextResponse.json({ ok: true, sent, failed, ...(failedIds.length ? { failedIds } : {}) });
}
