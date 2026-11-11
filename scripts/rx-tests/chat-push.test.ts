// Chat push previews.
//   npm run test:rx
import test from 'node:test';
import assert from 'node:assert/strict';

test('chat push preview: text, voice note, photo', async () => {
  // chat-push.ts imports server-only modules; test the pure helper by re-implementing its contract against the source.
  const src = (await import('node:fs')).readFileSync(new URL('../../lib/rx/chat-push.ts', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('export function chatPreview'), src.indexOf('\n}\n', src.indexOf('export function chatPreview')) + 2)
    .replace('export function chatPreview(body: string): string', 'return function chatPreview(body)');
  const chatPreview = new Function(fn)() as (b: string) => string;
  assert.equal(chatPreview('[voice:https://x/a.webm]'), 'Sent a voice note');
  assert.equal(chatPreview('[img:https://x/a.jpg]'), 'Sent a photo');
  assert.equal(chatPreview('  hello\n there  '), 'hello there');
});
