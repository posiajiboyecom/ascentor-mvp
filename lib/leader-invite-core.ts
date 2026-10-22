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
  return `${base.replace(/\/$/, '')}/leader-invite/${token}`;
}

/**
 * The Leader plan rule. A member may choose it if an admin marked them Leader (or they accepted an invite, which sets
 * the same flag), onboarding placed them at the Leading stage, or they already hold the plan.
 */
export function leaderEligible(i: { isMarkedLeader?: boolean | null; stage?: string | null; plan?: string | null }): boolean {
  return !!i.isMarkedLeader || i.stage === 'Leading' || ['leader', 'climber'].includes(i.plan ?? '');
}

export function inviteEmailContent(o: { inviterName: string; link: string; expires: Date; recipientName?: string | null; price: string }) {
  const when = o.expires.toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'long', year: 'numeric' });
  const hello = o.recipientName?.trim() ? `Hello ${o.recipientName.trim().split(/\s+/)[0]},` : 'Hello,';
  const body = `${o.inviterName} from the Ascentor team has invited you to be a Leader. A Leader hosts a Circle: a small group that meets every week for 90 days and helps each member keep their promises. The Leader plan is ${o.price} a month. The link below is personal to you and works once, until ${when}.`;
  const text = `${hello}\n\n${body}\n\nAccept your invite: ${o.link}\n\nIf you were not expecting this, you can ignore this email.`;
  return { subject: 'You are invited to lead with Ascentor', hello, body, text, when };
}
