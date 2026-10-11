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

// ── Community post media (photos and short videos) ──────────────────────────
// These go straight from the browser to storage through a short-lived signed upload link, so large videos never pass
// through the app server. The bucket itself enforces the allowed file types and the size limit.

export const POST_BUCKET = 'rx-posts';
export const POST_MEDIA_TYPES: Record<string, { ext: string; kind: 'image' | 'video'; maxMB: number }> = {
  'image/jpeg': { ext: 'jpg', kind: 'image', maxMB: 8 },
  'image/png': { ext: 'png', kind: 'image', maxMB: 8 },
  'image/webp': { ext: 'webp', kind: 'image', maxMB: 8 },
  'image/gif': { ext: 'gif', kind: 'image', maxMB: 8 },
  'video/mp4': { ext: 'mp4', kind: 'video', maxMB: 30 },
  'video/webm': { ext: 'webm', kind: 'video', maxMB: 30 },
  'video/quicktime': { ext: 'mov', kind: 'video', maxMB: 30 },
};
export const POST_BUCKET_LIMIT_MB = 30;

function postPrefix(): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${POST_BUCKET}/`;
}

/** Any file in the posts bucket. Used when reading, so a member who writes the row directly cannot point a post at another site. */
export function isPostBucketUrl(url: string): boolean {
  return typeof url === 'string' && url.startsWith(postPrefix()) && !url.includes('..') && url.length < 400;
}

/** A post attachment is accepted only if it sits in our bucket under the author's own folder. */
export function isOwnPostMedia(url: string, userId: string): boolean {
  return typeof url === 'string' && url.startsWith(`${postPrefix()}${userId}/`) && !url.includes('..') && url.length < 400;
}

export function postMediaKind(url: string): 'image' | 'video' {
  return /\.(mp4|webm|mov)$/i.test(url) ? 'video' : 'image';
}
