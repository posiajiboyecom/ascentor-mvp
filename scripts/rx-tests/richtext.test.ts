import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanHtml, htmlToText, preparePostBody, excerpt } from '../../lib/rx/richtext';

test('keeps allowed formatting', () => {
  const out = cleanHtml('<p>Hello <strong>bold</strong> and <em>soft</em></p><ul><li>one</li></ul>');
  assert.match(out, /<strong>bold<\/strong>/);
  assert.match(out, /<ul><li>one<\/li><\/ul>/);
});

test('removes scripts, event handlers and javascript links', () => {
  const out = cleanHtml('<p onclick="x()">Hi</p><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">bad</a>');
  assert.doesNotMatch(out, /script|onclick|onerror|<img|javascript:/i);
  assert.match(out, /Hi/);
});

test('links open safely in a new tab', () => {
  const out = cleanHtml('<a href="https://example.com">x</a>');
  assert.match(out, /href="https:\/\/example.com"/);
  assert.match(out, /rel="noopener noreferrer nofollow ugc"/);
  assert.match(out, /target="_blank"/);
});

test('turns html into readable text', () => {
  assert.equal(htmlToText('<p>One</p><p>Two &amp; three</p>'), 'One\nTwo & three');
});

test('rejects empty and over-long posts', () => {
  const empty = preparePostBody('<p> </p>', '');
  assert.equal(empty.ok, false);
  const long = preparePostBody(`<p>${'a'.repeat(5200)}</p>`);
  assert.equal(long.ok, false);
});

test('falls back to plain text when there is no html', () => {
  const r = preparePostBody('', 'Just text <b>x</b>');
  assert.equal(r.ok, true);
  if (r.ok) assert.match(r.html, /&lt;b&gt;/);
});

test('excerpt trims long text', () => {
  assert.ok(excerpt('word '.repeat(40)).length <= 90);
});
