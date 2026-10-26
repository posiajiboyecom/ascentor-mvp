// lib/rx/video.ts
// Which kind of video is this link? Client-safe (no server imports).
// Lessons play on YouTube for now. Vimeo is typed and handled here too, so moving over later is a data change
// (paste a Vimeo link in Admin > Lesson videos), not a page change. Direct MP4/WebM files also work.

export type VideoProvider = 'youtube' | 'vimeo' | 'file';

export type VideoSource =
  | { provider: 'youtube'; id: string }
  | { provider: 'vimeo'; id: string; hash: string | null }
  | { provider: 'file'; url: string };

const YT_ID = /^[\w-]{11}$/;
const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be', 'www.youtu.be']);

/**
 * The 11-character video id from whatever an admin pastes: a watch link, youtu.be, embed, shorts, live, or the bare id.
 * Returns null for anything else (a playlist-only link, another site, a malformed id).
 */
export function parseYouTubeId(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;
  if (YT_ID.test(raw)) return raw;
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return null; }
  const host = u.hostname.toLowerCase();
  if (!YT_HOSTS.has(host)) return null;
  const parts = u.pathname.split('/').filter(Boolean);
  let id: string | null = null;
  if (host.endsWith('youtu.be')) id = parts[0] ?? null;
  else if (parts[0] === 'watch') id = u.searchParams.get('v');
  else if (['embed', 'shorts', 'live', 'v'].includes(parts[0] ?? '')) id = parts[1] ?? null;
  return id && YT_ID.test(id) ? id : null;
}

/** The one canonical form stored for a YouTube video. */
export const youtubeWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export function parseVideo(url: string | null | undefined): VideoSource | null {
  if (!url) return null;
  const yt = parseYouTubeId(url);
  if (yt) return { provider: 'youtube', id: yt };
  // vimeo.com/123456789, vimeo.com/123456789/abcdef1234 (unlisted), player.vimeo.com/video/123456789?h=abcdef1234
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d{6,})(?:\/([0-9a-f]{6,}))?/i);
  if (vm) {
    const h = vm[2] ?? url.match(/[?&]h=([0-9a-f]{6,})/i)?.[1] ?? null;
    return { provider: 'vimeo', id: vm[1], hash: h };
  }
  if (/\.(mp4|webm)(\?|$)/i.test(url)) return { provider: 'file', url };
  return null;
}

/** What an admin typed, checked: the source to preview and the exact text to store. */
export type VideoInputResult = { ok: true; source: VideoSource; stored: string } | { ok: false; error: string };

export function parseVideoInput(input: string | null | undefined): VideoInputResult {
  const raw = (input ?? '').trim();
  if (!raw) return { ok: false, error: 'Paste a YouTube link.' };
  const src = parseVideo(raw);
  if (!src) return { ok: false, error: 'That is not a YouTube link we can read. Use a watch, youtu.be, embed or shorts link, or the 11-character video id.' };
  if (src.provider === 'youtube') return { ok: true, source: src, stored: youtubeWatchUrl(src.id) };
  if (src.provider === 'vimeo') return { ok: true, source: src, stored: `https://vimeo.com/${src.id}${src.hash ? `/${src.hash}` : ''}` };
  return { ok: true, source: src, stored: src.url };
}

export function embedSrc(v: Exclude<VideoSource, { provider: 'file' }>, startSec: number, origin: string): string {
  const t = Math.max(0, Math.floor(startSec));
  if (v.provider === 'youtube') {
    const o = origin ? `&origin=${encodeURIComponent(origin)}` : '';
    return `https://www.youtube-nocookie.com/embed/${v.id}?enablejsapi=1&rel=0&modestbranding=1&playsinline=1&start=${t}${o}`;
  }
  const h = v.hash ? `&h=${v.hash}` : '';
  return `https://player.vimeo.com/video/${v.id}?dnt=1&title=0&byline=0&portrait=0&playsinline=1${h}${t > 0 ? `#t=${t}s` : ''}`;
}
