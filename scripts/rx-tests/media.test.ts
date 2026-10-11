import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';

test('post media must be in our bucket, in the member\'s own folder', async () => {
  const m = await import('../../lib/rx/media');
  const base = 'https://abc.supabase.co/storage/v1/object/public/rx-posts/';
  assert.equal(m.isPostBucketUrl(`${base}u1/a.jpg`), true);
  assert.equal(m.isPostBucketUrl('https://evil.example/a.jpg'), false);
  assert.equal(m.isPostBucketUrl(`${base}../x`), false);
  assert.equal(m.isOwnPostMedia(`${base}u1/a.jpg`, 'u1'), true);
  assert.equal(m.isOwnPostMedia(`${base}u2/a.jpg`, 'u1'), false);
});

test('video and image kinds come from the file ending', async () => {
  const m = await import('../../lib/rx/media');
  assert.equal(m.postMediaKind('https://x/y/clip.MP4'), 'video');
  assert.equal(m.postMediaKind('https://x/y/clip.webm'), 'video');
  assert.equal(m.postMediaKind('https://x/y/pic.png'), 'image');
});

test('allowed upload types carry sensible size limits', async () => {
  const m = await import('../../lib/rx/media');
  assert.equal(m.POST_MEDIA_TYPES['image/png'].kind, 'image');
  assert.equal(m.POST_MEDIA_TYPES['video/mp4'].maxMB <= m.POST_BUCKET_LIMIT_MB, true);
  assert.equal(m.POST_MEDIA_TYPES['application/pdf'], undefined);
});
