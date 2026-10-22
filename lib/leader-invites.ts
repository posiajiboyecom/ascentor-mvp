// lib/leader-invites.ts
// Server-only. Leader invites: create, resend, revoke, list, look up by link, accept.
// Only a SHA-256 hash of each token is stored, so a link can be shown once and never read back.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/nodemailer';
import { brandedEmailLayout, esc, p, goldButton } from '@/lib/emailTemplate';
import { getPlanPricingMap } from '@/lib/plans-config';
import { formatNaira } from '@/lib/pricing';
import {
  effectiveStatus, emailsMatch, hashInviteToken, inviteEmailContent, inviteExpiry, inviteLink, looksLikeInviteToken,
  newInviteToken, normEmail, type InviteStatus,
} from '@/lib/leader-invite-core';

const SITE = (process.env.NEXT_PUBLIC_URL || 'https://joinascentor.com').replace(/\/$/, '');
export const SETUP_MESSAGE = 'Leader invites are not set up yet. The database table leader_invites has not been created.';

export interface InviteRow {
  id: string; email: string; name: string | null; status: InviteStatus; invitedBy: string; createdAt: string;
  expiresAt: string; usedBy: string | null; usedAt: string | null; sendCount: number;
}

const missingTable = (e: { message?: string; code?: string } | null | undefined) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /leader_invites/.test(e.message ?? '') && /does not exist|schema cache/i.test(e.message ?? ''));

const leaderPrice = () => formatNaira(getPlanPricingMap().leader.monthlyPrice);

async function sendInviteEmail(o: { to: string; name: string | null; inviterName: string; token: string; expires: Date }): Promise<boolean> {
  try {
    const link = inviteLink(o.token, SITE);
    const c = inviteEmailContent({ inviterName: o.inviterName, link, expires: o.expires, recipientName: o.name, price: leaderPrice() });
    const html = brandedEmailLayout({
      preheader: 'Your personal invitation to lead a Circle',
      eyebrow: 'Leader invitation',
      heading: c.subject,
      recipient: o.to,
      content: p(esc(c.hello)) + p(esc(c.body)) + goldButton('Accept your invite', link) +
        p(`<span style="color:#9CA3AF;font-size:13px;">If you were not expecting this, you can ignore this email.</span>`),
    });
    await sendEmail({ to: o.to, subject: c.subject, html, text: c.text, required: true });
    return true;
  } catch (e) {
    console.error('[leader-invite] email failed', e instanceof Error ? e.message : e);
    return false;
  }
}

async function notifyInApp(email: string, inviterName: string, token: string): Promise<boolean> {
  try {
    const { data: prof } = await supabaseAdmin.from('profiles').select('id').ilike('email', normEmail(email)).maybeSingle();
    if (!prof) return false;
    const { error } = await supabaseAdmin.from('notifications').insert({
      user_id: prof.id, type: 'info', title: 'You are invited to lead with Ascentor',
      message: `${inviterName} invited you to be a Leader. Open your invite to accept.`, link: `/leader-invite/${token}`,
    });
    return !error;
  } catch { return false; }
}

export interface IssueResult { ok: boolean; error?: string; link?: string; emailed?: boolean; notified?: boolean; message?: string }

function summarise(link: string, emailed: boolean, notified: boolean): IssueResult {
  return {
    ok: true, link, emailed, notified,
    message: emailed
      ? `Invite sent by email${notified ? ' and in the app' : ''}. The link is shown below once.`
      : 'Invite created but the email could not be sent, share the link.',
  };
}

export async function createLeaderInvite(by: { userId: string; name: string }, nameIn: string, emailIn: string): Promise<IssueResult> {
  const email = normEmail(emailIn);
  const name = String(nameIn ?? '').trim().slice(0, 120) || null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  const token = newInviteToken();
  const expires = inviteExpiry();
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('leader_invites').insert({
    email, name, token_hash: hashInviteToken(token), status: 'sent', created_by: by.userId,
    expires_at: expires.toISOString(), last_sent_at: now, send_count: 1,
  });
  if (error) return { ok: false, error: missingTable(error) ? SETUP_MESSAGE : 'We could not create that invite. Please try again.' };
  const [emailed, notified] = await Promise.all([
    sendInviteEmail({ to: email, name, inviterName: by.name, token, expires }),
    notifyInApp(email, by.name, token),
  ]);
  return summarise(inviteLink(token, SITE), emailed, notified);
}

/** New token, new expiry; the old link stops working. Only for sent or expired invites. */
export async function resendLeaderInvite(by: { userId: string; name: string }, id: string): Promise<IssueResult> {
  const { data: inv, error: e0 } = await supabaseAdmin.from('leader_invites').select('id, email, name, status, expires_at, send_count').eq('id', id).maybeSingle();
  if (e0) return { ok: false, error: missingTable(e0) ? SETUP_MESSAGE : 'We could not load that invite.' };
  if (!inv) return { ok: false, error: 'We could not find that invite.' };
  const st = effectiveStatus(inv.status as string, inv.expires_at as string);
  if (st !== 'sent' && st !== 'expired') return { ok: false, error: `A ${st} invite cannot be resent. Create a new invite instead.` };
  const token = newInviteToken();
  const expires = inviteExpiry();
  const { data: upd, error } = await supabaseAdmin.from('leader_invites').update({
    token_hash: hashInviteToken(token), status: 'sent', expires_at: expires.toISOString(),
    last_sent_at: new Date().toISOString(), send_count: ((inv.send_count as number | null) ?? 0) + 1,
  }).eq('id', id).in('status', ['sent', 'expired']).select('id');
  if (error || !upd?.length) return { ok: false, error: 'We could not resend that invite. Please try again.' };
  const email = inv.email as string; const name = inv.name as string | null;
  const [emailed, notified] = await Promise.all([
    sendInviteEmail({ to: email, name, inviterName: by.name, token, expires }),
    notifyInApp(email, by.name, token),
  ]);
  return summarise(inviteLink(token, SITE), emailed, notified);
}

