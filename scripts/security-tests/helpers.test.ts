// Run: npm run test:security
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pgTerm, isUuid, safeEqual, sniffFile, sniffMatches, svgIsSafe, maskEmail } from '../../lib/security';
import { jsonLdString } from '../../lib/seo';

test('pgTerm strips PostgREST filter syntax but keeps searchable text', () => {
  assert.equal(pgTerm('ada@example.com'), 'ada@example.com');
  assert.equal(pgTerm('x%,id.neq.0),(role.eq.admin'), 'x id.neq.0 role.eq.admin');
  assert.ok(!/[,()%*:"']/.test(pgTerm(`a,b(c)d%e*f:g"h'i`)));
  assert.equal(pgTerm('Adébáyọ̀ Ọlá'), 'Adébáyọ̀ Ọlá'.normalize('NFKC'));
  assert.equal(pgTerm('a'.repeat(200)).length, 80);
});

test('isUuid accepts only canonical UUIDs', () => {
  assert.ok(isUuid('3f1c2b9a-1d2e-4f5a-8b9c-0d1e2f3a4b5c'));
  assert.ok(!isUuid('3f1c2b9a-1d2e-4f5a-8b9c-0d1e2f3a4b5c),or(x.eq.1'));
  assert.ok(!isUuid(undefined));
});

test('safeEqual fails closed on missing secrets', () => {
  assert.ok(safeEqual('s3cret', 's3cret'));
  assert.ok(!safeEqual('s3cret', 's3creT'));
  assert.ok(!safeEqual(null, undefined));
  assert.ok(!safeEqual('', ''));
  assert.ok(!safeEqual('abc', undefined));
});

test('sniffFile identifies real types from magic bytes', () => {
  assert.equal(sniffFile(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(sniffFile(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(sniffFile(new TextEncoder().encode('%PDF-1.7')), 'application/pdf');
  assert.equal(sniffFile(new TextEncoder().encode('<html><script>alert(1)</script>')), null);
  assert.equal(sniffFile(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')), 'image/svg+xml');
  assert.ok(sniffMatches('video/webm', 'audio/webm;codecs=opus'));
  assert.ok(!sniffMatches('image/png', 'image/jpeg'));
  assert.ok(!sniffMatches(null, 'image/png'));
});

test('svgIsSafe rejects active content', () => {
  assert.ok(svgIsSafe('<svg><rect width="1" height="1"/></svg>'));
  assert.ok(!svgIsSafe('<svg><script>alert(1)</script></svg>'));
  assert.ok(!svgIsSafe('<svg onload="alert(1)"></svg>'));
  assert.ok(!svgIsSafe('<svg><a href="javascript:alert(1)">x</a></svg>'));
  assert.ok(!svgIsSafe('<svg><foreignObject><div/></foreignObject></svg>'));
  // Bypasses found in review
  assert.ok(!svgIsSafe('<svg><h:script xmlns:h="http://www.w3.org/1999/xhtml">alert(1)</h:script></svg>'));
  assert.ok(!svgIsSafe('<svg><a xlink:href="&#106;avascript:alert(1)">x</a></svg>'));
  assert.ok(!svgIsSafe('<svg><a><animate attributeName="href" values="javascript:alert(1)"/></a></svg>'));
  assert.ok(!svgIsSafe('<svg><set attributeName="href" to="x"/></svg>'));
  assert.ok(!svgIsSafe('<svg><image href="https://evil.example/x.svg"/></svg>'));
  // Ordinary logos still pass (namespace declarations are not references)
  assert.ok(svgIsSafe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z" fill="#C8A96E"/><text>A &amp; B</text></svg>'));
});

test('maskEmail hides the local part', () => {
  assert.equal(maskEmail('ada@example.com'), 'a***@example.com');
  assert.equal(maskEmail(null), '(none)');
});

test('blog safe paths', () => {
  const sitePath = (h: string) => /^\/(?![\/\\])/.test(h);
  assert.ok(sitePath('/elevation-summit'));
  assert.ok(!sitePath('//evil.com'));
  assert.ok(!sitePath('/\\evil.com'));
});

test('jsonLdString cannot close its script tag', () => {
  const out = jsonLdString({ name: '</script><script>alert(1)</script>' });
  assert.ok(!out.includes('</script>'));
  assert.deepEqual(JSON.parse(out), { name: '</script><script>alert(1)</script>' });
});
