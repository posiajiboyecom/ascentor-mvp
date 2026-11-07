// lib/email/system.ts
// The Ascentor email system: contacts gathered from every place an address is collected, campaigns to any mix of them,
// sent from the Hostinger mailbox at a steady pace under a rolling 24-hour cap. Everything here runs with the service role.
//
// Flow: a campaign is drafted → started (or scheduled) → its audience is copied into email_sends (the queue) → the
// dispatcher (Trigger.dev every 5 minutes, the daily cron, and the admin screen while it is open) claims a few rows at a
// time and sends them, never more than the daily cap allows → the campaign is marked sent when its queue is empty.
// Every message carries an unsubscribe link and List-Unsubscribe headers; opens and clicks are tracked per recipient.

import crypto from 'crypto';
import sanitizeHtml from 'sanitize-html';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sendEmail, classifyEmailError, emailErrorCode } from '@/lib/nodemailer';
import { FROM_DEFAULT, REPLY_TO } from '@/lib/contact';
import { brandedEmailLayout, esc } from '@/lib/emailTemplate';

// Server code only (admin console, cron, Trigger.dev). It builds its own service-role client rather than importing
// lib/supabase/admin (marked server-only, which Trigger.dev's plain Node runtime can't load). The key is never NEXT_PUBLIC,
// so it can't reach a browser even if a client component imported this by mistake.
let _db: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!_db) _db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  return _db;
}
export const emailDb = db;

import { SOURCES, SOURCE_LABEL, sourceLabel, tagLabel, isEmail, parseAudience, audienceIsEmpty, describeAudience, type Audience } from './describe';
export { SOURCES, SOURCE_LABEL, sourceLabel, tagLabel, isEmail, parseAudience, audienceIsEmpty, describeAudience, type Audience };

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://joinascentor.com').replace(/\/$/, '');

// ── types ───────────────────────────────────────────────────────────────────
export interface Settings { from_name: string; reply_to: string | null; daily_limit: number; per_minute: number; footer_text: string }
export interface Campaign {
  id: string; name: string; subject: string; preheader: string; heading: string; body_html: string; audience: Audience;
  status: 'draft' | 'scheduled' | 'sending' | 'paused' | 'sent' | 'cancelled';
  scheduled_at: string | null; started_at: string | null; finished_at: string | null; total: number; created_at: string; updated_at: string;
}
export interface Stats { total: number; queued: number; sent: number; failed: number; skipped: number; opened: number; clicked: number; unsubscribed: number }
export const EMPTY_STATS: Stats = { total: 0, queued: 0, sent: 0, failed: 0, skipped: 0, opened: 0, clicked: 0, unsubscribed: 0 };

// ── settings ────────────────────────────────────────────────────────────────
export async function getSettings(): Promise<Settings> {
  const { data } = await db().from('email_settings').select('from_name, reply_to, daily_limit, per_minute, footer_text').eq('id', true).maybeSingle();
  return {
    from_name: (data?.from_name as string) || 'Ascentor',
    reply_to: (data?.reply_to as string | null) ?? null,
    daily_limit: Number(data?.daily_limit ?? 800),
    per_minute: Number(data?.per_minute ?? 20),
    footer_text: (data?.footer_text as string) ?? 'Ascentor · Lagos, Nigeria',
  };
}

export async function sentLast24h(): Promise<number> {
  const { data } = await db().rpc('email_sent_last_24h');
  return Number(data ?? 0);
}

// ── rendering ───────────────────────────────────────────────────────────────
const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: ['h1', 'h2', 'h3', 'h4', 'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'div', 'span', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'center'],
  allowedAttributes: { a: ['href', 'target', 'rel', 'style', 'title'], img: ['src', 'alt', 'width', 'height', 'style'], td: ['style', 'align', 'width', 'colspan'], th: ['style', 'align', 'width'], table: ['style', 'width', 'cellpadding', 'cellspacing', 'role', 'align'], '*': ['style', 'align'] },
  allowedSchemes: ['https', 'http', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['https'] },
  disallowedTagsMode: 'discard',
  // Only absolute https images (a relative or broken src shows as a broken image in every inbox).
  exclusiveFilter: (frame) => frame.tag === 'img' && !/^https:\/\//i.test(frame.attribs.src || ''),
  // Links in brand rust unless the writer styled them.
  transformTags: { a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, style: attribs.style || 'color:#B6502A;text-decoration:underline;' } }) },
};
export const cleanBody = (html: string) => sanitizeHtml(html ?? '', SANITIZE);

