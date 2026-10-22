// Pure checks for the Billing v2 admin helpers: no network, no database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stateLabel, mrrKobo, groupStatusLabel, groupNotice, canRetryCharge, chargingNote, extendedDate, csvText, creditKindLabel, koboToNaira } from '../../lib/admin/billing-admin';

test('state mapping covers the five states and falls back to a dash', () => {
  assert.deepEqual(['trial', 'active', 'grace', 'lapsed', 'cancelled'].map(stateLabel), ['Trial', 'Active', 'Grace', 'Lapsed', 'Cancelled']);
  assert.equal(stateLabel('weird'), '-');
});

test('MRR counts active and grace from the catalog, never trials or members who are leaving', () => {
  const subs = [
    { planCode: 'seeker_solo_monthly', state: 'active' },
    { planCode: 'builder_solo_annual', state: 'active' },
    { planCode: 'builder_group_monthly', state: 'grace' },
    { planCode: 'seeker_solo_monthly', state: 'trial' },
    { planCode: 'seeker_solo_monthly', state: 'lapsed' },
    { planCode: 'seeker_solo_monthly', state: 'cancelled' },
    { planCode: 'builder_solo_monthly', state: 'active', cancelAtPeriodEnd: true },
    { planCode: 'nonsense', state: 'active' },
  ];
  assert.equal(mrrKobo(subs), 300_000 + 583_333 + 500_000);
  assert.equal(mrrKobo([]), 0);
});

test('group status and the exactly-3 notice', () => {
  assert.equal(groupStatusLabel('forming'), 'Forming');
  assert.equal(groupStatusLabel('broken'), 'Broken');
  assert.equal(groupStatusLabel(null), '-');
  assert.ok(groupNotice(3));
  assert.equal(groupNotice(2), null);
  assert.equal(groupNotice(4), null);
});

test('retry is only offered for a failed renewal while charging is live', () => {
  assert.equal(canRetryCharge('live', 'grace'), true);
  assert.equal(canRetryCharge('dry', 'grace'), false);
  assert.equal(canRetryCharge('off', 'grace'), false);
  assert.equal(canRetryCharge('live', 'active'), false);
});

test('banner wording per mode, and no em dashes', () => {
  for (const m of ['off', 'dry', 'live'] as const) {
    const n = chargingNote(m, true);
    assert.ok(!(n.title + n.body).includes(String.fromCharCode(0x2014)));
  }
  assert.equal(chargingNote('live', false).tone, 'bad');
  assert.equal(chargingNote('off', false).tone, 'good');
});

test('extend date, csv guard, credit labels, naira', () => {
  assert.equal(extendedDate(new Date('2026-10-01T00:00:00Z'), 7)?.toISOString(), '2026-10-08T00:00:00.000Z');
  assert.equal(extendedDate(null, 7), null);
  assert.equal(csvText(['A'], [['=SUM(1)'], ['say "hi"']]), '"A"\r\n"\'=SUM(1)"\r\n"say ""hi"""');
  assert.equal(creditKindLabel('referral_earned'), 'Earned');
  assert.equal(koboToNaira(300_000), '₦3,000');
  assert.equal(koboToNaira(null), '-');
});
