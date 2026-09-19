// lib/paymentReconciliation.ts
// ─────────────────────────────────────────────────────────────────────────────
// Scheduled sweep of payment_attempts. Paystack sends no "abandoned" webhook,
// so the only way to learn a checkout was abandoned (or that a webhook was
// lost) is to poll Paystack for attempts that are still pending.
//
// For every pending attempt older than MIN_AGE:
//   • Paystack says success   -> fulfil it now (recovers lost webhooks/callbacks)
//   • Paystack says failed    -> mark failed
//   • still pending/unknown   -> once older than ABANDON_AFTER, mark abandoned
//
// Newly abandoned attempts then:
//   • trigger ONE digest notification to admins (in-app + email)
//   • get ONE recovery email to the customer (with a link to finish paying)
//
// Vercel Hobby crons run at most once per day, so this is written as a
// batch job that is safe to run daily, on demand (admin "Reconcile now"), or
// more often later (Pro plan / Trigger.dev) without changing anything.
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  settleReference,
  notifyAdmins,
  type PaymentAttempt,
} from '@/lib/paymentSettlement';

const MIN_AGE_MINUTES       = 30;   // ignore attempts still likely mid-checkout
const ABANDON_AFTER_MINUTES = 60;   // pending this long => abandoned
const RECOVERY_WINDOW_DAYS  = 7;    // older attempts are closed silently
const MAX_PER_RUN           = 100;  // keeps a run inside Hobby's 60s function limit
const CONCURRENCY           = 5;
const MAX_RECOVERY_EMAILS   = 50;

export interface ReconcileSummary {
  checked:            number;
  recovered:          number; // paid at Paystack but never fulfilled locally
  failed:             number;
  abandoned:          number; // newly marked abandoned this run
  adminNotified:      number; // abandoned attempts included in the admin digest
  recoveryEmailsSent: number;
  errors:             number;
}

const minutesAgoIso = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const daysAgoIso    = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const naira = (kobo: number | null) => `₦${((kobo ?? 0) / 100).toLocaleString('en-NG')}`;

async function inChunks<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

/** True when the customer has since completed payment through another attempt. */
async function isAlreadyResolved(a: PaymentAttempt): Promise<boolean> {
  if (a.kind === 'summit' && a.registration_id) {
    const { data } = await supabaseAdmin
      .from('summit_registrations')
      .select('payment_status')
      .eq('id', a.registration_id)
      .maybeSingle();
    return !data || data.payment_status === 'paid';
  }
  if (a.kind === 'subscription' && a.user_id) {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('subscription_status, subscription_end')
      .eq('id', a.user_id)
      .maybeSingle();
    if (!data) return true;
    const live = data.subscription_status === 'active' || data.subscription_status === 'trialing';
    return live && (!data.subscription_end || new Date(data.subscription_end) > new Date());
  }
  return false;
}

async function sendRecoveryEmail(a: PaymentAttempt): Promise<boolean> {
  if (!a.email) return false;
  const { sendEmail } = await import('@/lib/nodemailer');
  const { brandedEmailLayout, esc, p, goldButton } = await import('@/lib/emailTemplate');
  const base = process.env.NEXT_PUBLIC_URL || 'https://ascentorbi.com';

  const isSummit = a.kind === 'summit';
  const url      = isSummit ? `${base}/elevation-summit#register` : `${base}/checkout`;

  await sendEmail({
    to:      a.email,
    from:    isSummit ? process.env.SUMMIT_MAIL_FROM : undefined,
    subject: isSummit ? 'Your Elevation Summit spot is still waiting' : 'You left your Ascentor checkout unfinished',
    html: brandedEmailLayout({
      preheader: 'Your payment did not complete. Pick up where you left off.',
      eyebrow:   isSummit ? 'Elevation Summit · 19 November 2026' : 'Ascentor',
      heading:   'Your payment did not go through.',
      recipient: a.email,
      content:
        p('It looks like you started paying but did not finish. <strong>You have not been charged</strong> unless you received a payment confirmation from your bank or Paystack.') +
        p(isSummit
          ? 'Your registration is saved, but your place is <strong>not confirmed</strong> until payment is complete.'
          : 'Your plan has not been activated. You can finish checkout in a minute.') +
        goldButton(isSummit ? 'Complete your registration →' : 'Finish checkout →', url) +
        p(`If you already paid and did not get a confirmation, just reply to this email with your reference <strong>${esc(a.reference)}</strong> and we will sort it out.`),
    }),
  });
  return true;
}

