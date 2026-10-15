import 'server-only';
// lib/rx/notifications.ts
// One call for every Circle and Community event: rxNotify(userIds, notice).
//
//  - In-app: a row in `notifications`, which the bell in the header reads live.
//  - Push: sent when the member has installed the app and allowed it.
//  - Email: only for the kinds that email, only if the member's switches allow it, never for demo members, and limited so
//    nobody gets a flood (a gap after the last email about the same thing, and a daily cap).
//  - Repeats fold in: ten reactions on one post become one row that updates, not ten.
//
// It never throws. A failed notification must never fail the action that caused it.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendPushToUser } from '@/lib/push';
import { sendEmail } from '@/lib/nodemailer';
import { brandedEmailLayout, esc, p, goldButton } from '@/lib/emailTemplate';
import { decide, emailAllowed, KINDS, type NotifKind, type Prefs } from './notify-rules';

export type { NotifKind } from './notify-rules';

export interface RxNotice {
  kind: NotifKind;
  title: string;
  body: string;
  /** Path inside the app, for example /circle?c=123. */
  url: string;
  /** The person who caused it. They are never notified about their own action. */
  actorId?: string | null;
  /** The post, Circle or session this is about. Used to fold repeats together and to space out emails. */
  entityId?: string | null;
  /** Optional short lines, shown as a list in the email (the weekly summary uses it). */
  lines?: string[];
}

const SITE = 'https://joinascentor.com';
const DAY = 24 * 3600000;

/** The one email layout for notices: a heading, a short message, optional bullet lines and one button. */
export function buildNoticeEmail(o: { eyebrow: string; title: string; body: string; url: string; label?: string; lines?: string[]; recipient: string }): string {
  const href = /^https?:\/\//i.test(o.url) ? o.url : `${SITE}${o.url.startsWith('/') ? '' : '/'}${o.url}`;
  return brandedEmailLayout({
    preheader: o.body,
    eyebrow: o.eyebrow,
    heading: o.title,
    recipient: o.recipient,
    content:
      p(esc(o.body).replace(/\n/g, '<br>')) +
      (o.lines?.length ? `<ul style="margin:0 0 16px;padding-left:20px;">${o.lines.map((l) => `<li style="margin:0 0 8px;">${esc(l)}</li>`).join('')}</ul>` : '') +
      goldButton(o.label ?? 'Open in Ascentor', href) +
      p(`<span style="color:#9CA3AF;font-size:13px;">You can turn these emails off any time in <a href="${SITE}/settings" style="color:#C8A96E;text-decoration:none;">Settings</a>.</span>`),
  });
}

function emailHtml(n: RxNotice, to: string): string {
  return buildNoticeEmail({
    eyebrow: n.kind === 'weekly_digest' ? 'Your week' : KINDS[n.kind].legacyType === 'community' ? 'Community' : 'Your Circle',
    title: n.title, body: n.body, url: n.url, lines: n.lines, recipient: to,
  });
}

async function deliver(userId: string, n: RxNotice, prefs: Prefs): Promise<void> {
  const spec = KINDS[n.kind];
  const d = decide(n.kind, prefs);
  if (!d.inApp) return;

  // Fold repeats (reactions, comments, new members) into the unread row that is already there.
  if (spec.coalesce && n.entityId) {
    const since = new Date(Date.now() - DAY).toISOString();
    const { data: existing } = await supabaseAdmin.from('notifications').select('id').eq('user_id', userId).eq('kind', n.kind).eq('entity_id', n.entityId).eq('read', false).gte('created_at', since).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (existing) {
      await supabaseAdmin.from('notifications').update({ title: n.title, message: n.body, link: n.url, created_at: new Date().toISOString() }).eq('id', existing.id as string);
      return;
    }
  }

  const { data: row, error } = await supabaseAdmin.from('notifications').insert({
    user_id: userId, type: spec.legacyType, kind: n.kind, title: n.title, message: n.body, link: n.url,
    actor_id: n.actorId ?? null, entity_id: n.entityId ?? null,
  }).select('id').single();
  if (error || !row) { console.error('[rxNotify] insert failed', error?.message); return; }

  try { await sendPushToUser(supabaseAdmin, userId, { title: n.title, body: n.body, url: n.url, tag: `${n.kind}-${n.entityId ?? ''}` }); } catch { /* push is best effort */ }

  if (!d.email) return;
  try {
    const since = new Date(Date.now() - DAY).toISOString();
    const [{ count }, { data: same }] = await Promise.all([
      supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('emailed_at', since),
      n.entityId
        ? supabaseAdmin.from('notifications').select('emailed_at').eq('user_id', userId).eq('kind', n.kind).eq('entity_id', n.entityId).not('emailed_at', 'is', null).order('emailed_at', { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const last = (same as { emailed_at: string } | null)?.emailed_at;
    const minutes = last ? (Date.now() - new Date(last).getTime()) / 60000 : null;
    if (!emailAllowed({ sentLast24h: count ?? 0, minutesSinceSameThing: minutes })) return;
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
    const to = u?.user?.email;
    if (!to) return;
    await sendEmail({ to, subject: n.title, html: emailHtml(n, to) });
    await supabaseAdmin.from('notifications').update({ emailed_at: new Date().toISOString() }).eq('id', row.id as string);
  } catch (e) { console.error('[rxNotify] email failed', e instanceof Error ? e.message : e); }
}

export async function rxNotify(to: string | string[], n: RxNotice): Promise<void> {
  try {
    const ids = [...new Set(Array.isArray(to) ? to : [to])].filter((id) => id && id !== n.actorId);
    if (!ids.length) return;
    const { data: profiles } = await supabaseAdmin.from('member_profile').select('user_id, notif, is_demo').in('user_id', ids);
    const by = new Map(((profiles ?? []) as { user_id: string; notif: Record<string, boolean> | null; is_demo: boolean }[]).map((r) => [r.user_id, r]));
    await Promise.allSettled(ids.filter((id) => !by.get(id)?.is_demo).map((id) => deliver(id, n, by.get(id)?.notif ?? null)));
  } catch (e) { console.error('[rxNotify] failed', e instanceof Error ? e.message : e); }
}

/** Everyone sitting in a Circle (members and facilitator), for Circle-wide notices. */
export async function circleAudience(circleId: string, opts: { except?: string; membersOnly?: boolean } = {}): Promise<string[]> {
  let q = supabaseAdmin.from('circle_seats').select('user_id').eq('circle_id', circleId);
  if (opts.membersOnly) q = q.eq('role', 'member');
  const { data } = await q;
  return ((data ?? []) as { user_id: string }[]).map((s) => s.user_id).filter((id) => id !== opts.except);
}
