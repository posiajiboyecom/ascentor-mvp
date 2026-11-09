// lib/rx/video.ts
// Which kind of video is this link? Client-safe (no server imports).
// Vimeo is preferred for lessons (no YouTube branding or suggested videos); YouTube and direct MP4/WebM files still work.

export type VideoSource =
  | { provider: 'youtube'; id: string }
  | { provider: 'vimeo'; id: string; hash: string | null }
  | { provider: 'file'; url: string };

export function parseVideo(url: string | null | undefined): VideoSource | null {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  if (yt) return { provider: 'youtube', id: yt[1] };
  // vimeo.com/123456789, vimeo.com/123456789/abcdef1234 (unlisted), player.vimeo.com/video/123456789?h=abcdef1234
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d{6,})(?:\/([0-9a-f]{6,}))?/i);
  if (vm) {
    const h = vm[2] ?? url.match(/[?&]h=([0-9a-f]{6,})/i)?.[1] ?? null;
    return { provider: 'vimeo', id: vm[1], hash: h };
  }
  if (/\.(mp4|webm)(\?|$)/i.test(url)) return { provider: 'file', url };
  return null;
}

export function embedSrc(v: Exclude<VideoSource, { provider: 'file' }>, startSec: number, origin: string): string {
  const t = Math.max(0, Math.floor(startSec));
  if (v.provider === 'youtube') {
    return `https://www.youtube-nocookie.com/embed/${v.id}?enablejsapi=1&rel=0&modestbranding=1&playsinline=1&controls=0&start=${t}&origin=${encodeURIComponent(origin)}`;
  }
  const h = v.hash ? `&h=${v.hash}` : '';
  return `https://player.vimeo.com/video/${v.id}?dnt=1&title=0&byline=0&portrait=0&playsinline=1${h}${t > 0 ? `#t=${t}s` : ''}`;
}
