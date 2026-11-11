// lib/security/index.ts
// Small, dependency-free helpers shared by route handlers and server actions.
//
//   pgTerm(raw)          Makes free text safe to splice into a PostgREST .or()/.filter() string.
//   isUuid(v)            Strict UUID check for ids that end up inside filter strings.
//   safeEqual(a, b)      Constant-time string comparison for shared secrets.
//   limitPublic(req, …)  One-line, cross-instance rate limit for public endpoints (returns a 429 or null).
//   maskEmail(e)         "ada@example.com" -> "a***@example.com" for logs.
//   sniffFile(buf)       Detects the real file type from magic bytes (never trust the client's MIME).
//   svgIsSafe(text)      Rejects SVGs that carry script, event handlers, or external/JS URLs.
import 'server-only';
import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { getClientIp } from '@/lib/rate-limit';

/**
 * PostgREST filter strings use , ( ) : " as syntax and * % as wildcards. Anything outside letters, digits,
 * space and @ + - . _ is replaced, so user input can never add a condition or close the or(...) group.
 * (A '.' inside the value part is fine: PostgREST only splits column.operator. at the front.)
 */
export function pgTerm(raw: unknown, max = 80): string {
  return String(raw ?? '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{M}\p{N}\s@+\-._]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

/** Constant-time comparison. False when either side is missing, so an unset secret fails closed. */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Rate limit a public endpoint by client IP, shared across serverless instances (Postgres-backed,
 * falling back to in-memory). Returns a ready 429 response when over the limit, otherwise null.
 *
 *   const limited = await limitPublic(req, 'contact', 5, 600); if (limited) return limited;
 */
export async function limitPublic(req: Request, scope: string, max: number, windowSeconds: number): Promise<NextResponse | null> {
  const ip = getClientIp(req);
  // Loaded lazily so importing the pure helpers here doesn't construct the Supabase admin client.
  const { rateLimit } = await import('@/lib/auth/rate-limit-shared');
  const { allowed, retryAfter } = await rateLimit(ip, { scope: `public:${scope}`, max, windowSeconds });
  if (allowed) return null;
  return NextResponse.json(
    { error: 'Too many requests. Please wait a moment and try again.' },
    { status: 429, headers: { 'Retry-After': String(Math.max(1, retryAfter)) } },
  );
}

export { maskEmail } from '@/lib/log-safe';

export type SniffedType =
  | 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'image/svg+xml'
  | 'application/pdf'
  | 'audio/webm' | 'video/webm' | 'audio/ogg' | 'audio/mpeg' | 'audio/wav' | 'audio/mp4' | 'video/mp4' | 'video/quicktime';

/** Identifies a file from its first bytes. Returns null for anything unrecognised. */
export function sniffFile(input: ArrayBuffer | Uint8Array): SniffedType | null {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  const at = (o: number, ...bytes: number[]) => bytes.every((v, i) => b[o + i] === v);
  const ascii = (o: number, s: string) => at(o, ...[...s].map((c) => c.charCodeAt(0)));
  if (b.length < 4) return null;
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (ascii(0, 'GIF87a') || ascii(0, 'GIF89a')) return 'image/gif';
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp';
  if (ascii(0, 'RIFF') && ascii(8, 'WAVE')) return 'audio/wav';
  if (ascii(0, '%PDF-')) return 'application/pdf';
  if (at(0, 0x1a, 0x45, 0xdf, 0xa3)) return 'video/webm'; // EBML: WebM/Matroska (audio or video)
  if (ascii(0, 'OggS')) return 'audio/ogg';
  if (ascii(0, 'ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  if (ascii(4, 'ftyp')) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (brand === 'qt  ') return 'video/quicktime';
    if (brand.startsWith('M4A')) return 'audio/mp4';
    return 'video/mp4';
  }
  const head = new TextDecoder('utf-8', { fatal: false }).decode(b.subarray(0, 1024)).trimStart().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'image/svg+xml';
  return null;
}

/** Same family check, so e.g. an "audio/webm" upload sniffed as the shared WebM container still passes. */
export function sniffMatches(sniffed: SniffedType | null, declared: string): boolean {
  if (!sniffed) return false;
  const d = declared.split(';')[0].trim().toLowerCase();
  if (sniffed === d) return true;
  if (sniffed === 'video/webm' && d === 'audio/webm') return true;
  if (sniffed === 'video/mp4' && (d === 'audio/mp4' || d === 'audio/x-m4a' || d === 'audio/m4a')) return true;
  if (sniffed === 'audio/mp4' && (d === 'audio/x-m4a' || d === 'audio/m4a' || d === 'video/mp4')) return true;
  if (sniffed === 'audio/mpeg' && d === 'audio/mp3') return true;
  if (sniffed === 'audio/wav' && (d === 'audio/x-wav' || d === 'audio/wave')) return true;
  if (sniffed === 'audio/ogg' && d === 'video/ogg') return true;
  return false;
}

/**
 * SVG is XML that can run script. Rather than trying to clean it, reject anything that could be active:
 * script in any namespace (<h:script>), event handlers, javascript:/data: URLs, character entities
 * (which XML decodes before use, e.g. &#106;avascript:), animation elements that can rewrite href,
 * foreignObject/iframe/embed/object, external references, and DTDs/entities.
 */
export function svgIsSafe(text: string): boolean {
  const t = text.toLowerCase();
  return !(
    /<([a-z0-9_-]+:)?script[\s>/]/.test(t) ||
    /\son[a-z]+\s*=/.test(t) ||
    /(javascript|vbscript)\s*:/.test(t) ||
    /data\s*:\s*(text|application)\//.test(t) ||
    /&#|&[a-z][a-z0-9]*;/.test(t.replace(/&(amp|lt|gt|quot|apos);/g, '')) ||
    /<([a-z0-9_-]+:)?(animate|animatetransform|animatemotion|set|foreignobject|iframe|embed|object|use|handler|listener)[\s>/]/.test(t) ||
    /<!(doctype|entity)/.test(t) ||
    /(?:href|src)\s*=\s*["']?\s*(https?:)?\/\//.test(t)
  );
}
