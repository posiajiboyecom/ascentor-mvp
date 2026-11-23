// lib/mentor-invite-core.ts
// Pure helpers for mentor invites: no database, no env, safe to unit test. Tokens and statuses work exactly like
// Leader invites (lib/leader-invite-core.ts); only the link, the lifetime and the wording differ.
export {
  newInviteToken, hashInviteToken, looksLikeInviteToken, normEmail, emailsMatch, effectiveStatus, canResend, canRevoke,
  type InviteStatus,
} from '@/lib/leader-invite-core';

export const MENTOR_INVITE_TTL_DAYS = 7;

export function mentorInviteExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + MENTOR_INVITE_TTL_DAYS * 864e5);
}

export function mentorInviteLink(token: string, base = 'https://joinascentor.com'): string {
  return `${base.replace(/\/$/, '')}/mentor/join/${token}`;
}

/** Comma- or line-separated input to a short, clean list (expertise, languages). */
export function splitList(s: string | null | undefined, max = 8, each = 40): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of String(s ?? '').split(/[,\n]/)) {
    const v = raw.replace(/\s+/g, ' ').trim().slice(0, each);
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

export function mentorInviteEmailContent(o: { inviterName: string; link: string; expires: Date; recipientName?: string | null }) {
  const when = o.expires.toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'long', year: 'numeric' });
  const hello = o.recipientName?.trim() ? `Hello ${o.recipientName.trim().split(/\s+/)[0]},` : 'Hello,';
  const body = `${o.inviterName} has invited you to be a founding mentor on Ascentor. You would mentor a small Circle on a 20-minute call every two weeks, about 40 minutes a month, with the Circle's questions sent to you 48 hours before each call. Joining takes about two minutes: open your personal link, set a password and tell members what you can help with. The link works once, until ${when}.`;
  const text = `${hello}\n\n${body}\n\nJoin as a mentor: ${o.link}\n\nIf you were not expecting this, you can ignore this email.`;
  return { subject: 'Your invitation to mentor on Ascentor', hello, body, text, when };
}
