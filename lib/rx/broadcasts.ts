import 'server-only';
// lib/rx/broadcasts.ts
// Admin broadcasts: one message, sent in the app, by email, or both, to everyone or to a group.
//
// How a send works
//   1. The audience is resolved to a list of members (demo accounts never included).
//   2. They are handled in small batches. For each member: an in-app notification (the bell, and a push if they have turned
//      push on), and an email, according to the channel and to their own switches (muted announcements, announcement emails off).
//   3. Each member handled gets a row in broadcast_deliveries. That row makes a send safe to repeat: anyone with a row is skipped,
//      so a retry after a timeout never emails the same person twice, and a long list can finish over several runs.
//   4. A send that runs out of time stays "sending" and the hourly job picks it up.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendPushToUser } from '@/lib/push';
import { sendEmail } from '@/lib/nodemailer';
import { buildNoticeEmail } from './notifications';
import { deliveryPlan, matches, parseAudience, validateBroadcast, type Audience, type BroadcastInput, type MemberFacts } from './audience';
import type { NoticeData } from './notice-types';

export const BATCH = 20;
export const DEFAULT_BUDGET_MS = 45_000;
const EMAIL_PREF = 'Email: Announcements';

export interface BroadcastRow {
  id: string; title: string; body: string; link_url: string | null; link_label: string | null;
  channel: 'in_app' | 'email' | 'both'; audience: unknown; pin_card: boolean; pin_until: string | null;
  status: 'draft' | 'sending' | 'sent' | 'cancelled'; total: number | null; in_app_sent: number; emailed: number; email_failed: number;
  created_by: string | null; created_at: string; sent_at: string | null;
}

const COLS = 'id, title, body, link_url, link_label, channel, audience, pin_card, pin_until, status, total, in_app_sent, emailed, email_failed, created_by, created_at, sent_at';

// ── who ─────────────────────────────────────────────────────────────────────

async function demoIds(): Promise<Set<string>> {
  const { data } = await supabaseAdmin.from('member_profile').select('user_id').eq('is_demo', true);
  return new Set(((data ?? []) as { user_id: string }[]).map((d) => d.user_id));
}

/** Every member an audience reaches, as a sorted list of user ids. Demo accounts are never included. */
export async function recipientsFor(audience: Audience): Promise<string[]> {
  const demo = await demoIds();
  let ids: string[] = [];

  if (audience.kind === 'all') {
    for (let from = 0; ; from += 1000) {
      const { data } = await supabaseAdmin.from('profiles').select('id').order('id').range(from, from + 999);
      const rows = (data ?? []) as { id: string }[];
      ids.push(...rows.map((r) => r.id));
      if (rows.length < 1000) break;
    }
  } else if (audience.kind === 'circle') {
    const { data } = await supabaseAdmin.from('circle_seats').select('user_id').eq('circle_id', audience.value);
    ids = ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
  } else {
    const col = audience.kind === 'stage' ? 'stage' : audience.kind === 'city' ? 'city' : 'language';
    const { data } = await supabaseAdmin.from('member_profile').select('user_id').ilike(col, audience.value);
    ids = ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
  }
  return [...new Set(ids)].filter((id) => !demo.has(id)).sort();
}

interface Prefs { annMuted: boolean; emailOff: boolean }

async function prefsFor(ids: string[]): Promise<Map<string, Prefs>> {
  const out = new Map<string, Prefs>();
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabaseAdmin.from('member_profile').select('user_id, ann_muted, notif').in('user_id', ids.slice(i, i + 150));
    for (const r of (data ?? []) as { user_id: string; ann_muted: boolean | null; notif: Record<string, boolean> | null }[]) {
      out.set(r.user_id, { annMuted: !!r.ann_muted, emailOff: r.notif?.[EMAIL_PREF] === false });
    }
  }
  return out;
}

/** How many people a send would reach, and how many of them would also get the email. For the confirmation step. */
export async function countAudience(audience: Audience, channel: 'in_app' | 'email' | 'both'): Promise<{ total: number; inApp: number; email: number }> {
  const ids = await recipientsFor(audience);
  const prefs = await prefsFor(ids);
  let inApp = 0; let email = 0;
  for (const id of ids) {
    const plan = deliveryPlan(channel, prefs.get(id) ?? { annMuted: false, emailOff: false });
    if (plan.inApp) inApp++;
    if (plan.email) email++;
  }
  return { total: ids.length, inApp, email };
}

// ── one person ──────────────────────────────────────────────────────────────

interface Deliver { in_app: boolean; pushed: boolean; emailed: boolean; skipped: string | null; error: string | null }

