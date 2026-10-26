import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYouTubeId, parseVideo, parseVideoInput, youtubeWatchUrl, embedSrc } from '../../lib/rx/video';

const ID = 'dQw4w9WgXcQ';

test('reads the id from every YouTube link shape', () => {
  for (const u of [
    `https://www.youtube.com/watch?v=${ID}`, `https://youtube.com/watch?v=${ID}&t=42s`, `https://m.youtube.com/watch?feature=share&v=${ID}`,
    `https://youtu.be/${ID}`, `https://youtu.be/${ID}?si=abc`, `https://www.youtube.com/embed/${ID}`, `https://www.youtube-nocookie.com/embed/${ID}`,
    `https://www.youtube.com/shorts/${ID}`, `https://www.youtube.com/live/${ID}`, `youtube.com/watch?v=${ID}`, ID,
  ]) assert.equal(parseYouTubeId(u), ID, u);
});

test('rejects things that are not a YouTube video', () => {
  for (const u of ['', '   ', 'https://example.com/watch?v=' + ID, 'https://www.youtube.com/playlist?list=PL123', 'https://www.youtube.com/watch?v=short', 'https://evil.com/youtu.be/' + ID, 'not a link']) {
    assert.equal(parseYouTubeId(u), null, u);
  }
});

test('stores one canonical link and reports the provider', () => {
  const r = parseVideoInput(`https://youtu.be/${ID}?si=zzz`);
  assert.equal(r.ok, true);
  if (r.ok) { assert.equal(r.stored, youtubeWatchUrl(ID)); assert.deepEqual(r.source, { provider: 'youtube', id: ID }); }
  assert.equal(parseVideoInput('https://example.com/x').ok, false);
});

test('Vimeo and files still parse, so the later switch needs no page change', () => {
  assert.deepEqual(parseVideo('https://vimeo.com/123456789/abcdef1234'), { provider: 'vimeo', id: '123456789', hash: 'abcdef1234' });
  assert.deepEqual(parseVideo('https://cdn.example.com/a.mp4'), { provider: 'file', url: 'https://cdn.example.com/a.mp4' });
});

test('the YouTube embed is privacy-enhanced and starts where asked', () => {
  const src = embedSrc({ provider: 'youtube', id: ID }, 42.9, 'https://joinascentor.com');
  assert.match(src, /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/);
  assert.match(src, /start=42/);
});
