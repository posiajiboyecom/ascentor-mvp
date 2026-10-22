// lib/billing/notify.ts
// ─────────────────────────────────────────────────────────────────────────────
// ONE function per billing event. Each sends BOTH an in-app notification (table
// `notifications`, link /settings/billing) AND a branded email with a plain-text
// fallback. A failing email or notification never breaks billing: every step is
// caught, a non-secret line is logged, and the caller carries on.
// Copy is plain, has no em dashes, and shows only card brand and last4.
//
// Exports
//   BillingNotifyEvent, NotifyData
//   buildEmail(event, data, recipient?) -> { subject, title, body, lines, label, url, html, text }   PURE
//   plainFailureReason(gatewayText)     -> member-friendly reason                                   PURE
//   notifyCardAdded / notifyCardRemoved / notifyCardDefaultChanged / notifyPaymentSucceeded /
//   notifyPaymentFailed / notifyTrialStarted / notifyTrialEnding / notifyGraceStarted / notifyLapsed /
//   notifyReactivated / notifyGroupWarning / notifyCreditEarned     (userId, data) -> Promise<void>, never throws
// The server-only modules (supabase, mailer) are imported lazily so buildEmail can be unit tested without them.
// ─────────────────────────────────────────────────────────────────────────────

import { brandedEmailLayout, esc, goldButton, p } from '@/lib/emailTemplate';
import { formatNaira } from './catalog';

const SITE = process.env.NEXT_PUBLIC_URL || 'https://joinascentor.com';
export const BILLING_LINK = '/settings/billing';

export type BillingNotifyEvent =
  | 'card_added' | 'card_removed' | 'card_default_changed' | 'payment_succeeded' | 'payment_failed'
  | 'trial_started' | 'trial_ending' | 'grace_started' | 'lapsed' | 'reactivated' | 'group_warning' | 'credit_earned';

export interface NotifyData {
  brand?: string | null;
  last4?: string | null;
  amountKobo?: number;
  /** Human plan name, for example "Seeker, monthly". */
  planName?: string;
  nextChargeAt?: Date | string | null;
  trialEndsAt?: Date | string | null;
  graceEndsAt?: Date | string | null;
  /** Gateway text, translated by plainFailureReason(). */
  reason?: string | null;
  creditKobo?: number;
  balanceKobo?: number;
  activeCount?: number;
  renewalDate?: Date | string | null;
  groupPriceKobo?: number;
  soloPriceKobo?: number;
}

export interface BuiltEmail {
  subject: string;
  title: string;
  body: string;
  lines: string[];
  label: string;
  url: string;
  html: string;
  text: string;
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' });
}

function cardWord(d: NotifyData): string {
  const brand = (d.brand ?? '').trim();
  const b = brand ? brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase() : 'Card';
  return d.last4 ? `${b} ending ${d.last4}` : b;
}

/** Turns a Paystack gateway message into words a member understands. */
export function plainFailureReason(raw: string | null | undefined): string {
  const t = (raw ?? '').toLowerCase();
  if (/insufficient/.test(t)) return 'your bank says there were not enough funds on the card';
  if (/expired/.test(t)) return 'the card has expired';
  if (/(do not honou?r|declined|not permitted|restricted|suspected|stolen|lost)/.test(t)) return 'your bank declined the payment';
  if (/(limit|exceed)/.test(t)) return 'the payment went over a limit set by your bank';
  if (/(authori[sz]ation|invalid|no longer|inactive|deactivated)/.test(t)) return 'the saved card can no longer be charged';
  return 'the payment could not be completed';
}

interface Copy {
  subject: string;
  eyebrow: string;
  title: string;
  body: string;
  lines?: string[];
  label?: string;
  /** In-app notification message (short). */
  inApp?: string;
}