async function deliverOne(bc: Pick<BroadcastRow, 'id' | 'title' | 'body' | 'link_url' | 'link_label' | 'channel'>, userId: string, prefs: Prefs, emailOf: (id: string) => Promise<string | null>, asTest = false): Promise<Deliver> {
  const plan = deliveryPlan(bc.channel, prefs);
  const out: Deliver = { in_app: false, pushed: false, emailed: false, skipped: plan.skipped, error: null };
  const title = asTest ? `[Test] ${bc.title}` : bc.title;

  if (plan.inApp) {
    const { error } = await supabaseAdmin.from('notifications').insert({
      user_id: userId, type: 'info', kind: 'broadcast', title, message: bc.body, link: bc.link_url, entity_id: bc.id,
    });
    if (error) out.error = `in-app: ${error.message}`.slice(0, 200); else out.in_app = true;
  }
  if (plan.push) {
    try { await sendPushToUser(supabaseAdmin, userId, { title, body: bc.body.slice(0, 140), url: bc.link_url ?? '/dashboard', tag: `broadcast-${bc.id}` }); out.pushed = true; } catch { /* push is best effort */ }
  }
  if (plan.email) {
    try {
      const to = await emailOf(userId);
      if (!to) out.skipped = out.skipped ?? 'no email address';
      else {
        await sendEmail({ to, subject: title, html: buildNoticeEmail({ eyebrow: 'From Ascentor', title, body: bc.body, url: bc.link_url ?? '/dashboard', label: bc.link_label ?? (bc.link_url ? 'Open' : 'Open Ascentor'), recipient: to }) });
        out.emailed = true;
      }
    } catch (e) { out.error = `email: ${e instanceof Error ? e.message : 'failed'}`.slice(0, 200); }
  }
  return out;
}

async function emailLookup(ids: string[]): Promise<(id: string) => Promise<string | null>> {
  const cache = new Map<string, string | null>();
  for (let i = 0; i < ids.length; i += 10) {
    await Promise.all(ids.slice(i, i + 10).map(async (id) => {
      try { const { data } = await supabaseAdmin.auth.admin.getUserById(id); cache.set(id, data?.user?.email ?? null); } catch { cache.set(id, null); }
    }));
  }
  return async (id) => cache.get(id) ?? null;
}

// ── a whole send ────────────────────────────────────────────────────────────

async function recount(id: string): Promise<void> {
  const [a, b, c] = await Promise.all([
    supabaseAdmin.from('broadcast_deliveries').select('user_id', { count: 'exact', head: true }).eq('broadcast_id', id).eq('in_app', true),
    supabaseAdmin.from('broadcast_deliveries').select('user_id', { count: 'exact', head: true }).eq('broadcast_id', id).eq('emailed', true),
    supabaseAdmin.from('broadcast_deliveries').select('user_id', { count: 'exact', head: true }).eq('broadcast_id', id).not('error', 'is', null),
  ]);
  await supabaseAdmin.from('broadcasts').update({ in_app_sent: a.count ?? 0, emailed: b.count ?? 0, email_failed: c.count ?? 0 }).eq('id', id);
}

/** Works through the members not yet handled, until none are left or the time budget runs out. Safe to call again. */
export async function processBroadcast(id: string, budgetMs = DEFAULT_BUDGET_MS): Promise<{ done: boolean; handled: number; remaining: number }> {
  const started = Date.now();
  const { data: row } = await supabaseAdmin.from('broadcasts').select(COLS).eq('id', id).maybeSingle();
  const bc = row as BroadcastRow | null;
  if (!bc || bc.status !== 'sending') return { done: bc?.status === 'sent', handled: 0, remaining: 0 };
  const audience = parseAudience(bc.audience);
  if (!audience) { await supabaseAdmin.from('broadcasts').update({ status: 'cancelled' }).eq('id', id); return { done: true, handled: 0, remaining: 0 }; }

  const all = await recipientsFor(audience);
  const handledIds = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabaseAdmin.from('broadcast_deliveries').select('user_id').eq('broadcast_id', id).order('user_id').range(from, from + 999);
    const rows = (data ?? []) as { user_id: string }[];
    rows.forEach((r) => handledIds.add(r.user_id));
    if (rows.length < 1000) break;
  }
  const pending = all.filter((u) => !handledIds.has(u));
  let handled = 0;

  for (let i = 0; i < pending.length; i += BATCH) {
    if (Date.now() - started > budgetMs) break;
    const chunk = pending.slice(i, i + BATCH);
    const prefs = await prefsFor(chunk);
    const needsEmail = bc.channel !== 'in_app';
    const emailOf = needsEmail ? await emailLookup(chunk) : async () => null;
    const results = await Promise.all(chunk.map(async (uid) => ({ uid, r: await deliverOne(bc, uid, prefs.get(uid) ?? { annMuted: false, emailOff: false }, emailOf) })));
    await supabaseAdmin.from('broadcast_deliveries').upsert(results.map(({ uid, r }) => ({ broadcast_id: id, user_id: uid, in_app: r.in_app, pushed: r.pushed, emailed: r.emailed, skipped: r.skipped, error: r.error })), { onConflict: 'broadcast_id,user_id', ignoreDuplicates: true });
    handled += chunk.length;
  }

  const remaining = Math.max(0, pending.length - handled);
  await recount(id);
  if (remaining === 0) await supabaseAdmin.from('broadcasts').update({ status: 'sent', sent_at: new Date().toISOString(), total: all.length }).eq('id', id);
  return { done: remaining === 0, handled, remaining };
}