export async function reconcilePayments(): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = {
    checked: 0, recovered: 0, failed: 0, abandoned: 0,
    adminNotified: 0, recoveryEmailsSent: 0, errors: 0,
  };

  // ── 1. Re-check stale pending attempts against Paystack ───────────────────
  const { data: pending, error: pendingErr } = await supabaseAdmin
    .from('payment_attempts')
    .select('reference, created_at')
    .eq('status', 'pending')
    .lt('created_at', minutesAgoIso(MIN_AGE_MINUTES))
    .order('created_at', { ascending: true })
    .limit(MAX_PER_RUN);
  if (pendingErr) throw new Error(`reconcile: could not load pending attempts: ${pendingErr.message}`);

  await inChunks(pending ?? [], CONCURRENCY, async (row) => {
    summary.checked++;
    try {
      const result = await settleReference(row.reference);

      if (result.state === 'settled' && !result.alreadySettled) {
        summary.recovered++;
        return;
      }
      if (result.state === 'failed') {
        summary.failed++;
        return;
      }
      if (result.state === 'pending' || result.state === 'notfound') {
        if (row.created_at < minutesAgoIso(ABANDON_AFTER_MINUTES)) {
          const stale = row.created_at < daysAgoIso(RECOVERY_WINDOW_DAYS);
          const nowIso = new Date().toISOString();
          const { data: updated } = await supabaseAdmin
            .from('payment_attempts')
            .update({
              status:        'abandoned',
              abandoned_at:  nowIso,
              updated_at:    nowIso,
              // Backlog older than the recovery window: close silently.
              ...(stale ? { admin_notified_at: nowIso, recovery_sent_at: nowIso } : {}),
            })
            .eq('reference', row.reference)
            .eq('status', 'pending')
            .select('id');
          if (updated?.length) summary.abandoned++;
        }
      }
    } catch (err) {
      summary.errors++;
      console.error(`[reconcile] ${row.reference}:`, (err as Error).message);
    }
  });

  // ── 2. Notify admins about abandoned attempts (one digest) ────────────────
  const { data: toNotify } = await supabaseAdmin
    .from('payment_attempts')
    .select('id, reference, kind, status, user_id, plan_id, billing, registration_id, email, amount_kobo, currency, created_at, recovery_sent_at, admin_notified_at')
    .eq('status', 'abandoned')
    .is('admin_notified_at', null)
    .gte('created_at', daysAgoIso(RECOVERY_WINDOW_DAYS))
    .order('created_at', { ascending: false })
    .limit(200);

  const fresh: PaymentAttempt[] = [];
  const resolvedIds: string[]    = [];
  for (const a of (toNotify ?? []) as PaymentAttempt[]) {
    try {
      if (await isAlreadyResolved(a)) resolvedIds.push(a.id);
      else fresh.push(a);
    } catch {
      fresh.push(a);
    }
  }

  const nowIso = new Date().toISOString();

  if (fresh.length > 0) {
    const totalKobo = fresh.reduce((s, a) => s + (a.amount_kobo ?? 0), 0);
    const summitN   = fresh.filter(a => a.kind === 'summit').length;
    const subN      = fresh.length - summitN;

    const rows = fresh.slice(0, 15).map(a =>
      `<li>${a.kind === 'summit' ? 'Summit' : 'Subscription'} &middot; ${a.email ? a.email.replace(/</g, '&lt;') : 'unknown'} &middot; ${naira(a.amount_kobo)} &middot; ${new Date(a.created_at).toUTCString().slice(5, 22)}</li>`
    ).join('');

    await notifyAdmins({
      title:   `${fresh.length} abandoned checkout${fresh.length === 1 ? '' : 's'} (${naira(totalKobo)})`,
      message: `${summitN} summit, ${subN} subscription. Total unrealised value ${naira(totalKobo)}. Recovery emails are being sent to the customers.`,
      link:    '/admin',
      type:    'abandoned_checkout',
      emailHtml:
        `<p style="margin:0 0 12px;"><strong>${fresh.length}</strong> checkout${fresh.length === 1 ? ' was' : 's were'} started but never paid, worth <strong>${naira(totalKobo)}</strong>.</p>` +
        `<ul style="margin:0 0 16px;padding-left:18px;">${rows}</ul>` +
        (fresh.length > 15 ? `<p style="margin:0 0 16px;">...and ${fresh.length - 15} more.</p>` : ''),
    });
    summary.adminNotified = fresh.length;
  }

  const notifiedIds = [...fresh.map(a => a.id), ...resolvedIds];
  if (notifiedIds.length) {
    await supabaseAdmin
      .from('payment_attempts')
      .update({ admin_notified_at: nowIso, updated_at: nowIso })
      .in('id', notifiedIds);
  }

  // ── 3. Recovery emails to customers (once each) ───────────────────────────
  let sent = 0;
  for (const a of fresh) {
    if (sent >= MAX_RECOVERY_EMAILS) break;
    if (a.recovery_sent_at || !a.email) continue;
    try {
      if (await sendRecoveryEmail(a)) {
        sent++;
        await supabaseAdmin
          .from('payment_attempts')
          .update({ recovery_sent_at: new Date().toISOString() })
          .eq('id', a.id);
      }
    } catch (err) {
      summary.errors++;
      console.error(`[reconcile] recovery email ${a.reference}:`, (err as Error).message);
    }
  }
  summary.recoveryEmailsSent = sent;

  return summary;
}
