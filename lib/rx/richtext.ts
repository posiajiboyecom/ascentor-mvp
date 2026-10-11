// lib/rx/richtext.ts
// Community posts are written in a rich-text editor. The server never trusts the editor's HTML: it is cleaned here with a
// small allow-list before it is stored, and only the cleaned version is ever rendered. A plain-text copy is kept for
// search, safety checks and notification previews.

import sanitizeHtml from 'sanitize-html';

export const POST_MAX_TEXT = 5000;
export const POST_MAX_HTML = 20000;

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'em', 'u', 's', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a'],
  allowedAttributes: { a: ['href', 'rel', 'target'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    // Every link opens in a new tab and carries no referrer or opener.
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow ugc', target: '_blank' }),
  },
};

/** Cleans editor HTML to the allow-list. Returns an empty string for anything with no readable text. */
export function cleanHtml(input: unknown): string {
  if (typeof input !== 'string') return '';
  const html = sanitizeHtml(input.slice(0, POST_MAX_HTML * 2), OPTIONS).trim();
  return html.length > POST_MAX_HTML ? '' : html;
}

/** Readable text of cleaned HTML: block ends become line breaks, entities are decoded. */
export function htmlToText(html: string): string {
  const withBreaks = html.replace(/<\/(p|h2|h3|li|blockquote)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n');
  const stripped = sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} });
  return stripped
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Cleans a post body and returns both versions, or an error message when the post is empty or too long. */
export function preparePostBody(rawHtml: unknown, rawText?: unknown): { ok: true; html: string; text: string } | { ok: false; error: string } {
  const html = cleanHtml(rawHtml);
  let text = html ? htmlToText(html) : '';
  if (!text && typeof rawText === 'string') text = rawText.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (!text) return { ok: false, error: 'Write something first.' };
  if (text.length > POST_MAX_TEXT) return { ok: false, error: `That post is too long. Keep it under ${POST_MAX_TEXT.toLocaleString('en')} characters.` };
  const safeHtml = html || `<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`;
  return { ok: true, html: safeHtml, text };
}

/** First characters of a post for notification previews and list rows. */
export function excerpt(text: string, max = 90): string {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max - 1).trimEnd()}…` : one;
}
