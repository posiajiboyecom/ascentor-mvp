import test from 'node:test';
import assert from 'node:assert/strict';
import { contactLinks, phoneDigits } from '../../lib/admin/contact';

test('phone numbers become international digits', () => {
  assert.equal(phoneDigits('0803 123 4567'), '2348031234567');
  assert.equal(phoneDigits('+234 803 123 4567'), '2348031234567');
  assert.equal(phoneDigits('08031234567'), '2348031234567');
  assert.equal(phoneDigits('8031234567'), '2348031234567');
  assert.equal(phoneDigits('00447911123456'), '447911123456');
  assert.equal(phoneDigits('+1 (415) 555-0132'), '14155550132');
  assert.equal(phoneDigits(''), null);
  assert.equal(phoneDigits('n/a'), null);
  assert.equal(phoneDigits('123'), null);
  assert.equal(phoneDigits(null), null);
});

test('contact links: call, whatsapp, email', () => {
  const l = contactLinks({ name: 'Ada Okafor', phone: '0803 123 4567', email: 'ada@example.com' });
  assert.equal(l.call, 'tel:+2348031234567');
  assert.match(l.whatsapp ?? '', /^https:\/\/wa\.me\/2348031234567\?text=Hello%20Ada%2C/);
  assert.match(l.email ?? '', /^mailto:ada@example\.com\?subject=/);
});

test('missing or bad data gives no link', () => {
  assert.deepEqual(contactLinks({ name: 'X', phone: 'none', email: 'not-an-email' }), { call: null, whatsapp: null, email: null });
  assert.deepEqual(contactLinks({}), { call: null, whatsapp: null, email: null });
  assert.equal(contactLinks({ phone: '08031234567' }).email, null);
});