function copyFor(event: BillingNotifyEvent, d: NotifyData): Copy {
  const amount = d.amountKobo != null ? formatNaira(d.amountKobo) : '';
  const plan = d.planName ?? 'your plan';
  switch (event) {
    case 'card_added':
      return { subject: 'A card was added to your account', eyebrow: 'Billing', title: 'Card added',
        body: `${cardWord(d)} is now saved on your Ascentor account. If this was not you, open Billing and remove it, then contact us.`,
        label: 'Open Billing', inApp: `${cardWord(d)} was added to your account.` };
    case 'card_removed':
      return { subject: 'A card was removed from your account', eyebrow: 'Billing', title: 'Card removed',
        body: `${cardWord(d)} was removed from your Ascentor account. If this was not you, contact us right away.`,
        label: 'Open Billing', inApp: `${cardWord(d)} was removed from your account.` };
    case 'card_default_changed':
      return { subject: 'Your default card changed', eyebrow: 'Billing', title: 'Default card changed',
        body: `${cardWord(d)} is now the card we use for your subscription.`,
        label: 'Open Billing', inApp: `${cardWord(d)} is now your default card.` };
    case 'payment_succeeded': {
      const next = fmtDate(d.nextChargeAt);
      return { subject: `We received your payment of ${amount}`, eyebrow: 'Receipt', title: 'Payment received',
        body: `Thank you. We charged ${cardWord(d)} for ${plan}.`,
        lines: [`Amount: ${amount}`, `Plan: ${plan}`, ...(next ? [`Next charge: ${next}`] : [])],
        label: 'See your receipt', inApp: `Payment of ${amount} received for ${plan}.${next ? ` Next charge ${next}.` : ''}` };
    }
    case 'payment_failed': {
      const grace = fmtDate(d.graceEndsAt);
      const why = plainFailureReason(d.reason);
      return { subject: 'We could not take your payment', eyebrow: 'Action needed', title: 'Your payment did not go through',
        body: `We tried to charge ${cardWord(d)} for ${plan}, but ${why}. Your access stays fully open${grace ? ` until ${grace}` : ' for 7 days'} while we try again. You can fix it any time by updating your card.`,
        lines: [...(amount ? [`Amount: ${amount}`] : []), ...(grace ? [`Full access until: ${grace}`] : [])],
        label: 'Update your card', inApp: `Your payment did not go through: ${why}. Update your card to keep full access.` };
    }
    case 'trial_started': {
      const end = fmtDate(d.trialEndsAt);
      return { subject: 'Your 7 day free trial has started', eyebrow: 'Welcome', title: 'Your trial has started',
        body: `You have 7 days to try ${plan}. We will charge ${cardWord(d)}${amount ? ` ${amount}` : ''} on day 8${end ? `, ${end}` : ''}, unless you cancel before then. Cancel during the trial and you pay nothing.`,
        label: 'Open Billing', inApp: `Your 7 day trial has started.${end ? ` First charge ${end}.` : ''}` };
    }
    case 'trial_ending': {
      const end = fmtDate(d.trialEndsAt ?? d.nextChargeAt);
      return { subject: 'Your trial ends tomorrow', eyebrow: 'Reminder', title: 'Your trial ends tomorrow',
        body: `Your free trial ends${end ? ` on ${end}` : ' tomorrow'}. We will then charge ${cardWord(d)}${amount ? ` ${amount}` : ''} for ${plan}. If you would rather not continue, you can cancel in Billing and you will not be charged.`,
        label: 'Open Billing', inApp: `Your trial ends tomorrow. ${amount ? `${amount} will be charged.` : 'Billing starts then.'}` };
    }
    case 'grace_started': {
      const grace = fmtDate(d.graceEndsAt);
      return { subject: 'Your access stays open for 7 more days', eyebrow: 'Action needed', title: 'We are still trying your payment',
        body: `Your payment did not go through, so we have given you 7 days${grace ? `, until ${grace},` : ''} to sort it out. Everything stays open for you in that time. Add or update a card and we will take the payment straight away.`,
        label: 'Update your card', inApp: `Full access stays open${grace ? ` until ${grace}` : ' for 7 days'}. Update your card to stay subscribed.` };
    }
    case 'lapsed':
      return { subject: 'Your subscription has paused', eyebrow: 'Billing', title: 'Your subscription has paused',
        body: 'We could not take your payment, so your plan has paused. You still have Today, your daily practices, your growth record, open house and direct messages. Sage, Circle chat, advanced Learn and mentor sessions are on hold. Come back any time: pay again and everything opens at once.',
        label: 'Reactivate', inApp: 'Your subscription has paused. Reactivate any time to get everything back.' };
    case 'reactivated':
      return { subject: 'Welcome back', eyebrow: 'Billing', title: 'You are back',
        body: `Your payment went through and ${plan} is fully open again.${amount ? ` We charged ${amount}.` : ''}`,
        label: 'Open Billing', inApp: 'Welcome back. Your plan is fully open again.' };
    case 'group_warning': {
      const when = fmtDate(d.renewalDate ?? d.nextChargeAt);
      const n = d.activeCount != null ? `${d.activeCount} active member${d.activeCount === 1 ? '' : 's'}` : 'fewer than 3 active members';
      return { subject: 'Your group price needs one more friend', eyebrow: 'Heads up', title: 'Keep your group price',
        body: `Your group has ${n} and the group price needs 3. At your next charge${when ? ` on ${when}` : ''} you will move to the solo price${d.soloPriceKobo ? ` of ${formatNaira(d.soloPriceKobo)}` : ''} unless someone joins your group before then.`,
        label: 'Open Billing', inApp: `Your group needs 3 active members to keep the group price${when ? ` at your ${when} charge` : ''}.` };
    }
    case 'credit_earned': {
      const credit = d.creditKobo != null ? formatNaira(d.creditKobo) : 'credit';
      const bal = d.balanceKobo != null ? formatNaira(d.balanceKobo) : '';
      return { subject: `You earned ${credit} credit`, eyebrow: 'Referral', title: `You earned ${credit}`,
        body: `A friend you invited has paid and the refund window has passed, so ${credit} has been added to your credit. It comes off your next charge.${bal ? ` Your balance is ${bal}.` : ''}`,
        label: 'Open Billing', inApp: `You earned ${credit} credit from a friend you invited.${bal ? ` Balance ${bal}.` : ''}` };
    }
  }
}

