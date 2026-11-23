// lib/mentor-invites.ts
// Server-only. Mentor invites: an admin creates a personal link for one named person; opening it lets them join
// straight as a mentor. No member sign-up, onboarding, plan, trial or Circle placement. Create, resend, revoke and
// list mirror Leader invites (lib/leader-invites.ts). Only a SHA-256 hash of each token is stored.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/nodemailer';
import { brandedEmailLayout, esc, p, goldButton } from '@/lib/emailTemplate';
import { findAccountByEmail } from '@/lib/auth/account-lookup';
import {
  effectiveStatus, emailsMatch, hashInviteToken, looksLikeInviteToken, mentorInviteEmailContent, mentorInviteExpiry,
  mentorInviteLink, newInviteToken, normEmail, type InviteStatus,
} from '@/lib/mentor-invite-core';

const SITE = (process.env.NEXT_PUBLIC_URL || 'https://joinascentor.com').replace(/\/$/, '');
export const MENTOR_SETUP_MESSAGE = 'Mentor links are not set up yet. The database table mentor_invites has not been created.';

export interface MentorInviteRow {
  id: string; email: string; name: string | null; status: InviteStatus; invitedBy: string; createdAt: string;
  expiresAt: string; usedBy: string | null; usedAt: string | null; sendCount: number;
}

const missingTable = (e: { message?: string; code?: string } | null | undefined) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || (/mentor_invites/.test(e.message ?? '') && /does not exist|schema cache/i.test(e.message ?? '')));

async function sendInviteEmail(o: { to: string; name: string | null; inviterName: string; token: string; expires: Date }): Promise<boolean> {
  try {
    const link = mentorInviteLink(o.token, SITE);
    const c = mentorInviteEmailContent({ inviterName: o.inviterName, link, expires: o.expires, recipientName: o.name });
    const html = brandedEmailLayout({
      preheader: 'Your personal link to join Ascentor as a mentor',
      eyebrow: 'Mentor invitation',
      heading: c.subject,
      recipient: o.to,
      content: p(esc(c.hello)) + p(esc(c.body)) + goldButton('Join as a mentor', link) +
        p(`<span style="color:#9CA3AF;font-size:13px;">If you were not expecting this, you can ignore this email.</span>`),
    });
    await sendEmail({ to: o.to, subject: c.subject, html, text: c.text, required: true });
    return true;
  } catch (e) {
    console.error('[mentor-invite] email failed', e instanceof Error ? e.message : e);
    return false;
  }
}

export interface MentorIssueResult { ok: boolean; error?: string; link?: string; emailed?: boolean; message?: string; name?: string | null }

function summarise(link: string, emailed: boolean, name: string | null): MentorIssueResult {
  return {
    ok: true, link, emailed, name,
    message: emailed
      ? 'Link created and emailed to them. Copy it below if you also want to send it on WhatsApp.'
      : 'Link created, but the email could not be sent. Copy the link below and send it yourself.',
  };
}

export async function createMentorInvite(by: { userId: string; name: string }, nameIn: string, emailIn: string): Promise<MentorIssueResult> {
  const email = normEmail(emailIn);
  const name = String(nameIn ?? '').replace(/\s+/g, ' ').trim().slice(0, 120) || null;
  if (!name) return { ok: false, error: 'Enter the mentor’s name.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Enter a valid email address.' };

  // Already a mentor? Say so instead of making a link they cannot use.
  const { data: prof } = await supabaseAdmin.from('profiles').select('id').eq('email', email).maybeSingle();
  if (prof) {
    const { data: hm } = await supabaseAdmin.from('human_mentors').select('id, active').eq('user_id', prof.id as string).maybeSingle();
    if (hm?.active) return { ok: false, error: 'This person is already an active mentor.' };
  }

  const token = newInviteToken();
  const expires = mentorInviteExpiry();
  const { error } = await supabaseAdmin.from('mentor_invites').insert({
    email, name, token_hash: hashInviteToken(token), status: 'sent', created_by: by.userId,
    expires_at: expires.toISOString(), last_sent_at: new Date().toISOString(), send_count: 1,
  });
  if (error) return { ok: false, error: missingTable(error) ? MENTOR_SETUP_MESSAGE : 'We could not create that link. Please try again.' };
  const emailed = await sendInviteEmail({ to: email, name, inviterName: by.name, token, expires });
  return summarise(mentorInviteLink(token, SITE), emailed, name);
}

