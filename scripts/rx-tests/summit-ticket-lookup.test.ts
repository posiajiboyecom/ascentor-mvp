import test from 'node:test';
import assert from 'node:assert/strict';
import { samePhone, secondFactorMatches, referenceOf } from '../../lib/summitTicketLookup';

const reg = { id: '1a2b3c4d-0000-4000-8000-000000000000', whatsapp: '+234 803 123 4567' };

test('phone numbers match however they are typed, and only the right number matches', () => {
  assert.equal(samePhone('08031234567', '+2348031234567'), true);
  assert.equal(samePhone('0803 123 4567', '+234 803 123 4567'), true);
  assert.equal(samePhone('08031234568', '+2348031234567'), false);
  assert.equal(samePhone('', '+2348031234567'), false);
  assert.equal(samePhone('123', '123'), false); // too short to identify anyone
});

test('second factor: whatsapp or reference, exact; nothing else opens a ticket', () => {
  assert.equal(referenceOf(reg.id), 'ES-1A2B3C4D');
  assert.equal(secondFactorMatches(reg, { whatsapp: '08031234567' }), true);
  assert.equal(secondFactorMatches(reg, { reference: 'es-1a2b3c4d' }), true);
  assert.equal(secondFactorMatches(reg, { reference: 'ES-1A2B3C4E' }), false);
  assert.equal(secondFactorMatches(reg, { whatsapp: '08039999999' }), false);
  assert.equal(secondFactorMatches(reg, {}), false);
  assert.equal(secondFactorMatches({ id: reg.id, whatsapp: null }, { whatsapp: '08031234567' }), false);
});
