// Sage on free providers: parsing replies, the provider order, and back-off after errors.
//   npm run test:rx
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSageJson } from '../../lib/ai/sage-json';

test('reply parsing: clean JSON, fenced JSON, JSON inside prose, plain text', () => {
  assert.equal(parseSageJson('{"reply":"Hi there"}').reply, 'Hi there');
  assert.equal(parseSageJson('```json\n{"reply":"Fenced","note":"Studies at night."}\n```').note, 'Studies at night.');
  assert.equal(parseSageJson('Sure! Here it is: {"reply":"Inside prose"} hope that helps').reply, 'Inside prose');
  assert.equal(parseSageJson('Just a plain answer.').reply, 'Just a plain answer.');
  assert.equal(parseSageJson('{"not_reply":1}').reply, '{"not_reply":1}');
});

test('provider chain: default order and back-off rules', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../../lib/ai/sage-models.ts', import.meta.url), 'utf8');
  assert.match(src, /'groq,cloudflare,sambanova,openrouter'/, 'default order is groq, cloudflare, sambanova, openrouter');
  assert.match(src, /sambanova\('DeepSeek-V3\.1'\), sambanova\('gemma-4-31B-it'\)/, 'SambaNova tries DeepSeek V3.1 then Gemma 4');
  assert.match(src, /groq\('openai\/gpt-oss-120b'\), groq\('openai\/gpt-oss-20b'\)/, 'Groq tries 120b then 20b');
  assert.match(src, /anthropic: \[anthropic\]/, 'paid Claude only when listed');
  assert.ok(src.includes('if (env == null && !chain.some((t) => t.ready())) return BY_NAME.anthropic;'), 'Claude only until a free key exists');
});