/** Builds subject, HTML and plain text for an event. Pure, so tests can assert on the output. */
export function buildEmail(event: BillingNotifyEvent, data: NotifyData, recipient = 'member'): BuiltEmail {
  const c = copyFor(event, data);
  const url = `${SITE}${BILLING_LINK}`;
  const label = c.label ?? 'Open Billing';
  const lines = c.lines ?? [];
  const html = brandedEmailLayout({
    preheader: c.body,
    eyebrow: c.eyebrow,
    heading: c.title,
    recipient,
    content:
      p(esc(c.body)) +
      (lines.length ? `<ul style="margin:0 0 16px;padding-left:20px;">${lines.map((l) => `<li style="margin:0 0 8px;">${esc(l)}</li>`).join('')}</ul>` : '') +
      goldButton(esc(label), url),
  });
  const text = [c.title, '', c.body, ...(lines.length ? ['', ...lines.map((l) => `- ${l}`)] : []), '', `${label}: ${url}`, '', 'Ascentor'].join('\n');
  return { subject: c.subject, title: c.title, body: c.body, lines, label, url, html, text };
}

// ── Delivery ─────────────────────────────────────────────────────────────────

async function deliver(userId: string, event: BillingNotifyEvent, data: NotifyData): Promise<void> {
  const copy = copyFor(event, data);
  // In-app first: it must not depend on the mailer.
  try {
    const { supabaseAdmin } = await import('@/lib/supabase/admin');
    const { error } = await supabaseAdmin.from('notifications').insert({
      user_id: userId, type: 'billing', title: copy.title, message: copy.inApp ?? copy.body, link: BILLING_LINK,
    });
    if (error) console.error('[billing/notify] in-app insert failed:', event, error.message);
  } catch (e) {
    console.error('[billing/notify] in-app threw:', event, e instanceof Error ? e.message : 'unknown');
  }
  try {
    const { supabaseAdmin } = await import('@/lib/supabase/admin');
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
    const to = u?.user?.email;
    if (!to) return;
    const built = buildEmail(event, data, to);
    const { sendEmail } = await import('@/lib/nodemailer');
    await sendEmail({ to, subject: built.subject, html: built.html, text: built.text });
  } catch (e) {
    console.error('[billing/notify] email failed:', event, e instanceof Error ? e.message : 'unknown');
  }
}

const make = (event: BillingNotifyEvent) => (userId: string, data: NotifyData = {}) => deliver(userId, event, data);

export const notifyCardAdded = make('card_added');
export const notifyCardRemoved = make('card_removed');
export const notifyCardDefaultChanged = make('card_default_changed');
export const notifyPaymentSucceeded = make('payment_succeeded');
export const notifyPaymentFailed = make('payment_failed');
export const notifyTrialStarted = make('trial_started');
export const notifyTrialEnding = make('trial_ending');
export const notifyGraceStarted = make('grace_started');
export const notifyLapsed = make('lapsed');
export const notifyReactivated = make('reactivated');
export const notifyGroupWarning = make('group_warning');
export const notifyCreditEarned = make('credit_earned');