/** New token, new expiry; the old link stops working. Only for sent or expired invites. */
export async function resendMentorInvite(by: { userId: string; name: string }, id: string): Promise<MentorIssueResult> {
  const { data: inv, error: e0 } = await supabaseAdmin.from('mentor_invites').select('id, email, name, status, expires_at, send_count').eq('id', id).maybeSingle();
  if (e0) return { ok: false, error: missingTable(e0) ? MENTOR_SETUP_MESSAGE : 'We could not load that link.' };
  if (!inv) return { ok: false, error: 'We could not find that link.' };
  const st = effectiveStatus(inv.status as string, inv.expires_at as string);
  if (st !== 'sent' && st !== 'expired') return { ok: false, error: `A ${st} link cannot be renewed. Create a new one instead.` };
  const token = newInviteToken();
  const expires = mentorInviteExpiry();
  const { data: upd, error } = await supabaseAdmin.from('mentor_invites').update({
    token_hash: hashInviteToken(token), status: 'sent', expires_at: expires.toISOString(),
    last_sent_at: new Date().toISOString(), send_count: ((inv.send_count as number | null) ?? 0) + 1,
  }).eq('id', id).in('status', ['sent', 'expired']).select('id');
  if (error || !upd?.length) return { ok: false, error: 'We could not renew that link. Please try again.' };
  const name = inv.name as string | null;
  const emailed = await sendInviteEmail({ to: inv.email as string, name, inviterName: by.name, token, expires });
  return summarise(mentorInviteLink(token, SITE), emailed, name);
}

export async function revokeMentorInvite(id: string): Promise<{ ok: boolean; error?: string; email?: string }> {
  const { data, error } = await supabaseAdmin.from('mentor_invites').update({ status: 'revoked' }).eq('id', id).eq('status', 'sent').gt('expires_at', new Date().toISOString()).select('email');
  if (error) return { ok: false, error: missingTable(error) ? MENTOR_SETUP_MESSAGE : 'We could not cancel that link.' };
  if (!data?.length) return { ok: false, error: 'Only a link that is still waiting can be cancelled.' };
  return { ok: true, email: data[0].email as string };
}

