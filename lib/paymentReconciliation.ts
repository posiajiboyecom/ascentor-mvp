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
  fetchPaystackTransaction,
  settleReference,
  notifyAdmins,
  createAttempt,
  getSummitPricesNaira,
  type PaymentAttempt,
} from '@/lib/paymentSettlement';
import { deliverPaidEmails } from '@/lib/summitEmails';

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
  adopted:            number; // paid at Paystack with no attempt row (pre-hardening) - now settled
  emailsRetried:      number; // paid registrations whose confirmation email had failed
  feesBackfilled:     number; // paid tickets that now have Paystack's real fee stored
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
  const base = process.env.NEXT_PUBLIC_URL || 'https://joinascentor.com';

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
    adminNotified: 0, recoveryEmailsSent: 0, adopted: 0, emailsRetried: 0, feesBackfilled: 0, errors: 0,
  };

  // ── 0. Adopt Summit payments made before payment_attempts existed ─────────
  try {
    summary.adopted = await adoptSummitPayments();
  } catch (err) {
    summary.errors++;
    console.error('[reconcile] legacy adoption failed:', (err as Error).message);
  }

  // ── 1. Re-check stale pending attempts against Paystack ───────────────────
  const { data: pending, error: pendingErr } = await supabaseAdmin
    .from('payment_attempts')
    .select('reference, created_at, status')
    .in('status', ['pending', 'abandoned'])
    .gte('created_at', daysAgoIso(RECOVERY_WINDOW_DAYS))
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
        if (row.status === 'pending' && row.created_at < minutesAgoIso(ABANDON_AFTER_MINUTES)) {
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

  // ── 4. Retry confirmation emails that failed after a successful payment ───
  try {
    summary.emailsRetried = await retryFailedConfirmationEmails();
  } catch (err) {
    console.error('[reconcile] email retry failed:', (err as Error).message);
  }

  // ── 5. Store Paystack's real fee for paid tickets that have none ──────────
  try {
    summary.feesBackfilled = await backfillPaystackFees();
  } catch (err) {
    console.error('[reconcile] fee backfill failed:', (err as Error).message);
  }

  return summary;
}

// ── Legacy adoption ──────────────────────────────────────────────────────────

const SUMMIT_REF_RE = /^summit-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-\d+$/i;
const PAYSTACK_PAGES = 3; // 300 most recent successful transactions per run

/**
 * Finds Summit payments that succeeded at Paystack but that we never settled,
 * records them and settles them (which confirms the ticket and emails it).
 * A successful transaction is matched to a registration when
 *   (a) its reference is summit-<registrationId>-<timestamp> (pre-hardening
 *       checkouts and any checkout whose attempt row was lost), or
 *   (b) its Paystack customer email equals an UNPAID registration's email and
 *       the amount covers that ticket (someone who paid under a reference we
 *       never recorded).
 * Amount, currency and exactly-once fulfilment are still enforced by
 * settleReference. Pass registrationId to restrict this to one person.
 */
export async function adoptSummitPayments(opts: { registrationId?: string } = {}): Promise<number> {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return 0;
  const prices = getSummitPricesNaira();
  if (!prices) return 0;

  let unpaidQuery = supabaseAdmin
    .from('summit_registrations')
    .select('id, email, attendance_type, payment_status, payment_provider_tx_id')
    .neq('payment_status', 'paid');
  if (opts.registrationId) unpaidQuery = unpaidQuery.eq('id', opts.registrationId);
  const { data: unpaid } = await unpaidQuery.limit(2000);
  const byEmail = new Map<string, any>((unpaid ?? []).map((r: any) => [String(r.email).toLowerCase(), r]));

  let adopted = 0;
  for (let page = 1; page <= PAYSTACK_PAGES; page++) {
    const res = await fetch(
      `https://api.paystack.co/transaction?status=success&perPage=100&page=${page}`,
      { headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store' },
    );
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.status) throw new Error(`Paystack list failed (${res.status})`);
    const txs: any[] = (body.data ?? []).filter((t: any) => typeof t.reference === 'string');
    if (txs.length === 0) break;

    const { data: known } = await supabaseAdmin
      .from('payment_attempts')
      .select('reference')
      .in('reference', txs.map(t => t.reference));
    const knownSet = new Set((known ?? []).map((k: { reference: string }) => k.reference));

    for (const tx of txs) {
      if (knownSet.has(tx.reference)) continue;
      try {
        const m = tx.reference.match(SUMMIT_REF_RE);
        let reg: any = null;
        if (m) {
          const { data } = await supabaseAdmin
            .from('summit_registrations')
            .select('id, email, attendance_type, payment_status, payment_provider_tx_id')
            .eq('id', m[1]).maybeSingle();
          reg = data;
        } else {
          const email = String(tx.customer?.email ?? '').toLowerCase();
          reg = email ? byEmail.get(email) : null;
        }
        if (!reg) continue;
        if (opts.registrationId && reg.id !== opts.registrationId) continue;

        const expectedKobo = Math.round((reg.attendance_type === 'virtual' ? prices.virtual : prices.onsite) * 100);
        // A payment matched only by email must cover the ticket.
        if (!m && tx.amount < expectedKobo) continue;

        await createAttempt({
          reference: tx.reference, kind: 'summit', amountKobo: expectedKobo,
          email: reg.email, registrationId: reg.id,
        });

        // Already recorded as paid by the old flow with this very transaction: just link it.
        if (reg.payment_status === 'paid' && reg.payment_provider_tx_id === String(tx.id)) {
          await supabaseAdmin.from('payment_attempts')
            .update({ status: 'success', provider_status: 'success', provider_tx_id: String(tx.id), paid_at: tx.paid_at ?? null })
            .eq('reference', tx.reference);
          continue;
        }

        const result = await settleReference(tx.reference);
        if (result.state === 'settled' && !result.alreadySettled) adopted++;
      } catch (err) {
        console.error(`[reconcile] adopt ${tx.reference}:`, (err as Error).message);
      }
    }
    if (txs.length < 100) break;
  }
  return adopted;
}

