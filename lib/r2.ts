// lib/r2.ts
// Cloudflare R2 access for self-hosted video. Server-only: it reads the
// R2 secret key. Used by the Next.js API routes (presigned uploads) and
// by the Trigger.dev transcode job (reading the original, writing HLS).
//
// aws4fetch is a ~6 KB SigV4 signer built on fetch, so this works in any
// runtime without pulling in the full AWS SDK.

import { AwsClient } from 'aws4fetch';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[r2] Missing environment variable ${name}`);
  return value;
}

let client: AwsClient | null = null;

function r2(): AwsClient {
  if (!client) {
    client = new AwsClient({
      accessKeyId: env('R2_ACCESS_KEY_ID'),
      secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
      service: 's3',
      region: 'auto',
    });
  }
  return client;
}

/** S3-API URL for an object key (used for signed requests). */
function objectUrl(key: string): string {
  const encoded = key.split('/').map(encodeURIComponent).join('/');
  return `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${env('R2_BUCKET')}/${encoded}`;
}

/** Public URL (r2.dev or custom domain) that browsers stream from. */
export function publicUrl(key: string): string {
  const base = env('R2_PUBLIC_URL').replace(/\/+$/, '');
  return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

/** Presigned PUT URL so the admin's browser uploads directly to R2. */
export async function presignPut(key: string, contentType: string, expiresSeconds = 3600): Promise<string> {
  const url = new URL(objectUrl(key));
  url.searchParams.set('X-Amz-Expires', String(expiresSeconds));
  const signed = await r2().sign(
    new Request(url, { method: 'PUT', headers: { 'Content-Type': contentType } }),
    { aws: { signQuery: true } },
  );
  return signed.url;
}

/** Presigned GET URL, used by the transcode job to read the original. */
export async function presignGet(key: string, expiresSeconds = 3600): Promise<string> {
  const url = new URL(objectUrl(key));
  url.searchParams.set('X-Amz-Expires', String(expiresSeconds));
  const signed = await r2().sign(new Request(url, { method: 'GET' }), { aws: { signQuery: true } });
  return signed.url;
}

export async function putObject(
  key: string,
  body: BodyInit,
  contentType: string,
  cacheControl = 'public, max-age=31536000, immutable',
): Promise<void> {
  const res = await r2().fetch(objectUrl(key), {
    method: 'PUT',
    body,
    headers: { 'Content-Type': contentType, 'Cache-Control': cacheControl },
  });
  if (!res.ok) throw new Error(`[r2] PUT ${key} failed: ${res.status} ${await res.text()}`);
}

export async function headObject(key: string): Promise<{ size: number } | null> {
  const res = await r2().fetch(objectUrl(key), { method: 'HEAD' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`[r2] HEAD ${key} failed: ${res.status}`);
  return { size: Number(res.headers.get('content-length') ?? 0) };
}

export async function deleteObject(key: string): Promise<void> {
  const res = await r2().fetch(objectUrl(key), { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`[r2] DELETE ${key} failed: ${res.status}`);
}

/** Lists keys under a prefix (max 1000 per page; paginates). */
export async function listKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const url = new URL(`https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${env('R2_BUCKET')}`);
    url.searchParams.set('list-type', '2');
    url.searchParams.set('prefix', prefix);
    if (token) url.searchParams.set('continuation-token', token);
    const res = await r2().fetch(url.toString());
    if (!res.ok) throw new Error(`[r2] LIST ${prefix} failed: ${res.status}`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) keys.push(m[1]);
    const next = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    token = next?.[1];
  } while (token);
  return keys;
}

/** Deletes every object belonging to a video (original + HLS output). */
export async function deleteVideoObjects(videoId: string): Promise<void> {
  const keys = await listKeys(`videos/${videoId}/`);
  for (const key of keys) await deleteObject(key);
}

export const VIDEO_KEYS = {
  source: (videoId: string, ext: string) => `videos/${videoId}/source.${ext}`,
  hlsDir: (videoId: string) => `videos/${videoId}/hls`,
  master: (videoId: string) => `videos/${videoId}/hls/master.m3u8`,
  thumbnail: (videoId: string) => `videos/${videoId}/thumbnail.jpg`,
};