export async function listMentorInvites(): Promise<{ rows: MentorInviteRow[]; setup: boolean }> {
  await supabaseAdmin.from('mentor_invites').update({ status: 'expired' }).eq('status', 'sent').lt('expires_at', new Date().toISOString());
  const { data, error } = await supabaseAdmin.from('mentor_invites')
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

export interface MentorInviteView { email: string; name: string | null; status: InviteStatus; inviterName: string; expiresAt: string; usedBy: string | null; hasAccount: boolean }

export async function getMentorInviteByToken(token: string): Promise<{ invite: MentorInviteView | null; setup: boolean }> {
  if (!looksLikeInviteToken(token)) return { invite: null, setup: false };
  const { data, error } = await supabaseAdmin.from('mentor_invites').select('email, name, status, expires_at, created_by, used_by').eq('token_hash', hashInviteToken(token)).maybeSingle();
  if (error) return { invite: null, setup: missingTable(error) };
  if (!data) return { invite: null, setup: false };
  let inviterName = 'The Ascentor team';
  if (data.created_by) {
    const { data: a } = await supabaseAdmin.from('profiles').select('full_name').eq('id', data.created_by as string).maybeSingle();
    if ((a?.full_name as string | null)?.trim()) inviterName = `${(a!.full_name as string).trim()} from Ascentor`;
  }
  const account = await findAccountByEmail(data.email as string);
  return {
    invite: {
      email: data.email as string, name: data.name as string | null, status: effectiveStatus(data.status as string, data.expires_at as string),
      inviterName, expiresAt: data.expires_at as string, usedBy: (data.used_by as string | null) ?? null, hasAccount: !!account?.emailConfirmed,
    },
    setup: false,
  };
}

export interface MentorProfileInput { fullName: string; headline: string; expertise: string[]; langs: string[]; bio: string }

/** Creates or re-activates the mentor row and skips member onboarding for this account. */
async function makeMentor(userId: string, i: MentorProfileInput): Promise<boolean> {
  const { data: prof } = await supabaseAdmin.from('profiles').select('avatar_url').eq('id', userId).maybeSingle();
  const row = {
    name: i.fullName, headline: i.headline || null, bio: i.bio || null, tags: i.expertise,
    langs: i.langs.length ? i.langs : ['English'], accepting: true, active: true,
  };
  const { data: existing } = await supabaseAdmin.from('human_mentors').select('id').eq('user_id', userId).maybeSingle();
  const { error } = existing
    ? await supabaseAdmin.from('human_mentors').update(row).eq('id', existing.id as string)
    : await supabaseAdmin.from('human_mentors').insert({ ...row, user_id: userId, avatar_url: (prof?.avatar_url as string | null) ?? null, formats: ['Video'], capacity: 2 });
  if (error) { console.error('[mentor-invite] mentor row failed', error.message); return false; }
  // Mentors are not members: never send them through member onboarding.
  await supabaseAdmin.from('profiles').update({ full_name: i.fullName, onboarding_completed: true }).eq('id', userId);
  try {
    await supabaseAdmin.from('notifications').insert({
      user_id: userId, type: 'success', title: 'Welcome, you are an Ascentor mentor',
      message: 'Add the times you are free so Circles can book you.', link: '/sessions/mentoring',
    });
  } catch { /* best effort */ }
  return true;
}

/** Claims a 'sent', unexpired invite for this email, once. Returns its id, or null. */
async function claim(token: string, email: string): Promise<string | null> {
  const now = new Date().toISOString();
  const { data } = await supabaseAdmin.from('mentor_invites')
    .update({ status: 'used', used_at: now })
    .eq('token_hash', hashInviteToken(token)).eq('status', 'sent').gt('expires_at', now).ilike('email', normEmail(email)).select('id');
  return (data?.[0]?.id as string | undefined) ?? null;
}

async function unclaim(id: string): Promise<void> {
  await supabaseAdmin.from('mentor_invites').update({ status: 'sent', used_at: null, used_by: null }).eq('id', id);
}

export type JoinResult =
  | { ok: true; email: string }
  | { ok: false; reason: 'invalid' | 'unavailable' | 'exists' | 'mismatch' | 'error' };

/** New person: creates their account (already confirmed: an admin invited this address) and makes them a mentor. */
export async function joinAsNewMentor(token: string, password: string, i: MentorProfileInput): Promise<JoinResult> {
  if (!looksLikeInviteToken(token)) return { ok: false, reason: 'invalid' };
  const { data: inv } = await supabaseAdmin.from('mentor_invites').select('email').eq('token_hash', hashInviteToken(token)).maybeSingle();
  if (!inv) return { ok: false, reason: 'invalid' };
  const email = normEmail(inv.email as string);

  const account = await findAccountByEmail(email);
  if (account?.emailConfirmed) return { ok: false, reason: 'exists' };

  const id = await claim(token, email);
  if (!id) return { ok: false, reason: 'unavailable' };
  try {
    let userId: string;
    if (account) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(account.id, { password, email_confirm: true, user_metadata: { full_name: i.fullName } });
      if (error) throw error;
      userId = account.id;
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: i.fullName } });
      if (error || !data.user) throw error ?? new Error('no user');
      userId = data.user.id;
    }
    await supabaseAdmin.from('mentor_invites').update({ used_by: userId }).eq('id', id);
    if (!(await makeMentor(userId, i))) throw new Error('mentor row');
    return { ok: true, email };
  } catch (e) {
    console.error('[mentor-invite] join failed', e instanceof Error ? e.message : e);
    await unclaim(id);
    return { ok: false, reason: 'error' };
  }
}

/** Someone who already has an Ascentor account with the invited email, signed in: make that account a mentor. */
export async function acceptAsExistingUser(token: string, user: { id: string; email: string | null | undefined }, i: MentorProfileInput): Promise<JoinResult> {
  if (!looksLikeInviteToken(token)) return { ok: false, reason: 'invalid' };
  const { data: inv } = await supabaseAdmin.from('mentor_invites').select('email').eq('token_hash', hashInviteToken(token)).maybeSingle();
  if (!inv) return { ok: false, reason: 'invalid' };
  if (!emailsMatch(inv.email as string, user.email)) return { ok: false, reason: 'mismatch' };
  const id = await claim(token, inv.email as string);
  if (!id) return { ok: false, reason: 'unavailable' };
  await supabaseAdmin.from('mentor_invites').update({ used_by: user.id }).eq('id', id);
  if (!(await makeMentor(user.id, i))) { await unclaim(id); return { ok: false, reason: 'error' }; }
  return { ok: true, email: normEmail(user.email) };
}
