// lib/contact.ts
// Every address the app sends from, sends to or shows, in one place.
//
// The one real mailbox is a.samuel@joinascentor.com: it is the SMTP login, so it is the only address the mail server lets us send
// as. contact@ and hello@ are aliases on Hostinger. An alias that is missing or broken makes the server answer
// "550 5.1.1 User doesn't exist", so NOTHING here defaults to an alias. Once an alias is proven to work, point an env value at it
// (docs/mail-addresses.md). To send "as" an alias use Reply-To, never From.
//
//   MAIL_FROM            Ascentor <address>   the From line of every mail (EMAIL_FROM is still read, for older setups)
//   MAIL_REPLY_TO        where replies go
//   ADMIN_NOTIFY_EMAIL   where the team's alerts go (new sign-ups, contact form, Summit registrations, payments)
//   SUPPORT_EMAIL        the address shown to visitors. Set NEXT_PUBLIC_SUPPORT_EMAIL to the same value so pages and the
//                        browser agree.
//
// No server-only imports here: pages, emails and client components can all use it.

/** The real mailbox. The default for everything below. */
export const MAILBOX_EMAIL = 'a.samuel@joinascentor.com';

/** The address shown to visitors on pages, footer, mailto links and structured data. */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || process.env.SUPPORT_EMAIL || MAILBOX_EMAIL;

export const FROM_NAME = 'Ascentor';
export const FROM_DEFAULT = process.env.MAIL_FROM || process.env.EMAIL_FROM || `${FROM_NAME} <${MAILBOX_EMAIL}>`;
export const REPLY_TO = process.env.MAIL_REPLY_TO || MAILBOX_EMAIL;

/**
 * Marketing, promotions, billing alerts, and general outreach. Greg is the face of Ascentor's mass communications.
 * MARKETING_MAIL_FROM may be a bare address or "Name <address>"; the default is greg@joinascentor.com.
 */
export const MARKETING_SENDER_NAME = 'Greg from Ascentor';
const marketingFromRaw = (process.env.MARKETING_MAIL_FROM || '').trim() || 'greg@joinascentor.com';
export const MARKETING_FROM = marketingFromRaw.includes('<') ? marketingFromRaw : `${MARKETING_SENDER_NAME} <${marketingFromRaw}>`;

/**
 * Personal, high-touch emails from Posi Ajiboye (a.samuel@joinascentor.com). Used for direct outreach to speakers,
 * partners, and VIP contacts. NEVER use religious language (e.g. "alhamdulillah", "inshallah") in emails from this sender.
 * PERSONAL_MAIL_FROM defaults to the real mailbox address.
 */
export const PERSONAL_SENDER_NAME = 'Posi Ajiboye';
const personalFromRaw = (process.env.PERSONAL_MAIL_FROM || '').trim() || MAILBOX_EMAIL;
export const PERSONAL_FROM = personalFromRaw.includes('<') ? personalFromRaw : `${PERSONAL_SENDER_NAME} <${personalFromRaw}>`;

/**
 * Every email to a Summit registrant (confirmation, ticket, resend, reminders, event-day, receipts) is sent from here.
 * SUMMIT_MAIL_FROM may be a bare address or "Name <address>"; the default is summit@joinascentor.com. The domain must stay
 * joinascentor.com so SPF, DKIM and DMARC line up. Team alerts and everything that is not for a registrant stay on MAIL_FROM.
 */
export const SUMMIT_SENDER_NAME = 'The Elevation Summit';
const summitFromRaw = (process.env.SUMMIT_MAIL_FROM || '').trim() || 'summit@joinascentor.com';
export const SUMMIT_FROM = summitFromRaw.includes('<') ? summitFromRaw : `${SUMMIT_SENDER_NAME} <${summitFromRaw}>`;
/** The bare address inside SUMMIT_FROM. Replies go here, including when the mail was sent through the fallback sender. */
export const SUMMIT_REPLY_TO = (SUMMIT_FROM.match(/<([^>]+)>/)?.[1] ?? summitFromRaw).trim();

/** Summit mail replies go here. */
export const SUMMIT_EMAIL = process.env.NEXT_PUBLIC_SUMMIT_EMAIL || REPLY_TO;

/** Where team alerts go. `legacy` are the older per-feature env values, used only when ADMIN_NOTIFY_EMAIL is not set. */
export function adminNotifyEmail(...legacy: (string | undefined)[]): string {
  return (process.env.ADMIN_NOTIFY_EMAIL || legacy.find((v) => v && v.trim()) || MAILBOX_EMAIL).trim();
}

/** A From line with a different display name but the same address as MAIL_FROM: "Ascentor Partners <address>". */
export function fromAs(name: string): string {
  const m = FROM_DEFAULT.match(/<([^>]+)>/);
  const address = (m ? m[1] : FROM_DEFAULT).trim();
  return `${name.replace(/[<>"\r\n]/g, '').trim() || FROM_NAME} <${address}>`;
}

/**
 * Aliases the app must not send TO until they are proven to work. Mail addressed to one is redirected to the team inbox instead.
 * Set MAIL_ALLOW_ALIASES=true once contact@ has been tested from outside (docs/mail-addresses.md).
 */
export const UNPROVEN_ALIASES = ['contact@joinascentor.com'];
