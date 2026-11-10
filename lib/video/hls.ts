// lib/video/hls.ts
// Pure helpers for the HLS transcode job (no I/O), kept separate so the
// ffmpeg arguments can be exercised locally against a real file.

import path from 'node:path';

export interface Rendition {
  name: string;
  height: number;
  videoKbps: number;
  audioKbps: number;
}

export const RENDITIONS: Rendition[] = [
  { name: '360p', height: 360, videoKbps: 800, audioKbps: 96 },
  { name: '540p', height: 540, videoKbps: 1600, audioKbps: 128 },
  { name: '720p', height: 720, videoKbps: 2800, audioKbps: 128 },
];

export const SEGMENT_SECONDS = 6;

/** Renditions at or below the source height (never upscale). */
export function pickRenditions(sourceHeight: number): Rendition[] {
  const picked = RENDITIONS.filter((r) => r.height <= sourceHeight);
  if (picked.length > 0) return picked;
  // Source smaller than 360p: single rendition at native (even) height.
  return [{ ...RENDITIONS[0], name: 'source', height: sourceHeight - (sourceHeight % 2) }];
}

/** One ffmpeg pass producing every rendition plus master.m3u8. */
export function buildHlsArgs(src: string, hlsDir: string, renditions: Rendition[], hasAudio: boolean): string[] {
  const split = renditions.map((_, i) => `[v${i}]`).join('');
  const scales = renditions.map((r, i) => `[v${i}]scale=-2:${r.height}:flags=lanczos[v${i}out]`).join(';');
  const args: string[] = ['-y', '-i', src, '-filter_complex', `[0:v]split=${renditions.length}${split};${scales}`];

  renditions.forEach((r, i) => {
    args.push(
      '-map', `[v${i}out]`,
      `-c:v:${i}`, 'libx264', `-b:v:${i}`, `${r.videoKbps}k`,
      `-maxrate:v:${i}`, `${Math.round(r.videoKbps * 1.07)}k`,
      `-bufsize:v:${i}`, `${r.videoKbps * 2}k`,
    );
    if (hasAudio) args.push('-map', 'a:0', `-c:a:${i}`, 'aac', `-b:a:${i}`, `${r.audioKbps}k`);
  });

  args.push(
    '-ac', '2',
    '-preset', 'veryfast', '-profile:v', 'main', '-pix_fmt', 'yuv420p',
    // Keyframe at every segment boundary so renditions switch cleanly
    '-sc_threshold', '0',
    '-force_key_frames', `expr:gte(t,n_forced*${SEGMENT_SECONDS})`,
    '-f', 'hls',
    '-hls_time', String(SEGMENT_SECONDS),
    '-hls_playlist_type', 'vod',
    '-hls_flags', 'independent_segments',
    '-hls_segment_filename', path.join(hlsDir, '%v', 'seg_%03d.ts'),
    '-master_pl_name', 'master.m3u8',
    '-var_stream_map', renditions
      .map((r, i) => (hasAudio ? `v:${i},a:${i},name:${r.name}` : `v:${i},name:${r.name}`))
      .join(' '),
    path.join(hlsDir, '%v', 'index.m3u8'),
  );
  return args;
}
