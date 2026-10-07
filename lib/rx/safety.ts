// lib/rx/safety.ts
// Checks on messages. They never read like an accusation: a flagged message gets a plain warning for the reader and
// goes to the moderation queue. In a first message from a new account, links and phone numbers are held back entirely.

const URL_RE = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|net|org|co|ng|io|app|xyz|link|me|info|biz|top|site|online)\b\S*/i;
const PHONE_RE = /(\+?234[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{4})|(\b0[789][01]\d[\s-]?\d{3}[\s-]?\d{4}\b)|(\+\d{1,3}[\s-]?\d{6,12})/;
const HANDOFF_RE = /\b(whats\s?app|telegram|t\.me\/|wa\.me\/|signal app|text me on|dm me on|add me on|call me on)\b/i;
const PAYMENT_RE = /(₦|\bngn\b|\bnaira\b|\bpay(ment)?\b|\btransfer\b|\bsend (me )?money\b|\baccount number\b|\bguaranteed\b|\bgift ?card\b|\bwestern union\b|\bone[- ]time (code|password)\b|\botp\b|\bbank details\b)/i;
const INVEST_RE = /\b(invest(ment|ing)?|returns?|profit|double your|forex|crypto|bitcoin|btc|usdt|trading signal|mining|ponzi|get rich|passive income)\b/i;
const ROMANCE_RE = /\b(my dear|my love|sweetheart|lonely|widow|widower|military|oil rig|inheritance|visa fee|customs fee)\b/i;

export interface Assessment { flagged: boolean; reasons: string[]; hasLink: boolean; hasPhone: boolean; hasHandoff: boolean }

export function assessMessage(text: string): Assessment {
  const hasLink = URL_RE.test(text);
  const hasPhone = PHONE_RE.test(text);
  const hasHandoff = HANDOFF_RE.test(text);
  const pay = PAYMENT_RE.test(text);
  const invest = INVEST_RE.test(text);
  const romance = ROMANCE_RE.test(text);
  const reasons: string[] = [];
  if ((hasLink || hasPhone || hasHandoff) && pay) reasons.push('asks for payment with a link or contact');
  if ((hasLink || hasPhone || hasHandoff) && invest) reasons.push('investment pitch with a link or contact');
  if (romance && (pay || invest || hasLink)) reasons.push('romance or advance-fee pattern');
  if (/\botp\b|one[- ]time (code|password)/i.test(text)) reasons.push('asks for a security code');
  return { flagged: reasons.length > 0, reasons, hasLink, hasPhone, hasHandoff };
}

export function looksLikeScam(text: string): boolean {
  return assessMessage(text).flagged;
}

/** True when a first message from a new account should be held: links, phone numbers and contact hand-offs. */
export function holdForNewAccount(a: Assessment): boolean {
  return a.hasLink || a.hasPhone || a.hasHandoff || a.flagged;
}

/** Collapses control characters and trims; keeps normal punctuation. */
export function cleanText(input: unknown, max = 2000): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}
