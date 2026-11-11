// Billing v2 access: what each tier gets.
//   npm run test:billing
import test from 'node:test';
import assert from 'node:assert/strict';

test('Pinnacle: everything Builder has, plus private mentor, priority support and no Sage cap', async () => {
  const { featuresFor, SAGE_DAILY_MESSAGES, planForAccess, accessFromSubscription } = await import('../../lib/billing/access');
  const f = featuresFor('full', 'pinnacle');
  assert.equal(f.advancedLearn, true);
  assert.equal(f.privateMentor, true);
  assert.equal(f.prioritySupport, true);
  assert.equal(featuresFor('full', 'builder').privateMentor, false);
  assert.equal(featuresFor('light', 'pinnacle').privateMentor, false);
  assert.equal(SAGE_DAILY_MESSAGES.pinnacle, null);
  assert.equal(SAGE_DAILY_MESSAGES.explorer, 25);
  const a = accessFromSubscription({ state: 'active', tier: 'pinnacle', periodEnd: new Date('2027-01-01') }, false, new Date('2026-11-11'));
  assert.equal(planForAccess(a), 'pinnacle');
});