function trackingSecret(): string {
  const base = process.env.EMAIL_TRACKING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.CRON_SECRET || 'ascentor-email';
  return crypto.createHash('sha256').update(`email-tracking:${base}`).digest('hex');
}
/** Signature on a click link, so the redirect only ever goes where the email itself pointed (no open redirect). */
export const signLink = (token: string, url: string) => crypto.createHmac('sha256', trackingSecret()).update(`${token}\n${url}`).digest('base64url').slice(0, 22);
export function verifyLink(token: string, url: string, sig: string): boolean {
  const want = Buffer.from(signLink(token, url));
  const got = Buffer.from(sig || '');
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

const firstName = (name: string | null | undefined) => (name ?? '').trim().split(/\s+/)[0] || '';

/** {{first_name}}, {{name}}, {{email}}: escaped for HTML, with "there" when a first name is unknown. */
function merge(text: string, r: { email: string; name: string | null }, html: boolean): string {
  const v = (s: string) => (html ? esc(s) : s);
  return text
    .replace(/\{\{\s*first_name\s*\}\}/gi, v(firstName(r.name) || 'there'))
    .replace(/\{\{\s*name\s*\}\}/gi, v((r.name ?? '').trim() || 'there'))
    .replace(/\{\{\s*email\s*\}\}/gi, v(r.email));
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => `${label.replace(/<[^>]+>/g, '')} (${href})`)
    .replace(/<\/(p|h[1-4]|li|tr|div|blockquote)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n').trim();
}

export interface Rendered { subject: string; html: string; text: string; headers: Record<string, string> }

/**
 * The finished email for one recipient. With a token, links are tracked, an open pixel is added and the unsubscribe
 * link works; without one (previews and tests) links go straight to their targets and the unsubscribe link is inert.
 */
export function renderEmail(c: Pick<Campaign, 'subject' | 'preheader' | 'heading' | 'body_html'>, r: { email: string; name: string | null; token?: string | null; reason?: string }, s: Settings): Rendered {
  const token = r.token ?? null;
  let body = merge(cleanBody(c.body_html), r, true);
  if (token) {
    body = body.replace(/href="(https?:\/\/[^"]+)"/gi, (_m, raw: string) => {
      const url = raw.replace(/&amp;/g, '&');
      return `href="${SITE_URL}/api/email/c/${token}?u=${encodeURIComponent(url)}&amp;s=${signLink(token, url)}"`;
    });
  }
  const unsubUrl = token ? `${SITE_URL}/unsubscribe/${token}` : `${SITE_URL}/unsubscribe/preview`;
  const reason = r.reason ? `${esc(r.reason)} ` : '';
  const footer = `
    <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#9CA3AF;">
      ${reason}<a href="${unsubUrl}" style="color:#B6502A;text-decoration:underline;">Unsubscribe</a>${s.footer_text ? ` · ${esc(s.footer_text)}` : ''}
    </p>${token ? `<img src="${SITE_URL}/api/email/o/${token}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />` : ''}`;
  const subject = merge(c.subject, r, false).slice(0, 200);
  const html = brandedEmailLayout({
    preheader: merge(c.preheader || '', r, false),
    eyebrow: s.from_name || 'Ascentor',
    heading: merge(c.heading || '', r, false),
    content: body,
    recipient: r.email,
    footer,
  });
  const mailbox = (s.reply_to || REPLY_TO).replace(/^.*<([^>]+)>.*$/, '$1');
  const headers: Record<string, string> = token
    ? {
        'List-Unsubscribe': `<${SITE_URL}/api/email/unsubscribe?t=${token}>, <mailto:${mailbox}?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'Precedence': 'bulk',
      }
    : {};
  return { subject, html, text: `${htmlToText(body)}\n\n—\nUnsubscribe: ${unsubUrl}`, headers };
}

/** "Ascentor <a.samuel@joinascentor.com>" with the display name from settings. */
export function fromWithName(name: string): string {
  const m = FROM_DEFAULT.match(/<([^>]+)>/);
  const addr = m ? m[1] : FROM_DEFAULT;
  const safe = (name || 'Ascentor').replace(/["<>\r\n]/g, '').trim() || 'Ascentor';
  return `${safe} <${addr}>`;
}

/** One line on why this person is getting the email, from their categories. */
function reasonFor(sources: string[] | null | undefined): string {
  const s = (sources ?? []).filter((k) => k !== 'manual' && k !== 'imported');
  if (!s.length) return 'You are receiving this because you are in Ascentor’s contacts.';
  const map: Record<string, string> = {
    newsletter: 'subscribed to our newsletter', members: 'have an Ascentor account', summit: 'registered for The Elevation Summit',
    summit_interest: 'asked to hear about The Elevation Summit', donors: 'supported Ascentor with a donation', events: 'registered for an Ascentor event',
    shop: 'ordered from the Ascentor shop', shop_leads: 'left your email in the Ascentor shop', waitlist: 'joined the Ascentor waitlist',
    lead_magnets: 'downloaded a free Ascentor resource', contact_form: 'contacted Ascentor', mentors: 'applied to mentor with Ascentor',
    partners: 'are an Ascentor partner', careers: 'applied for a role at Ascentor',
  };
  const first = s.map((k) => map[k]).find(Boolean);
  return first ? `You are receiving this because you ${first}.` : 'You are receiving this because you are in Ascentor’s contacts.';
}

// ── sending ─────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Starts any scheduled campaign whose time has come: fills its queue and switches it to sending. */
async function promoteDue(): Promise<number> {
  const { data } = await db().from('email_campaigns').select('id').eq('status', 'scheduled').lte('scheduled_at', new Date().toISOString());
  let n = 0;
  for (const c of (data ?? []) as { id: string }[]) {
    await db().rpc('email_sync_contacts');
    await db().rpc('email_enqueue', { cid: c.id });
    const { error } = await db().from('email_campaigns').update({ status: 'sending', started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', c.id).eq('status', 'scheduled');
    if (!error) n++;
  }
  return n;
}

/** Marks sending campaigns whose queue is empty as sent. */
async function finishDrained(): Promise<void> {
  const { data } = await db().from('email_campaigns').select('id').eq('status', 'sending');
  for (const c of (data ?? []) as { id: string }[]) {
    const { count } = await db().from('email_sends').select('id', { count: 'exact', head: true }).eq('campaign_id', c.id).in('status', ['queued', 'sending']);
    if ((count ?? 0) === 0) await db().from('email_campaigns').update({ status: 'sent', finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', c.id).eq('status', 'sending');
  }
}

export interface DispatchResult { ran: boolean; reason?: string; sent: number; failed: number; skipped: number; promoted: number; capLeft: number }

/**
 * Sends queued messages for up to `budgetMs`, at the configured pace and never beyond the rolling 24-hour cap.
 * Only one dispatcher runs at a time (a lease in email_settings); a second caller returns at once.
 */
export async function dispatch(opts: { budgetMs: number; owner: string }): Promise<DispatchResult> {
  const out: DispatchResult = { ran: false, sent: 0, failed: 0, skipped: 0, promoted: 0, capLeft: 0 };
  const deadline = Date.now() + Math.max(5_000, opts.budgetMs);
  const { data: leased } = await db().rpc('email_lease', { owner: opts.owner, seconds: Math.ceil(opts.budgetMs / 1000) + 60 });
  if (!leased) return { ...out, reason: 'Another send is already running.' };
  out.ran = true;
  try {
    out.promoted = await promoteDue();
    const s = await getSettings();
    const gap = Math.ceil(60_000 / Math.max(1, s.per_minute));
    let capLeft = Math.max(0, s.daily_limit - (await sentLast24h()));
    const campaigns = new Map<string, Campaign | null>();
    const from = fromWithName(s.from_name);

    while (capLeft > 0 && Date.now() + gap + 15_000 < deadline) {
      const want = Math.min(capLeft, Math.max(1, Math.floor((deadline - Date.now() - 15_000) / gap)), 25);
      const { data: rows } = await db().rpc('email_claim', { n: want });
      const batch = (rows ?? []) as { id: string; campaign_id: string; email: string; name: string | null; token: string }[];
      if (!batch.length) break;

      // Contacts can unsubscribe or bounce after the queue was filled: check them all at once.
      const { data: contacts } = await db().from('email_contacts').select('email, name, sources, unsubscribed_at, bounced_at').in('email', batch.map((b) => b.email));
      const byEmail = new Map(((contacts ?? []) as { email: string; name: string | null; sources: string[]; unsubscribed_at: string | null; bounced_at: string | null }[]).map((c) => [c.email, c]));

      for (const row of batch) {
        if (Date.now() + 10_000 > deadline || capLeft <= 0) {
          await db().from('email_sends').update({ status: 'queued', claimed_at: null }).eq('id', row.id); // hand back
          continue;
        }
        if (!campaigns.has(row.campaign_id)) {
          const { data } = await db().from('email_campaigns').select('*').eq('id', row.campaign_id).maybeSingle();
          campaigns.set(row.campaign_id, (data as Campaign | null) ?? null);
        }
        const c = campaigns.get(row.campaign_id);
        const contact = byEmail.get(row.email);
        if (!c || c.status !== 'sending') { await db().from('email_sends').update({ status: 'queued', claimed_at: null }).eq('id', row.id); continue; }
        if (contact?.unsubscribed_at || contact?.bounced_at) {
          await db().from('email_sends').update({ status: 'skipped', error: contact.unsubscribed_at ? 'Unsubscribed' : 'Address bounced earlier' }).eq('id', row.id);
          out.skipped++; continue;
        }
        const started = Date.now();
        try {
          const m = renderEmail(c, { email: row.email, name: contact?.name ?? row.name, token: row.token, reason: reasonFor(contact?.sources) }, s);
          await sendEmail({ to: row.email, subject: m.subject, html: m.html, text: m.text, from, replyTo: s.reply_to || undefined, headers: m.headers, required: true });
          await db().from('email_sends').update({ status: 'sent', sent_at: new Date().toISOString(), error: null }).eq('id', row.id);
          out.sent++; capLeft--;
        } catch (e) {
          const kind = classifyEmailError(e);
          const reply = `${(e as { response?: string })?.response ?? ''} ${(e as Error)?.message ?? ''}`;
          const msg = `${kind}: ${emailErrorCode(e)} ${reply}`.replace(/\s+/g, ' ').trim().slice(0, 300);
          // The mailbox itself can't send right now (login, connection, quota, sender refused): put the row back and stop.
          const quota = /limit|quota|rate|too many|exceeded|throttl/i.test(reply) || [421, 450, 451, 452, 454].includes(Number((e as { responseCode?: number })?.responseCode));
          if (kind === 'auth' || kind === 'connection' || kind === 'not_configured' || kind === 'sender' || quota) {
            await db().from('email_sends').update({ status: 'queued', claimed_at: null, error: msg }).eq('id', row.id);
            out.reason = kind === 'auth' ? 'The mailbox refused the login. Check SMTP_USER and SMTP_PASS.'
              : kind === 'not_configured' ? 'Email is not set up (SMTP_USER / SMTP_PASS).'
              : kind === 'sender' ? 'The mail server refused the sender address.'
              : quota ? 'The mail server says the sending limit is reached. Sending resumes automatically later; consider lowering the daily limit in Settings.'
              : 'Could not reach the mail server. Sending will retry.';
            return { ...out, capLeft };
          }
          await db().from('email_sends').update({ status: 'failed', error: msg }).eq('id', row.id);
          // A permanent refusal of the address itself (no such mailbox, mailbox disabled): never email it again.
          const badAddress = kind === 'rejected' && /5\.1\.\d|5\.2\.1|user unknown|no such (user|mailbox)|mailbox (unavailable|not found|disabled)|does not exist|recipient (rejected|address rejected)|invalid recipient/i.test(reply);
          if (badAddress) await db().from('email_contacts').update({ bounced_at: new Date().toISOString(), bounce_reason: msg, updated_at: new Date().toISOString() }).eq('email', row.email);
          out.failed++;
        }
        const wait = gap - (Date.now() - started);
        if (wait > 0) await sleep(wait);
      }
    }
    out.capLeft = capLeft;
    if (capLeft <= 0) out.reason = 'Today’s sending limit is reached. Sending continues automatically as the 24-hour window frees up.';
    await finishDrained();
    return out;
  } finally {
    await db().rpc('email_release', { owner: opts.owner });
  }
}

/** Sends one copy to `to` exactly as recipients see it (no tracking; subject marked as a test). */
export async function sendTest(c: Pick<Campaign, 'subject' | 'preheader' | 'heading' | 'body_html'>, to: string, name: string | null): Promise<void> {
  const s = await getSettings();
  const m = renderEmail(c, { email: to, name, token: null, reason: 'This is a test send from the Ascentor email console.' }, s);
  await sendEmail({ to, subject: `[Test] ${m.subject}`, html: m.html, text: m.text, from: fromWithName(s.from_name), replyTo: s.reply_to || undefined, required: true });
}

/** Asks the Trigger.dev dispatcher to start now (it also runs every 5 minutes). Never throws. */
export async function kickDispatcher(): Promise<void> {
  if (!process.env.TRIGGER_SECRET_KEY) return;
  try {
    const { tasks } = await import('@trigger.dev/sdk/v3');
    await tasks.trigger('email-dispatcher-now', {});
  } catch (e) { console.warn('[email] could not start the dispatcher now:', (e as Error).message); }
}
