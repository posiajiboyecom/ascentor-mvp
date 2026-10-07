// lib/rx/media.ts
// Chat media is stored as a bracketed token in the message body: [voice:<url>] or [img:<url>].
// Only files in our own storage bucket are ever rendered, so a typed token pointing elsewhere is shown as plain text.

export const MEDIA_BUCKET = 'rx-media';

function storagePrefix(): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${MEDIA_BUCKET}/`;
}

export type ParsedBody = { kind: 'text'; text: string } | { kind: 'voice' | 'img'; url: string };

export function parseBody(body: string): ParsedBody {
  const m = body.match(/^\[(voice|img):(https:\/\/[^\]\s]+)\]$/);
  if (m && m[2].startsWith(storagePrefix())) return { kind: m[1] as 'voice' | 'img', url: m[2] };
  return { kind: 'text', text: body };
}

export function mediaToken(kind: 'voice' | 'img', url: string): string {
  return `[${kind}:${url}]`;
}

export function isOwnMediaUrl(url: string): boolean {
  return url.startsWith(storagePrefix());
}

/** What to show in a list preview for a message body. */
export function previewOf(body: string): string {
  const p = parseBody(body);
  if (p.kind === 'voice') return 'Voice note';
  if (p.kind === 'img') return 'Photo';
  return p.kind === 'text' ? p.text : '';
}
