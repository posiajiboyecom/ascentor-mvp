// src/trigger/transcode-video.ts
// ═══════════════════════════════════════════════════════════════
// transcode-video
//
// Turns an uploaded original (MP4/MOV/WebM on R2) into adaptive HLS:
//   videos/<id>/hls/master.m3u8
//   videos/<id>/hls/{360p,540p,720p}/index.m3u8 + seg_###.ts
//   videos/<id>/thumbnail.jpg
// then marks ascentor_videos.status = 'ready' with hls_url set.
//
// Triggered by: POST /api/admin/videos/[id]/complete
// FFmpeg comes from the ffmpeg() build extension in trigger.config.ts.
// Renditions above the source height are skipped (no upscaling).
// ═══════════════════════════════════════════════════════════════

import { task, logger } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { presignGet, putObject, publicUrl, VIDEO_KEYS } from '../../lib/r2';
import { buildHlsArgs, pickRenditions } from '../../lib/video/hls';

const UPLOAD_CONCURRENCY = 8;

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => {
      err += d;
      if (err.length > 20_000) err = err.slice(-20_000);
    });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${err.slice(-2000)}`)),
    );
  });
}

async function probe(file: string) {
  const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
  const json = JSON.parse(
    await run(ffprobe, ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file]),
  );
  const video = json.streams.find((s: any) => s.codec_type === 'video');
  const hasAudio = json.streams.some((s: any) => s.codec_type === 'audio');
  if (!video) throw new Error('No video stream found in upload');

  let width = Number(video.width);
  let height = Number(video.height);
  // Phone footage often stores rotation as metadata; ffmpeg auto-rotates,
  // so swap dimensions to reflect what viewers will see.
  const rotation = Math.abs(
    Number(video.tags?.rotate ?? video.side_data_list?.find((s: any) => s.rotation !== undefined)?.rotation ?? 0),
  );
  if (rotation === 90 || rotation === 270) [width, height] = [height, width];

  return { width, height, hasAudio, duration: Number(json.format.duration) || 0 };
}

async function uploadDir(localDir: string, keyPrefix: string) {
  const files: string[] = [];
  for (const entry of await readdir(localDir, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) files.push(path.join(entry.parentPath, entry.name));
  }

  let i = 0;
  async function worker() {
    while (i < files.length) {
      const file = files[i++];
      const rel = path.relative(localDir, file).split(path.sep).join('/');
      const isPlaylist = file.endsWith('.m3u8');
      await putObject(
        `${keyPrefix}/${rel}`,
        await readFile(file),
        isPlaylist ? 'application/vnd.apple.mpegurl' : 'video/mp2t',
        // Playlists are tiny and could be regenerated; segments never change.
        isPlaylist ? 'public, max-age=300' : 'public, max-age=31536000, immutable',
      );
    }
  }
  await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker));
  return files.length;
}

export const transcodeVideo = task({
  id: 'transcode-video',
  maxDuration: 3600, // long recordings (e.g. a full summit session) need more than the 5-min default
  machine: { preset: 'medium-2x' },
  retry: { maxAttempts: 2 },
  run: async ({ videoId }: { videoId: string }) => {
    const db = supabase();
    const { data: video, error } = await db
      .from('ascentor_videos').select('id, source_key').eq('id', videoId).single();
    if (error || !video) throw new Error(`Video ${videoId} not found`);

    const work = await mkdtemp(path.join(tmpdir(), `video-${videoId}-`));
    const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';

    try {
      // 1. Download the original from R2
      const src = path.join(work, `source${path.extname(video.source_key)}`);
      const res = await fetch(await presignGet(video.source_key));
      if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`);
      await pipeline(Readable.fromWeb(res.body as any), createWriteStream(src));
      logger.info('Downloaded original', { videoId });

      // 2. Inspect it
      const meta = await probe(src);
      logger.info('Probed', meta);

      const renditions = pickRenditions(meta.height);

      // 3. One ffmpeg pass → all renditions + master playlist
      const hlsDir = path.join(work, 'hls');
      for (const r of renditions) await mkdir(path.join(hlsDir, r.name), { recursive: true });
      const args = buildHlsArgs(src, hlsDir, renditions, meta.hasAudio);

      logger.info('Transcoding', { renditions: renditions.map((r) => r.name) });
      await run(ffmpeg, args);

      // 4. Thumbnail from ~10% in (skips black intro frames)
      const thumb = path.join(work, 'thumbnail.jpg');
      const at = Math.max(1, Math.min(meta.duration * 0.1, 30));
      await run(ffmpeg, ['-y', '-ss', at.toFixed(2), '-i', src, '-frames:v', '1', '-vf', 'scale=1280:-2', '-q:v', '3', thumb]);

      // 5. Upload everything to R2
      const count = await uploadDir(hlsDir, VIDEO_KEYS.hlsDir(videoId));
      await putObject(VIDEO_KEYS.thumbnail(videoId), await readFile(thumb), 'image/jpeg');
      logger.info('Uploaded HLS', { files: count });

      // 6. Mark ready
      await db.from('ascentor_videos').update({
        status: 'ready',
        hls_url: publicUrl(VIDEO_KEYS.master(videoId)),
        thumbnail_url: publicUrl(VIDEO_KEYS.thumbnail(videoId)),
        duration_seconds: Math.round(meta.duration),
        width: meta.width,
        height: meta.height,
        error: null,
        updated_at: new Date().toISOString(),
      }).eq('id', videoId);

      return { videoId, renditions: renditions.map((r) => r.name), duration: meta.duration };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db.from('ascentor_videos').update({
        status: 'failed',
        error: message.slice(0, 2000),
        updated_at: new Date().toISOString(),
      }).eq('id', videoId);
      throw err;
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  },
});
