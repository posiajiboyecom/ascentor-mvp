import test from 'node:test';
import assert from 'node:assert/strict';
import { audienceLabel, cleanLink, deliveryPlan, matches, parseAudience, validateBroadcast, BODY_MAX } from '../../lib/rx/audience';

const base = { title: 'The Summit is Thursday', body: 'Doors open at 9.', channel: 'both' as const, audience: { kind: 'all' } };
const CIRCLE = 'aaaaaaaa-0000-0000-0000-000000000001';

test('audiences are validated', () => {
  assert.deepEqual(parseAudience({ kind: 'all' }), { kind: 'all' });
  assert.deepEqual(parseAudience({ kind: 'stage', value: 'Building' }), { kind: 'stage', value: 'Building' });
  assert.equal(parseAudience({ kind: 'stage', value: 'Wizard' }), null);
  assert.equal(parseAudience({ kind: 'city' }), null);
  assert.equal(parseAudience({ kind: 'circle', value: 'not-an-id' }), null);
  assert.deepEqual(parseAudience({ kind: 'circle', value: CIRCLE }), { kind: 'circle', value: CIRCLE });
  assert.equal(parseAudience(null), null);
  assert.equal(parseAudience({ kind: 'everyone-and-more' }), null);
});

test('membership in an audience, case and spacing aside', () => {
  const m = { stage: 'Building', city: 'Lagos', language: 'Yoruba', circleIds: [CIRCLE] };
  assert.equal(matches({ kind: 'all' }, {}), true);
  assert.equal(matches({ kind: 'stage', value: 'Building' }, m), true);
  assert.equal(matches({ kind: 'stage', value: 'Leading' }, m), false);
  assert.equal(matches({ kind: 'city', value: ' lagos ' }, m), true);
  assert.equal(matches({ kind: 'language', value: 'English' }, m), false);
  assert.equal(matches({ kind: 'circle', value: CIRCLE }, m), true);
  assert.equal(matches({ kind: 'circle', value: CIRCLE }, { circleIds: [] }), false);
  assert.match(audienceLabel({ kind: 'city', value: 'Abuja' }), /Abuja/);
});

test('links may be in-app paths or https, never scripts', () => {
  assert.equal(cleanLink('/community'), '/community');
  assert.equal(cleanLink('/community/post/abc?x=1'), '/community/post/abc?x=1');
  assert.equal(cleanLink('https://joinascentor.com/elevation-summit'), 'https://joinascentor.com/elevation-summit');
  assert.equal(cleanLink('javascript:alert(1)'), null);
  assert.equal(cleanLink('//evil.example'), null);
  assert.equal(cleanLink('http://insecure.example'), null);
  assert.equal(cleanLink(''), null);
});

test('a broadcast is checked before it can be sent', () => {
  assert.equal(validateBroadcast(base).ok, true);
  assert.equal(validateBroadcast({ ...base, title: 'Hi' }).ok, false);
  assert.equal(validateBroadcast({ ...base, body: 'x'.repeat(BODY_MAX + 1) }).ok, false);
  assert.equal(validateBroadcast({ ...base, channel: 'sms' as never }).ok, false);
  assert.equal(validateBroadcast({ ...base, audience: { kind: 'stage', value: 'Nope' } }).ok, false);
  assert.equal(validateBroadcast({ ...base, linkUrl: 'javascript:1' }).ok, false);
  const withLink = validateBroadcast({ ...base, linkUrl: '/elevation-summit' });
  assert.equal(withLink.ok && withLink.value.linkLabel, 'Open');
});

test('the sidebar card is for messages shown in the app', () => {
  const now = new Date('2026-10-12T10:00:00Z');
  assert.equal(validateBroadcast({ ...base, channel: 'email', pinCard: true }, now).ok, false);
  assert.equal(validateBroadcast({ ...base, pinCard: true, pinUntil: '2026-10-01T00:00:00Z' }, now).ok, false);
  const ok = validateBroadcast({ ...base, pinCard: true, pinUntil: '2026-11-19T23:00:00Z' }, now);
  assert.equal(ok.ok && ok.value.pinUntil, '2026-11-19T23:00:00.000Z');
});

test('who gets what, given their switches', () => {
  assert.deepEqual(deliveryPlan('both', {}), { inApp: true, push: true, email: true, skipped: null });
  assert.deepEqual(deliveryPlan('in_app', {}), { inApp: true, push: true, email: false, skipped: null });
  // muted announcements: still in the app (it is just not pushed), never emailed
  assert.deepEqual(deliveryPlan('both', { annMuted: true }), { inApp: true, push: false, email: false, skipped: null });
  // email-only, and this member turned announcement emails off: nothing to send
  assert.deepEqual(deliveryPlan('email', { emailOff: true }), { inApp: false, push: false, email: false, skipped: 'announcement emails off' });
  assert.deepEqual(deliveryPlan('email', { annMuted: true }), { inApp: false, push: false, email: false, skipped: 'announcements muted' });
  assert.equal(deliveryPlan('email', {}).inApp, false);
});
