// lib/contact.ts
// The company's addresses, in one place. These are aliases of one mailbox, so mail to any of them lands in the same inbox.
//
//   hello@    company communications: marketing, offers, new features, opportunities. Also the default sender.
//   contact@  mail from outside the company, and where people reply. The public "contact us" address.
//   summit@   the Summit programme. Not created yet, so it falls back to contact@ until it exists.
//
// No server-only imports here: pages, emails and client components can all use it.

export const HELLO_EMAIL = 'hello@joinascentor.com';
export const CONTACT_EMAIL = 'contact@joinascentor.com';
export const SUMMIT_EMAIL = process.env.NEXT_PUBLIC_SUMMIT_EMAIL || CONTACT_EMAIL;

export const FROM_NAME = 'Ascentor';
export const FROM_DEFAULT = `${FROM_NAME} <${HELLO_EMAIL}>`;
