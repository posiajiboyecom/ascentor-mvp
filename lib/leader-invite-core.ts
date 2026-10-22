// lib/leader-invite-core.ts
// Pure helpers for Leader invites and eligibility: no database, no env, safe to unit test.
import { createHash, randomBytes } from 'crypto';

export const INVITE_TTL_DAYS = 14;
export type InviteStatus = 'sent' | 'used' | 'expired' | 'revoked';

export function newInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function looksLikeInviteToken(t: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(t);
}

export function inviteExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITE_TTL_DAYS * 864e5);
}

export function normEmail(e: string | null | undefined): string {
  return String(e ?? '').trim().toLowerCase();
}

export function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normEmail(a);
  return !!x && x === normEmail(b);
}

/** The status to show: a 'sent' invite past its expiry counts as expired. */
export function effectiveStatus(status: string, expiresAt: string | Date, now: Date = new Date()): InviteStatus {
  const s = (['sent', 'used', 'expired', 'revoked'].includes(status) ? status : 'expired') as InviteStatus;
  if (s === 'sent' && new Date(expiresAt).getTime() <= now.getTime()) return 'expired';
  return s;
}

export const canResend = (s: InviteStatus) => s === 'sent' || s === 'expired';
export const canRevoke = (s: InviteStatus) => s === 'sent';

export function inviteLink(token: string, base = 'https://joinascentor.com'): string {
  return `${base.replace(/\/$/, '')}/facilitator/${token}`;
}

/**
 * Free Leader access. Leaders are never bought at checkout. A member has it if an admin marked them Leader, they accepted a
 * Leader invite (which sets leader_free and the same Leader flag), or onboarding placed them at the Leading stage.
 */
export function leaderEligible(i: { isMarkedLeader?: boolean | null; leaderFree?: boolean | null; stage?: string | null }): boolean {
  return !!i.isMarkedLeader || !!i.leaderFree || i.stage === 'Leading';
}

/** The Leader plan is never purchasable at checkout. */
export const LEADER_PURCHASABLE = false;

export function inviteEmailContent(o: { inviterName: string; link: string; expires: Date; recipientName?: string | null }) {
  const when = o.expires.toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'long', year: 'numeric' });
  const hello = o.recipientName?.trim() ? `Hello ${o.recipientName.trim().split(/\s+/)[0]},` : 'Hello,';
  const body = `${o.inviterName} from the Ascentor team has invited you to be a Leader. A Leader hosts a Circle: a small group that meets every week for 90 days and helps each member keep their promises. Leaders lead for free while they facilitate a Circle, and you do not need to enter a card. The link below is personal to you and works once, until ${when}.`;
  const text = `${hello}\n\n${body}\n\nAccept your invite: ${o.link}\n\nIf you were not expecting this, you can ignore this email.`;
  return { subject: 'You are invited to lead with Ascentor', hello, body, text, when };
}
