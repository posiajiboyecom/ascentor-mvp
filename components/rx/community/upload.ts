// Browser-side upload of one Community photo or video: ask the server for a signed link, then send the file straight to storage.

import { createClient } from '@/lib/supabase/client';
import type { MediaItem } from '@/lib/rx/feed-types';

export const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime';

export async function uploadPostMedia(file: File): Promise<MediaItem> {
  const res = await fetch('/api/rx/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType: file.type, size: file.size }),
  });
  const info = (await res.json().catch(() => ({}))) as { error?: string; bucket?: string; path?: string; token?: string; publicUrl?: string; kind?: 'image' | 'video' };
  if (!res.ok || !info.bucket || !info.path || !info.token || !info.publicUrl || !info.kind) throw new Error(info.error ?? 'We couldn’t start that upload.');

  const supabase = createClient();
  const { error } = await supabase.storage.from(info.bucket).uploadToSignedUrl(info.path, info.token, file, { contentType: file.type });
  if (error) throw new Error('The upload didn’t finish. Check your connection and try again.');
  return { url: info.publicUrl, kind: info.kind };
}