export async function revokeLeaderInvite(id: string): Promise<{ ok: boolean; error?: string; email?: string }> {
  const { data, error } = await supabaseAdmin.from('leader_invites').update({ status: 'revoked' }).eq('id', id).eq('status', 'sent').gt('expires_at', new Date().toISOString()).select('email');
  if (error) return { ok: false, error: missingTable(error) ? SETUP_MESSAGE : 'We could not revoke that invite.' };
  if (!data?.length) return { ok: false, error: 'Only an invite that is still waiting can be revoked.' };
  return { ok: true, email: data[0].email as string };
}

export async function listLeaderInvites(): Promise<{ rows: InviteRow[]; setup: boolean }> {
  // Expire stale invites lazily.
  await supabaseAdmin.from('leader_invites').update({ status: 'expired' }).eq('status', 'sent').lt('expires_at', new Date().toISOString());
  const { data, error } = await supabaseAdmin.from('leader_invites')
    .select('id, email, name, status, created_by, created_at, expires_at, used_at, used_by, send_count')
    .order('created_at', { ascending: false }).limit(200);
  if (error) return { rows: [], setup: missingTable(error) };
  const list = data ?? [];
  const ids = [...new Set(list.flatMap((r) => [r.created_by, r.used_by]).filter(Boolean) as string[])];
  const { data: profs } = ids.length ? await supabaseAdmin.from('profiles').select('id, full_name, email').in('id', ids) : { data: [] };
  const nameOf = new Map((profs ?? []).map((x) => [x.id as string, ((x.full_name as string | null)?.trim() || (x.email as string | null) || 'Unknown')]));
  return {
    setup: false,
    rows: list.map((r) => ({
      id: r.id as string, email: r.email as string, name: r.name as string | null,
      status: effectiveStatus(r.status as string, r.expires_at as string),
      invitedBy: r.created_by ? nameOf.get(r.created_by as string) ?? 'Unknown' : 'Unknown',
      createdAt: r.created_at as string, expiresAt: r.expires_at as string, usedAt: r.used_at as string | null,
      usedBy: r.used_by ? nameOf.get(r.used_by as string) ?? 'Unknown' : null, sendCount: (r.send_count as number | null) ?? 0,
    })),
  };
}

export interface InviteView { email: string; name: string | null; status: InviteStatus; inviterName: string; expiresAt: string }

export async function getInviteByToken(token: string): Promise<{ invite: InviteView | null; setup: boolean }> {
  if (!looksLikeInviteToken(token)) return { invite: null, setup: false };
  const { data, error } = await supabaseAdmin.from('leader_invites').select('email, name, status, expires_at, created_by').eq('token_hash', hashInviteToken(token)).maybeSingle();
  if (error) return { invite: null, setup: missingTable(error) };
  if (!data) return { invite: null, setup: false };
  let inviterName = 'The Ascentor team';
  if (data.created_by) {
    const { data: a } = await supabaseAdmin.from('profiles').select('full_name').eq('id', data.created_by as string).maybeSingle();
    if ((a?.full_name as string | null)?.trim()) inviterName = `${(a!.full_name as string).trim()} from the Ascentor team`;
  }
  return { invite: { email: data.email as string, name: data.name as string | null, status: effectiveStatus(data.status as string, data.expires_at as string), inviterName, expiresAt: data.expires_at as string }, setup: false };
}

export type AcceptResult = { ok: true } | { ok: false; reason: 'invalid' | 'mismatch' | 'unavailable' | 'error' };

/** Atomic: only a 'sent', unexpired invite for this email can be used, once. */
export async function acceptLeaderInvite(token: string, user: { id: string; email: string | null | undefined }): Promise<AcceptResult> {
  if (!looksLikeInviteToken(token)) return { ok: false, reason: 'invalid' };
  const hash = hashInviteToken(token);
  const { data: inv } = await supabaseAdmin.from('leader_invites').select('email').eq('token_hash', hash).maybeSingle();
  if (!inv) return { ok: false, reason: 'invalid' };
  if (!emailsMatch(inv.email as string, user.email)) return { ok: false, reason: 'mismatch' };
  const now = new Date().toISOString();
  const { data: claimed, error } = await supabaseAdmin.from('leader_invites')
    .update({ status: 'used', used_at: now, used_by: user.id })
    .eq('token_hash', hash).eq('status', 'sent').gt('expires_at', now).select('id');
  if (error) return { ok: false, reason: 'error' };
  if (!claimed?.length) return { ok: false, reason: 'unavailable' };
  // Same flag as Members > Make Leader, so every other check works unchanged.
  const { error: mErr } = await supabaseAdmin.from('member_profile').upsert({ user_id: user.id, is_facilitator: true, updated_at: now }, { onConflict: 'user_id' });
  if (mErr) {
    await supabaseAdmin.from('leader_invites').update({ status: 'sent', used_at: null, used_by: null }).eq('token_hash', hash).eq('used_by', user.id);
    return { ok: false, reason: 'error' };
  }
  try {
    await supabaseAdmin.from('notifications').insert({
      user_id: user.id, type: 'success', title: 'You are a Leader',
      message: 'Your invite is accepted. Choose the Leader plan to get started.', link: '/checkout?plan=leader',
    });
  } catch { /* best effort */ }
  return { ok: true };
}