export async function createBroadcast(input: BroadcastInput, adminId: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const v = validateBroadcast(input);
  if (!v.ok) return v;
  const c = v.value;
  const { data, error } = await supabaseAdmin.from('broadcasts').insert({
    title: c.title, body: c.body, link_url: c.linkUrl, link_label: c.linkLabel, channel: c.channel, audience: c.audience,
    pin_card: c.pinCard, pin_until: c.pinUntil, created_by: adminId, status: 'draft',
  }).select('id').single();
  if (error || !data) return { ok: false, error: 'We couldn’t save that message. Please try again.' };
  return { ok: true, id: data.id as string };
}

/** Starts a draft: marks it sending and handles the first batches straight away. */
export async function startSending(id: string): Promise<{ ok: true; done: boolean; remaining: number } | { ok: false; error: string }> {
  const { data: updated } = await supabaseAdmin.from('broadcasts').update({ status: 'sending' }).eq('id', id).eq('status', 'draft').select('id').maybeSingle();
  if (!updated) return { ok: false, error: 'This message was already sent.' };
  const r = await processBroadcast(id);
  return { ok: true, done: r.done, remaining: r.remaining };
}

/** Sends the message to one person, the admin, exactly as members would get it. Leaves no record against the audience. */
export async function sendTestTo(input: BroadcastInput, adminId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const v = validateBroadcast(input);
  if (!v.ok) return v;
  const c = v.value;
  const bc = { id: `test-${Date.now()}`, title: c.title, body: c.body, link_url: c.linkUrl, link_label: c.linkLabel, channel: c.channel };
  const prefs = { annMuted: false, emailOff: false };
  const emailOf = await emailLookup([adminId]);
  const r = await deliverOne({ ...bc, id: adminId }, adminId, prefs, emailOf, true);
  if (r.error) return { ok: false, error: `The test didn’t fully send (${r.error}).` };
  return { ok: true };
}

/** For the hourly job: finish any send that ran out of time. */
export async function continueSending(): Promise<{ resumed: number }> {
  const { data } = await supabaseAdmin.from('broadcasts').select('id').eq('status', 'sending').order('created_at');
  let resumed = 0;
  for (const r of (data ?? []) as { id: string }[]) { await processBroadcast(r.id, 40_000); resumed++; }
  return { resumed };
}

export async function listBroadcasts(limit = 30): Promise<BroadcastRow[]> {
  const { data } = await supabaseAdmin.from('broadcasts').select(COLS).order('created_at', { ascending: false }).limit(limit);
  return (data ?? []) as BroadcastRow[];
}

// ── the card in the sidebar ─────────────────────────────────────────────────

/** The newest pinned broadcast this member should see as a card, or null. */
export async function getPinnedNotice(facts: MemberFacts): Promise<NoticeData | null> {
  const { data } = await supabaseAdmin.from('broadcasts').select('id, title, body, link_url, link_label, audience, pin_until').eq('pin_card', true).in('status', ['sending', 'sent']).order('created_at', { ascending: false }).limit(8);
  const nowMs = Date.now();
  for (const r of (data ?? []) as { id: string; title: string; body: string; link_url: string | null; link_label: string | null; audience: unknown; pin_until: string | null }[]) {
    if (r.pin_until && new Date(r.pin_until).getTime() <= nowMs) continue;
    const a = parseAudience(r.audience);
    if (!a || !matches(a, facts)) continue;
    const first = r.body.replace(/\s+/g, ' ').trim();
    return { id: `broadcast:${r.id}`, source: 'broadcast', title: r.title, line: first.length > 90 ? `${first.slice(0, 89).trimEnd()}…` : first, href: r.link_url, actionLabel: r.link_url ? r.link_label ?? 'Open' : null };
  }
  return null;
}