// ── Candidate transactions (self-serve match when auto-adoption finds nothing) ─

export interface PaystackCandidate {
  reference: string;
  amountKobo: number;
  currency: string;
  email: string | null;
  paidAt: string | null;
}

/**
 * Lists recent successful Paystack transactions that are NOT linked to any
 * payment_attempts row and cover at least `minAmountKobo`, newest first. Used
 * so an admin can see and confirm the exact transaction for a registration when
 * automatic reference/email matching finds nothing (e.g. the customer paid
 * under a different email, or via a Paystack payment link/page rather than the
 * site's own checkout). Never settles anything by itself.
 */
export async function findCandidateTransactions(minAmountKobo: number, limit = 6): Promise<PaystackCandidate[]> {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return [];

  const out: PaystackCandidate[] = [];
  for (let page = 1; page <= PAYSTACK_PAGES && out.length < limit; page++) {
    const res = await fetch(
      `https://api.paystack.co/transaction?status=success&perPage=100&page=${page}`,
      { headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store' },
    );
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.status) throw new Error(`Paystack list failed (${res.status})`);
    const txs: any[] = (body.data ?? []).filter((t: any) => typeof t.reference === 'string' && t.amount >= minAmountKobo);
    if (txs.length === 0) { if ((body.data ?? []).length < 100) break; else continue; }

    const { data: known } = await supabaseAdmin
      .from('payment_attempts')
      .select('reference')
      .in('reference', txs.map(t => t.reference));
    const knownSet = new Set((known ?? []).map((k: { reference: string }) => k.reference));

    for (const tx of txs) {
      if (knownSet.has(tx.reference)) continue;
      out.push({
        reference: tx.reference, amountKobo: tx.amount, currency: tx.currency ?? 'NGN',
        email: tx.customer?.email ?? null, paidAt: tx.paid_at ?? null,
      });
      if (out.length >= limit) break;
    }
    if ((body.data ?? []).length < 100) break;
  }
  return out;
}

// ── Email retry ──────────────────────────────────────────────────────────────

/** Only rows where a send was attempted and FAILED (error recorded) are retried; older rows are left to the admin "Resend" button so nobody gets a surprise duplicate. */
async function retryFailedConfirmationEmails(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('summit_registrations')
    .select('*')
    .eq('payment_status', 'paid')
    .is('confirmation_email_sent_at', null)
    .not('confirmation_email_error', 'is', null)
    .limit(20);
  if (error) return 0; // tracking columns not migrated yet

  let n = 0;
  for (const reg of data ?? []) {
    const out = await deliverPaidEmails(reg, Number(reg.amount_paid ?? 0), reg.currency ?? 'NGN', reg.payment_reference ?? '', { customer: true });
    if (out.customer) n++;
  }
  return n;
}

// ── Fee backfill ─────────────────────────────────────────────────────────────

/** Tickets paid before fee capture existed have no paystack_fee. Ask Paystack (with the live key on the server) and store the real fee. */
async function backfillPaystackFees(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('summit_registrations')
    .select('id, amount_paid, payment_reference')
    .eq('payment_status', 'paid')
    .is('paystack_fee', null)
    .not('payment_reference', 'is', null)
    .limit(50);
  if (error) return 0; // paystack_fee column not migrated yet

  let n = 0;
  for (const reg of data ?? []) {
    try {
      const lookup = await fetchPaystackTransaction(reg.payment_reference as string);
      if (!lookup.found || lookup.tx.status !== 'success' || lookup.tx.fees == null) continue;
      // Only trust a transaction for exactly the amount we recorded.
      if (Number(reg.amount_paid) !== lookup.tx.amount / 100) continue;
      await supabaseAdmin.from('summit_registrations').update({ paystack_fee: lookup.tx.fees / 100 }).eq('id', reg.id);
      n++;
    } catch (err) {
      console.error('[reconcile] fee backfill', reg.payment_reference, (err as Error).message);
    }
  }
  return n;
}
