// lib/rx/safety.ts
// Lightweight checks on first messages from people outside a member's Circle. These do not block a message:
// they raise a visible warning so the recipient can decline, block or report.

const URL_RE = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|net|org|co|ng|io|app|xyz|link|me)\b\S*/i;
const PAYMENT_RE = /(₦|\bngn\b|\bnaira\b|\bpay(ment)?\b|\btransfer\b|\bsend (me )?money\b|\baccount number\b|\bguaranteed\b|\bbitcoin\b|\bcrypto\b|\bgift ?card\b|\bwestern union\b|\bone[- ]time (code|password)\b|\botp\b)/i;

export function looksLikeScam(text: string): boolean {
  return URL_RE.test(text) && PAYMENT_RE.test(text);
}

/** Collapses control characters and trims; keeps normal punctuation. */
export function cleanText(input: unknown, max = 2000): string {
  if (typeof input !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}
